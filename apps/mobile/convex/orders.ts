import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOrCreateUser } from "./helpers";

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
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

    let ordersQuery = ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", user._id));

    if (args.status) {
      const status = args.status;
      ordersQuery = ctx.db
        .query("orders")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", user._id).eq("status", status)
        );
    }

    const orders = await ordersQuery.collect();
    return orders.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const get = query({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    const order = await ctx.db.get(args.id);
    if (!order) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("Unauthorized");
    }

    // Check if user is buyer or seller
    const isBuyer = order.userId === user._id || order.buyerId === user._id;
    const isSeller = order.sellerId === user._id;

    if (!isBuyer && !isSeller) {
      throw new Error("Unauthorized");
    }

    // Fetch order items
    const orderItems = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.id))
      .collect();

    const itemsWithProducts = await Promise.all(
      orderItems.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        return {
          ...item,
          product,
        };
      })
    );

    return {
      ...order,
      items: itemsWithProducts,
    };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    customer: v.string(),
    amount: v.number(),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("cancelled")
      )
    ),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateUser(ctx);

    const now = Date.now();
    const orderId = await ctx.db.insert("orders", {
      userId: user._id,
      title: args.title,
      customer: args.customer,
      amount: args.amount,
      status: args.status ?? "pending",
      description: args.description,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(orderId);
  },
});

export const update = mutation({
  args: {
    id: v.id("orders"),
    title: v.optional(v.string()),
    customer: v.optional(v.string()),
    amount: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("cancelled")
      )
    ),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    const order = await ctx.db.get(args.id);
    if (!order) {
      throw new Error("Order not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || order.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...updates } = args;
    await ctx.db.patch(args.id, {
      ...updates,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});

export const remove = mutation({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    const order = await ctx.db.get(args.id);
    if (!order) {
      throw new Error("Order not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("Unauthorized");
    }

    // Only buyer can delete their order (and only if pending)
    const isBuyer = order.userId === user._id || order.buyerId === user._id;
    if (!isBuyer || order.status !== "pending") {
      throw new Error("Unauthorized");
    }

    // Delete order items first
    const orderItems = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.id))
      .collect();

    await Promise.all(orderItems.map((item) => ctx.db.delete(item._id)));

    await ctx.db.delete(args.id);
  },
});

export const purchases = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
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

    let orders;

    if (args.status) {
      orders = await ctx.db
        .query("orders")
        .withIndex("by_buyer_status", (q) =>
          q.eq("buyerId", user._id).eq("status", args.status!)
        )
        .collect();
    } else {
      orders = await ctx.db
        .query("orders")
        .withIndex("by_buyer", (q) => q.eq("buyerId", user._id))
        .collect();
    }

    return orders.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const sales = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
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

    let orders;

    if (args.status) {
      orders = await ctx.db
        .query("orders")
        .withIndex("by_seller_status", (q) =>
          q.eq("sellerId", user._id).eq("status", args.status!)
        )
        .collect();
    } else {
      orders = await ctx.db
        .query("orders")
        .withIndex("by_seller", (q) => q.eq("sellerId", user._id))
        .collect();
    }

    return orders.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const checkout = mutation({
  handler: async (ctx) => {
    const user = await getOrCreateUser(ctx);

    // Get cart items
    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (cartItems.length === 0) {
      throw new Error("Cart is empty");
    }

    // Group cart items by seller
    const itemsBySeller = new Map<string, typeof cartItems>();
    for (const cartItem of cartItems) {
      const product = await ctx.db.get(cartItem.productId);
      if (!product) {
        throw new Error("Product not found");
      }
      if (product.status !== "active") {
        throw new Error(`Product ${product.name} is no longer available`);
      }
      if (cartItem.quantity > product.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      const sellerId = product.sellerId;
      if (!itemsBySeller.has(sellerId)) {
        itemsBySeller.set(sellerId, []);
      }
      itemsBySeller.get(sellerId)!.push(cartItem);
    }

    const now = Date.now();
    const createdOrders = [];

    // Create one order per seller
    for (const [sellerId, items] of itemsBySeller.entries()) {
      let totalAmount = 0;
      const orderItems = [];

      // Calculate total and prepare order items
      for (const cartItem of items) {
        const product = await ctx.db.get(cartItem.productId);
        if (!product) continue;

        const itemTotal = product.price * cartItem.quantity;
        totalAmount += itemTotal;

        orderItems.push({
          productId: cartItem.productId,
          quantity: cartItem.quantity,
          price: product.price,
        });
      }

      // Get seller info for order title
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
        status: "pending",
        description: `Order containing ${items.length} item(s)`,
        createdAt: now,
        updatedAt: now,
      });

      // Create order items and update product quantities
      for (const item of orderItems) {
        await ctx.db.insert("orderItems", {
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          createdAt: now,
        });

        // Update product quantity
        const product = await ctx.db.get(item.productId);
        if (product) {
          await ctx.db.patch(item.productId, {
            quantity: product.quantity - item.quantity,
            updatedAt: now,
          });
        }
      }

      // Delete cart items
      for (const cartItem of items) {
        await ctx.db.delete(cartItem._id);
      }

      const order = await ctx.db.get(orderId);
      createdOrders.push(order);
    }

    return createdOrders;
  },
});

