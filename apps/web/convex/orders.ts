import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOrCreateUser } from "./helpers";
import { createLogger, flushLogs } from "./lib/logger";

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
    const isSeller = order.sellerId === user.clerkId;

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
    const log = createLogger("orders.create");
    
    try {
      log.info("Order creation initiated", {
        title: args.title,
        customer: args.customer,
        amount: args.amount,
        status: args.status ?? "pending",
      });

      const user = await getOrCreateUser(ctx);
      log.setContext({ userId: user.clerkId });

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

      log.info("Order created successfully", {
        orderId,
        title: args.title,
        amount: args.amount,
        status: args.status ?? "pending",
      });

      await flushLogs();
      return await ctx.db.get(orderId);
    } catch (error) {
      log.error("Order creation failed", error, {
        title: args.title,
        amount: args.amount,
      });
      await flushLogs();
      throw error;
    }
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
    const log = createLogger("orders.update");
    
    try {
      log.info("Order update initiated", {
        orderId: args.id,
        updates: {
          title: args.title,
          customer: args.customer,
          amount: args.amount,
          status: args.status,
        },
      });

      const identity = await ctx.auth.getUserIdentity();
      if (identity === null) {
        log.warn("Order update failed - not authenticated", { orderId: args.id });
        await flushLogs();
        throw new Error("Not authenticated");
      }

      log.setContext({ userId: identity.subject });

      const order = await ctx.db.get(args.id);
      if (!order) {
        log.error("Order update failed - order not found", undefined, { orderId: args.id });
        await flushLogs();
        throw new Error("Order not found");
      }

      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first();

      if (!user || order.userId !== user._id) {
        log.warn("Order update failed - unauthorized", {
          orderId: args.id,
          orderOwnerId: order.userId,
          requestingUserId: user?._id,
        });
        await flushLogs();
        throw new Error("Unauthorized");
      }

      const previousStatus = order.status;
      
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, ...updates } = args;
      await ctx.db.patch(args.id, {
        ...updates,
        updatedAt: Date.now(),
      });

      log.info("Order updated successfully", {
        orderId: args.id,
        previousStatus,
        newStatus: args.status || previousStatus,
        fieldsUpdated: Object.keys(updates).filter(k => updates[k as keyof typeof updates] !== undefined),
      });

      await flushLogs();
      return await ctx.db.get(args.id);
    } catch (error) {
      log.error("Order update failed", error, { orderId: args.id });
      await flushLogs();
      throw error;
    }
  },
});

export const remove = mutation({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    const log = createLogger("orders.remove");
    
    try {
      log.info("Order removal initiated", { orderId: args.id });

      const identity = await ctx.auth.getUserIdentity();
      if (identity === null) {
        log.warn("Order removal failed - not authenticated", { orderId: args.id });
        await flushLogs();
        throw new Error("Not authenticated");
      }

      log.setContext({ userId: identity.subject });

      const order = await ctx.db.get(args.id);
      if (!order) {
        log.error("Order removal failed - order not found", undefined, { orderId: args.id });
        await flushLogs();
        throw new Error("Order not found");
      }

      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first();

      if (!user) {
        log.warn("Order removal failed - user not found");
        await flushLogs();
        throw new Error("Unauthorized");
      }

      // Only buyer can delete their order (and only if pending)
      const isBuyer = order.userId === user._id || order.buyerId === user._id;
      if (!isBuyer || order.status !== "pending") {
        log.warn("Order removal failed - unauthorized or wrong status", {
          orderId: args.id,
          isBuyer,
          orderStatus: order.status,
        });
        await flushLogs();
        throw new Error("Unauthorized");
      }

      // Delete order items first
      const orderItems = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", args.id))
        .collect();

      await Promise.all(orderItems.map((item) => ctx.db.delete(item._id)));

      await ctx.db.delete(args.id);

      log.info("Order removed successfully", {
        orderId: args.id,
        orderAmount: order.amount,
        itemsDeleted: orderItems.length,
      });

      await flushLogs();
    } catch (error) {
      log.error("Order removal failed", error, { orderId: args.id });
      await flushLogs();
      throw error;
    }
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
          q.eq("sellerId", user.clerkId).eq("status", args.status!)
        )
        .collect();
    } else {
      orders = await ctx.db
        .query("orders")
        .withIndex("by_seller", (q) => q.eq("sellerId", user.clerkId))
        .collect();
    }

    return orders.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Mark an order completed by the seller (seller only)
export const completeBySeller = mutation({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    const log = createLogger("orders.completeBySeller");

    try {
      const identity = await ctx.auth.getUserIdentity();
      if (identity === null) {
        throw new Error("Not authenticated");
      }

      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first();

      if (!user) {
        throw new Error("Unauthorized");
      }

      const order = await ctx.db.get(args.id);
      if (!order) {
        throw new Error("Order not found");
      }

      if (order.sellerId !== user.clerkId) {
        throw new Error("Unauthorized");
      }

      if (order.status === "cancelled") {
        throw new Error("Cannot complete a cancelled order");
      }

      if (order.status === "completed") {
        return order;
      }

      await ctx.db.patch(args.id, {
        status: "completed",
        updatedAt: Date.now(),
      });

      log.info("Order marked completed by seller", {
        orderId: args.id,
        sellerId: user.clerkId,
      });

      await flushLogs();
      return await ctx.db.get(args.id);
    } catch (error) {
      log.error("Order completion by seller failed", error, { orderId: args.id });
      await flushLogs();
      throw error;
    }
  },
});

export const checkout = mutation({
  handler: async (ctx) => {
    const log = createLogger("orders.checkout");
    
    try {
      log.info("Checkout initiated");

      const user = await getOrCreateUser(ctx);
      log.setContext({ userId: user.clerkId });

      // Get cart items
      const cartItems = await ctx.db
        .query("cartItems")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      log.debug("Cart items retrieved", { itemCount: cartItems.length });

      if (cartItems.length === 0) {
        log.warn("Checkout failed - empty cart");
        await flushLogs();
        throw new Error("Cart is empty");
      }

      // Group cart items by seller
      const itemsBySeller = new Map<string, typeof cartItems>();
      for (const cartItem of cartItems) {
        const product = await ctx.db.get(cartItem.productId);
        if (!product) {
          log.error("Checkout failed - product not found", undefined, {
            productId: cartItem.productId,
          });
          await flushLogs();
          throw new Error("Product not found");
        }
        if (product.status !== "active") {
          log.warn("Checkout failed - inactive product", {
            productId: cartItem.productId,
            productName: product.name,
            productStatus: product.status,
          });
          await flushLogs();
          throw new Error(`Product ${product.name} is no longer available`);
        }
        if (cartItem.quantity > product.quantity) {
          log.warn("Checkout failed - insufficient stock", {
            productId: cartItem.productId,
            productName: product.name,
            requestedQty: cartItem.quantity,
            availableQty: product.quantity,
          });
          await flushLogs();
          throw new Error(`Insufficient stock for ${product.name}`);
        }

        const sellerId = product.sellerId;
        
        if (!itemsBySeller.has(sellerId)) {
          itemsBySeller.set(sellerId, []);
        }
        itemsBySeller.get(sellerId)!.push(cartItem);
      }

      log.debug("Cart items grouped by seller", {
        sellerCount: itemsBySeller.size,
        totalItems: cartItems.length,
      });

      const now = Date.now();
      const createdOrders = [];
      let totalOrderValue = 0;

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

        // Get seller info for order title (sellerId is stored as clerkId)
        const seller = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", sellerId))
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

        log.info("Order created during checkout", {
          orderId,
          sellerId,
          sellerName,
          itemCount: items.length,
          totalAmount,
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

            await ctx.db.insert("inventoryTransactions", {
              productId: item.productId,
              sellerId: product.sellerId,
              type: "sale",
              direction: "out",
              quantity: item.quantity,
              previousQuantity: product.quantity,
              newQuantity: product.quantity - item.quantity,
              reference: orderId,
              createdBy: user._id,
              createdAt: now,
            });

            log.debug("Product quantity updated", {
              productId: item.productId,
              previousQty: product.quantity,
              soldQty: item.quantity,
              newQty: product.quantity - item.quantity,
            });
          }
        }

        // Delete cart items
        for (const cartItem of items) {
          await ctx.db.delete(cartItem._id);
        }

        const order = await ctx.db.get(orderId);
        createdOrders.push(order);
        totalOrderValue += totalAmount;
      }

      log.info("Checkout completed successfully", {
        ordersCreated: createdOrders.length,
        totalOrderValue,
        itemsProcessed: cartItems.length,
        sellersInvolved: itemsBySeller.size,
      });

      await flushLogs();
      return createdOrders;
    } catch (error) {
      log.error("Checkout failed", error);
      await flushLogs();
      throw error;
    }
  },
});
