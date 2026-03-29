import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOrCreateUser } from "./helpers";
import { Id } from "./_generated/dataModel";

// Generate a unique transaction reference
function generateTxRef(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AC-${timestamp}-${random}`;
}

// Create a pending payment record (stores cart snapshot for later order creation)
export const create = mutation({
  args: {
    amount: v.number(),
    currency: v.string(),
    paymentType: v.union(v.literal("order"), v.literal("subscription")),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateUser(ctx);
    const now = Date.now();
    const txRef = generateTxRef();

    // For order payments, snapshot the cart items
    let cartSnapshot: string | undefined;
    if (args.paymentType === "order") {
      const cartItems = await ctx.db
        .query("cartItems")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      if (cartItems.length === 0) {
        throw new Error("Cart is empty");
      }

      // Build cart snapshot with product details
      const cartData = [];
      for (const item of cartItems) {
        const product = await ctx.db.get(item.productId);
        if (!product) continue;
        if (product.status !== "active") {
          throw new Error(`Product ${product.name} is no longer available`);
        }
        if (item.quantity > product.quantity) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }
        cartData.push({
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
          sellerId: product.sellerId,
          productName: product.name,
        });
      }
      cartSnapshot = JSON.stringify(cartData);
    }

    const paymentId = await ctx.db.insert("payments", {
      userId: user._id,
      chapaTransactionRef: txRef,
      amount: args.amount,
      currency: args.currency,
      status: "pending",
      paymentType: args.paymentType,
      metadata: cartSnapshot || args.metadata,
      createdAt: now,
      updatedAt: now,
    });

    const payment = await ctx.db.get(paymentId);
    return {
      ...payment,
      txRef,
      user: {
        email: user.email,
        name: user.name,
      },
    };
  },
});

// Update payment status after verification
export const updateStatus = mutation({
  args: {
    txRef: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    chapaTrxRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_chapa_ref", (q) => q.eq("chapaTransactionRef", args.txRef))
      .first();

    if (!payment) {
      throw new Error("Payment not found");
    }

    // Don't re-process if already successful
    if (payment.status === "success") {
      return await ctx.db.get(payment._id);
    }

    await ctx.db.patch(payment._id, {
      status: args.status,
      chapaTrxRef: args.chapaTrxRef,
      updatedAt: Date.now(),
    });

    // If payment successful and it's an order payment, create orders from cart snapshot
    if (args.status === "success" && payment.paymentType === "order" && payment.metadata) {
      const now = Date.now();
      
      // Parse cart snapshot
      let cartData: Array<{
        productId: string;
        quantity: number;
        price: number;
        sellerId: string;
        productName: string;
      }>;
      
      try {
        cartData = JSON.parse(payment.metadata);
      } catch {
        console.error("Failed to parse cart snapshot");
        return await ctx.db.get(payment._id);
      }

      // Get user info
      const user = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("_id"), payment.userId))
        .first();
      
      if (!user) {
        console.error("User not found for payment");
        return await ctx.db.get(payment._id);
      }

      // Group items by seller
      const itemsBySeller = new Map<string, typeof cartData>();
      for (const item of cartData) {
        if (!itemsBySeller.has(item.sellerId)) {
          itemsBySeller.set(item.sellerId, []);
        }
        itemsBySeller.get(item.sellerId)!.push(item);
      }

      const createdOrderIds: Id<"orders">[] = [];

      // Create one order per seller
      for (const [sellerId, items] of itemsBySeller.entries()) {
        let totalAmount = 0;
        const orderItems = [];

        for (const item of items) {
          const itemTotal = item.price * item.quantity;
          totalAmount += itemTotal;
          orderItems.push({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          });
        }

        // Get seller info
        const seller = await ctx.db
          .query("users")
          .filter((q) => q.eq(q.field("_id"), sellerId))
          .first();
        const sellerName = seller?.name || seller?.email || "Unknown Seller";

        // Create order
        const orderId = await ctx.db.insert("orders", {
          userId: user._id,
          buyerId: user._id,
          sellerId: sellerId,
          title: `Order from ${sellerName}`,
          customer: user.name || user.email,
          amount: totalAmount,
          status: "processing", // Already paid
          description: `Order containing ${items.length} item(s) - Payment ref: ${payment.chapaTransactionRef}`,
          createdAt: now,
          updatedAt: now,
        });

        createdOrderIds.push(orderId);

        // Create order items and update product quantities
        for (const item of orderItems) {
          const productId = item.productId as Id<"products">;
          
          await ctx.db.insert("orderItems", {
            orderId,
            productId,
            quantity: item.quantity,
            price: item.price,
            createdAt: now,
          });

          // Update product quantity
          const product = await ctx.db.get(productId);
          if (product) {
            const newQuantity = Math.max(0, product.quantity - item.quantity);
            await ctx.db.patch(productId, {
              quantity: newQuantity,
              updatedAt: now,
            });
          }
        }
      }

      // Clear user's cart
      const cartItems = await ctx.db
        .query("cartItems")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      
      for (const cartItem of cartItems) {
        await ctx.db.delete(cartItem._id);
      }

      // Update payment with first order ID for reference
      if (createdOrderIds.length > 0) {
        await ctx.db.patch(payment._id, {
          orderId: createdOrderIds[0],
          updatedAt: Date.now(),
        });
      }
    }

    return await ctx.db.get(payment._id);
  },
});

// Get payment by transaction reference
export const getByTxRef = query({
  args: { txRef: v.string() },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_chapa_ref", (q) => q.eq("chapaTransactionRef", args.txRef))
      .first();

    return payment;
  },
});

// List user's payments
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("success"),
        v.literal("failed"),
        v.literal("cancelled")
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return [];
    }

    let payments = await ctx.db
      .query("payments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (args.status) {
      payments = payments.filter((p) => p.status === args.status);
    }

    return payments.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get payment with order details
export const getWithOrder = query({
  args: { paymentId: v.id("payments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    const payment = await ctx.db.get(args.paymentId);
    if (!payment) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || payment.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    let order = null;
    if (payment.orderId) {
      order = await ctx.db.get(payment.orderId);
    }

    return {
      ...payment,
      order,
    };
  },
});

