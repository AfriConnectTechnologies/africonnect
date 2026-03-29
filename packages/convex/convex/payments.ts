import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOrCreateUser, requireVerifiedBusinessForBuying } from "./helpers";
import { Id } from "./_generated/dataModel";
import { createLogger, flushLogs } from "./lib/logger";

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
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const log = createLogger("payments.create");
    
    try {
      log.info("Payment creation initiated", {
        amount: args.amount,
        currency: args.currency,
        paymentType: args.paymentType,
        hasIdempotencyKey: !!args.idempotencyKey,
      });

      const user = await getOrCreateUser(ctx);
      log.setContext({ userId: user.clerkId });
      
      const now = Date.now();
      const txRef = generateTxRef();

      log.debug("Generated transaction reference", { txRef });

      // For order payments, snapshot the cart items
      let cartSnapshot: string | undefined;
      if (args.paymentType === "order") {
        await requireVerifiedBusinessForBuying(ctx.db, user);

        const cartItems = await ctx.db
          .query("cartItems")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();

        log.debug("Retrieved cart items", { cartItemCount: cartItems.length });

        if (cartItems.length === 0) {
          log.warn("Payment creation failed - empty cart", { userId: user.clerkId });
          await flushLogs();
          throw new Error("Cart is empty");
        }

        // Build cart snapshot with product details
        const cartData = [];
        for (const item of cartItems) {
          const product = await ctx.db.get(item.productId);
          if (!product) continue;
          if (product.status !== "active") {
            log.warn("Payment creation failed - inactive product", {
              productId: item.productId,
              productName: product.name,
              productStatus: product.status,
            });
            await flushLogs();
            throw new Error(`Product ${product.name} is no longer available`);
          }
          if (item.quantity > product.quantity) {
            log.warn("Payment creation failed - insufficient stock", {
              productId: item.productId,
              productName: product.name,
              requestedQty: item.quantity,
              availableQty: product.quantity,
            });
            await flushLogs();
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
        const subtotal = cartData.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        const buyerFee = Math.round(subtotal * 0.01 * 100) / 100;

        cartSnapshot = JSON.stringify({
          items: cartData,
          subtotal,
          buyerFee,
        });

        log.debug("Cart snapshot created", {
          itemCount: cartData.length,
          totalProducts: cartData.reduce((sum, item) => sum + item.quantity, 0),
        });
      }

      const paymentId = await ctx.db.insert("payments", {
        userId: user._id,
        chapaTransactionRef: txRef,
        amount: args.amount,
        currency: args.currency,
        status: "pending",
        paymentType: args.paymentType,
        metadata: cartSnapshot || args.metadata,
        idempotencyKey: args.idempotencyKey,
        createdAt: now,
        updatedAt: now,
      });

      // Race-safe idempotency: verify we're the only payment with this key
      if (args.idempotencyKey) {
        const duplicates = await ctx.db
          .query("payments")
          .withIndex("by_idempotency", (q) => 
            q.eq("userId", user._id).eq("idempotencyKey", args.idempotencyKey)
          )
          .collect();

        if (duplicates.length > 1) {
          // Use _id as deterministic tiebreaker (lexicographically smallest wins)
          duplicates.sort((a, b) => (a._id < b._id ? -1 : 1));
          const winner = duplicates[0];

          if (winner._id !== paymentId) {
            // We lost the race - delete our entry and return the existing payment
            await ctx.db.delete(paymentId);
            log.info("Idempotency race resolved - returning existing payment", {
              existingPaymentId: winner._id,
              duplicatePaymentId: paymentId,
            });
            return {
              ...winner,
              txRef: winner.chapaTransactionRef,
              user: { email: user.email, name: user.name },
            };
          }

          // We won - clean up duplicates
          for (const dup of duplicates.slice(1)) {
            await ctx.db.delete(dup._id);
          }
        }
      }

      const payment = await ctx.db.get(paymentId);

      log.info("Payment created successfully", {
        paymentId: paymentId,
        txRef,
        amount: args.amount,
        currency: args.currency,
        paymentType: args.paymentType,
      });

      await flushLogs();

      return {
        ...payment,
        txRef,
        user: {
          email: user.email,
          name: user.name,
        },
      };
    } catch (error) {
      log.error("Payment creation failed", error, {
        amount: args.amount,
        currency: args.currency,
        paymentType: args.paymentType,
      });
      await flushLogs();
      throw error;
    }
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
    processorFeeTotal: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const log = createLogger("payments.updateStatus");
    
    try {
      log.info("Payment status update initiated", {
        txRef: args.txRef,
        newStatus: args.status,
        chapaTrxRef: args.chapaTrxRef,
      });

      const payment = await ctx.db
        .query("payments")
        .withIndex("by_chapa_ref", (q) => q.eq("chapaTransactionRef", args.txRef))
        .first();

      if (!payment) {
        log.error("Payment not found for status update", undefined, { txRef: args.txRef });
        await flushLogs();
        throw new Error("Payment not found");
      }

      log.setContext({ userId: payment.userId as string });
      log.debug("Payment found", {
        paymentId: payment._id,
        currentStatus: payment.status,
        paymentType: payment.paymentType,
      });

      // Don't re-process if already successful, but allow fee updates
      if (payment.status === "success") {
        if (
          args.processorFeeTotal !== undefined &&
          payment.processorFeeTotal !== args.processorFeeTotal
        ) {
          await ctx.db.patch(payment._id, {
            processorFeeTotal: args.processorFeeTotal,
            updatedAt: Date.now(),
          });
        }

        log.info("Payment already successful, skipping re-processing", {
          paymentId: payment._id,
          txRef: args.txRef,
        });
        await flushLogs();
        return await ctx.db.get(payment._id);
      }

      await ctx.db.patch(payment._id, {
        status: args.status,
        chapaTrxRef: args.chapaTrxRef,
        ...(args.processorFeeTotal !== undefined
          ? { processorFeeTotal: args.processorFeeTotal }
          : {}),
        updatedAt: Date.now(),
      });

      log.info("Payment status updated", {
        paymentId: payment._id,
        previousStatus: payment.status,
        newStatus: args.status,
      });

      // If payment successful, handle based on payment type
      if (args.status === "success") {
        // Handle subscription payments
        if (payment.paymentType === "subscription" && payment.metadata) {
          try {
            const metadata = JSON.parse(payment.metadata);
            const { planId, billingCycle, businessId } = metadata;

            log.info("Processing subscription payment", {
              paymentId: payment._id,
              planId,
              billingCycle,
              businessId,
            });
            
            if (planId && businessId) {
              // Check for existing subscription
              const existingSub = await ctx.db
                .query("subscriptions")
                .withIndex("by_business", (q) => q.eq("businessId", businessId))
                .first();
              
              const now = Date.now();
              const periodDays = billingCycle === "annual" ? 365 : 30;
              const periodMs = periodDays * 24 * 60 * 60 * 1000;
              
              if (existingSub) {
                // Update existing subscription
                await ctx.db.patch(existingSub._id, {
                  planId: planId,
                  status: "active",
                  billingCycle: billingCycle || "monthly",
                  currentPeriodStart: now,
                  currentPeriodEnd: now + periodMs,
                  lastPaymentId: payment._id,
                  cancelAtPeriodEnd: false,
                  trialEndsAt: undefined,
                  updatedAt: now,
                });

                log.info("Existing subscription updated", {
                  subscriptionId: existingSub._id,
                  businessId,
                  planId,
                  periodEnd: new Date(now + periodMs).toISOString(),
                });
              } else {
                // Create new subscription
                const newSubId = await ctx.db.insert("subscriptions", {
                  businessId: businessId,
                  planId: planId,
                  status: "active",
                  billingCycle: billingCycle || "monthly",
                  currentPeriodStart: now,
                  currentPeriodEnd: now + periodMs,
                  cancelAtPeriodEnd: false,
                  lastPaymentId: payment._id,
                  createdAt: now,
                  updatedAt: now,
                });

                log.info("New subscription created", {
                  subscriptionId: newSubId,
                  businessId,
                  planId,
                  billingCycle: billingCycle || "monthly",
                });
              }
            }
          } catch (subError) {
            log.error("Failed to process subscription payment", subError, {
              paymentId: payment._id,
              txRef: args.txRef,
            });
          }
        }
        
        // Handle order payments
        if (payment.paymentType === "order" && payment.metadata) {
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
            const parsed = JSON.parse(payment.metadata);
            if (Array.isArray(parsed)) {
              cartData = parsed;
            } else if (parsed && Array.isArray(parsed.items)) {
              cartData = parsed.items;
            } else {
              cartData = [];
            }
            log.debug("Cart snapshot parsed", { itemCount: cartData.length });
          } catch (parseError) {
            log.error("Failed to parse cart snapshot", parseError, { paymentId: payment._id });
            await flushLogs();
            return await ctx.db.get(payment._id);
          }

          // Get user info
          const user = await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("_id"), payment.userId))
            .first();

          if (!user) {
            log.error("User not found for payment", undefined, {
              paymentId: payment._id,
              userId: payment.userId,
            });
            await flushLogs();
            return await ctx.db.get(payment._id);
          }
          
          // Business verification is enforced before checkout starts in payments.create.
          // Do not block order creation after a captured payment if the buyer's status
          // changes while the processor callback is still in flight.

          // Group items by seller
          const itemsBySeller = new Map<string, typeof cartData>();
          for (const item of cartData) {
            if (!itemsBySeller.has(item.sellerId)) {
              itemsBySeller.set(item.sellerId, []);
            }
            itemsBySeller.get(item.sellerId)!.push(item);
          }

          log.debug("Cart items grouped by seller", {
            sellerCount: itemsBySeller.size,
            totalItems: cartData.length,
          });

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

            // Get seller info (sellerId can be clerkId or Convex _id depending on how product was created)
            const normalizedSellerId = ctx.db.normalizeId("users", sellerId);
            let seller = normalizedSellerId
              ? await ctx.db.get(normalizedSellerId)
              : null;

            if (!seller) {
              seller = await ctx.db
                .query("users")
                .withIndex("by_clerk_id", (q) => q.eq("clerkId", sellerId))
                .first();
            }
            const sellerName = seller?.name || seller?.email || "Unknown Seller";

            // Create order
            const orderId = await ctx.db.insert("orders", {
              userId: user._id,
              buyerId: user._id,
              sellerId: sellerId,
              paymentId: payment._id,
              title: `Order from ${sellerName}`,
              customer: user.name || user.email,
              amount: totalAmount,
              status: "processing", // Already paid
              description: `Order containing ${items.length} item(s) - Payment ref: ${payment.chapaTransactionRef}`,
              createdAt: now,
              updatedAt: now,
            });

            createdOrderIds.push(orderId);

            log.info("Order created from payment", {
              orderId,
              sellerId,
              sellerName,
              itemCount: items.length,
              totalAmount,
              paymentRef: payment.chapaTransactionRef,
            });

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

                log.debug("Product quantity updated", {
                  productId,
                  previousQty: product.quantity,
                  newQty: newQuantity,
                  soldQty: item.quantity,
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

          log.info("User cart cleared after successful payment", {
            userId: user._id,
            clearedItems: cartItems.length,
          });

          // Update payment with first order ID for reference
          if (createdOrderIds.length > 0) {
            await ctx.db.patch(payment._id, {
              orderId: createdOrderIds[0],
              updatedAt: Date.now(),
            });

            log.info("Payment linked to order", {
              paymentId: payment._id,
              orderId: createdOrderIds[0],
              totalOrdersCreated: createdOrderIds.length,
            });
          }
        }
      }

      await flushLogs();
      return await ctx.db.get(payment._id);
    } catch (error) {
      log.error("Payment status update failed", error, {
        txRef: args.txRef,
        newStatus: args.status,
      });
      await flushLogs();
      throw error;
    }
  },
});

// Get payment by transaction reference
export const getByTxRef = query({
  args: { txRef: v.string() },
  handler: async (ctx, args) => {
    const log = createLogger("payments.getByTxRef");
    
    log.debug("Fetching payment by txRef", { txRef: args.txRef });

    const payment = await ctx.db
      .query("payments")
      .withIndex("by_chapa_ref", (q) => q.eq("chapaTransactionRef", args.txRef))
      .first();

    log.info("Payment lookup completed", {
      txRef: args.txRef,
      found: !!payment,
      paymentId: payment?._id,
      status: payment?.status,
    });

    await flushLogs();
    return payment;
  },
});

// Get payment by idempotency key (for deduplication)
export const getByIdempotencyKey = query({
  args: {
    idempotencyKey: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get user by clerk ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) return null;

    // Find payment with matching idempotency key for this user
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_idempotency", (q) => 
        q.eq("userId", user._id).eq("idempotencyKey", args.idempotencyKey)
      )
      .first();

    if (!payments) return null;

    return payments;
  },
});

// Update checkout URL after Chapa initialization
export const updateCheckoutUrl = mutation({
  args: {
    paymentId: v.id("payments"),
    checkoutUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) {
      throw new Error("Payment not found");
    }
    
    await ctx.db.patch(args.paymentId, {
      checkoutUrl: args.checkoutUrl,
      updatedAt: Date.now(),
    });
    
    return { success: true };
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

// Get payment by ID (admin only)
export const getById = query({
  args: { paymentId: v.id("payments") },
  handler: async (ctx, args) => {
    // Require authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Authentication required");
    }
    
    // Get user and verify admin role
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user || user.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }
    
    const payment = await ctx.db.get(args.paymentId);
    return payment;
  },
});

// Record a refund (admin only - derives admin from auth context)
export const recordRefund = mutation({
  args: {
    paymentId: v.id("payments"),
    refundAmount: v.number(),
    refundReason: v.string(),
    refundReference: v.string(),
    // adminUserId is no longer a public arg - derived from auth
  },
  handler: async (ctx, args) => {
    const log = createLogger("payments.recordRefund");
    
    try {
      // Require authentication and admin role
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        log.error("Refund failed - not authenticated");
        await flushLogs();
        throw new Error("Unauthorized: Authentication required");
      }
      
      const admin = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first();
      
      if (!admin || admin.role !== "admin") {
        log.error("Refund failed - not admin", { userId: identity.subject });
        await flushLogs();
        throw new Error("Unauthorized: Admin access required");
      }
      
      const adminUserId = admin.clerkId;
      log.setContext({ userId: adminUserId });
      
      log.info("Refund recording initiated", {
        paymentId: args.paymentId,
        refundAmount: args.refundAmount,
        refundReason: args.refundReason,
        refundReference: args.refundReference,
        adminUserId,
      });

      const payment = await ctx.db.get(args.paymentId);
      if (!payment) {
        log.error("Refund failed - payment not found", undefined, { paymentId: args.paymentId });
        await flushLogs();
        throw new Error("Payment not found");
      }

      // Validate payment status - only successful payments can be refunded
      if (payment.status !== "success") {
        log.error("Refund failed - invalid payment status", undefined, { 
          paymentId: args.paymentId,
          status: payment.status,
        });
        await flushLogs();
        throw new Error("Only successful payments can be refunded");
      }
      
      // Validate refund amount
      if (args.refundAmount <= 0 || args.refundAmount > payment.amount) {
        log.error("Refund failed - invalid amount", undefined, {
          paymentId: args.paymentId,
          refundAmount: args.refundAmount,
          originalAmount: payment.amount,
        });
        await flushLogs();
        throw new Error("Invalid refund amount");
      }

      log.debug("Payment found for refund", {
        paymentId: args.paymentId,
        originalAmount: payment.amount,
        paymentStatus: payment.status,
        paymentType: payment.paymentType,
      });

      // Calculate total refunded including previous refunds
      const previousRefundAmount = payment.refundAmount || 0;
      const totalRefunded = previousRefundAmount + args.refundAmount;
      
      // Determine new status based on refund amount
      const newStatus = totalRefunded >= payment.amount ? "refunded" : "partially_refunded";

      // Update payment with refund info
      await ctx.db.patch(args.paymentId, {
        status: newStatus,
        refundedAt: Date.now(),
        refundAmount: totalRefunded,
        refundReason: args.refundReason,
        refundReference: args.refundReference,
        refundedByUserId: adminUserId,
      });

      log.info("Refund recorded successfully", {
        paymentId: args.paymentId,
        originalAmount: payment.amount,
        refundAmount: args.refundAmount,
        totalRefunded,
        newStatus,
        refundReference: args.refundReference,
        adminUserId,
        txRef: payment.chapaTransactionRef,
      });

      await flushLogs();
      return { success: true };
    } catch (error) {
      log.error("Refund recording failed", error, {
        paymentId: args.paymentId,
        refundAmount: args.refundAmount,
      });
      await flushLogs();
      throw error;
    }
  },
});

// List subscription payments (admin only for refund management)
export const listSubscriptionPayments = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Require authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Authentication required");
    }
    
    // Get user and verify admin role
    const authUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!authUser || authUser.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    const limit = args.limit || 50;

    const payments = await ctx.db
      .query("payments")
      .filter((q) => q.eq(q.field("paymentType"), "subscription"))
      .order("desc")
      .take(limit);

    // Get user details for each payment
    const paymentsWithUsers = await Promise.all(
      payments.map(async (payment) => {
        // userId is stored as string in schema but represents Id<"users">
        const user = await ctx.db.get(payment.userId as Id<"users">);
        return {
          ...payment,
          user: user ? { 
            name: user.name, 
            email: user.email,
            clerkId: user.clerkId,
          } : null,
        };
      })
    );

    return paymentsWithUsers;
  },
});
