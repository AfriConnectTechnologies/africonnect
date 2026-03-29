import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOrCreateUser, requireVerifiedBusinessForBuying } from "./helpers";
import { createLogger, flushLogs } from "./lib/logger";

export const get = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return [];
    }

    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Fetch product details for each cart item
    const cartWithProducts = await Promise.all(
      cartItems.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        return {
          ...item,
          product,
        };
      })
    );

    return cartWithProducts.filter((item) => item.product !== null);
  },
});

export const add = mutation({
  args: {
    productId: v.id("products"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const log = createLogger("cart.add");
    
    try {
      log.info("Add to cart initiated", {
        productId: args.productId,
        quantity: args.quantity,
      });

      // Validate quantity is positive (same check as update mutation)
      if (args.quantity <= 0) {
        log.warn("Add to cart failed - non-positive quantity", {
          productId: args.productId,
          quantity: args.quantity,
        });
        await flushLogs();
        throw new Error("Quantity must be greater than zero");
      }

      const user = await getOrCreateUser(ctx);
      log.setContext({ userId: user.clerkId });
      await requireVerifiedBusinessForBuying(ctx.db, user);

      const product = await ctx.db.get(args.productId);
      if (!product) {
        log.error("Add to cart failed - product not found", undefined, {
          productId: args.productId,
        });
        await flushLogs();
        throw new Error("Product not found");
      }

      // Check if user is trying to buy their own product
      // sellerId can be either clerkId (correct) or Convex _id (legacy/mobile data)
      const isOwnProduct = product.sellerId === user.clerkId || product.sellerId === user._id;
      
      // DEBUG: Log IDs for self-purchase check
      console.log("[DEBUG ADD TO CART] Self-purchase check:", {
        productId: args.productId,
        productName: product.name,
        productSellerId: product.sellerId,
        buyerClerkId: user.clerkId,
        buyerConvexId: user._id,
        isOwnProduct,
      });

      if (isOwnProduct) {
        log.warn("Add to cart failed - user tried to buy own product", {
          productId: args.productId,
          productName: product.name,
          productSellerId: product.sellerId,
        });
        await flushLogs();
        throw new Error("You can't purchase your own products. This item belongs to you!");
      }

      if (product.status !== "active") {
        log.warn("Add to cart failed - product not active", {
          productId: args.productId,
          productName: product.name,
          productStatus: product.status,
        });
        await flushLogs();
        throw new Error("Sorry, this product is no longer available for purchase");
      }

      if (product.isOrderable === false) {
        log.warn("Add to cart failed - product marked non-orderable", {
          productId: args.productId,
          productName: product.name,
        });
        await flushLogs();
        throw new Error("Sorry, this product is not available for purchase");
      }

      if (args.quantity > product.quantity) {
        log.warn("Add to cart failed - insufficient stock", {
          productId: args.productId,
          requestedQty: args.quantity,
          availableQty: product.quantity,
        });
        await flushLogs();
        throw new Error(`Only ${product.quantity} items available in stock`);
      }

      // Check if item already exists in cart
      const existingItem = await ctx.db
        .query("cartItems")
        .withIndex("by_user_product", (q) =>
          q.eq("userId", user._id).eq("productId", args.productId)
        )
        .first();

      const now = Date.now();

      if (existingItem) {
        const newQuantity = existingItem.quantity + args.quantity;
        if (newQuantity > product.quantity) {
          log.warn("Add to cart failed - total quantity exceeds stock", {
            productId: args.productId,
            existingQty: existingItem.quantity,
            additionalQty: args.quantity,
            availableQty: product.quantity,
          });
          await flushLogs();
          throw new Error(`Only ${product.quantity} items available in stock`);
        }
        await ctx.db.patch(existingItem._id, {
          quantity: newQuantity,
          updatedAt: now,
        });

        log.info("Cart item quantity updated", {
          cartItemId: existingItem._id,
          productId: args.productId,
          productName: product.name,
          previousQty: existingItem.quantity,
          newQty: newQuantity,
        });

        await flushLogs();
        return await ctx.db.get(existingItem._id);
      } else {
        const cartItemId = await ctx.db.insert("cartItems", {
          userId: user._id,
          productId: args.productId,
          quantity: args.quantity,
          createdAt: now,
          updatedAt: now,
        });

        log.info("New item added to cart", {
          cartItemId,
          productId: args.productId,
          productName: product.name,
          quantity: args.quantity,
          price: product.price,
        });

        await flushLogs();
        return await ctx.db.get(cartItemId);
      }
    } catch (error) {
      // Don't duplicate logging - errors are already logged at the point of failure
      // Just re-throw to propagate the error
      throw error;
    }
  },
});

export const update = mutation({
  args: {
    id: v.id("cartItems"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateUser(ctx);

    const cartItem = await ctx.db.get(args.id);
    if (!cartItem) {
      throw new Error("Cart item not found");
    }

    if (cartItem.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    if (args.quantity <= 0) {
      await ctx.db.delete(args.id);
      return null;
    }

    const product = await ctx.db.get(cartItem.productId);
    if (!product) {
      throw new Error("Product not found");
    }

    if (product.isOrderable === false) {
      throw new Error("Sorry, this product is not available for purchase");
    }

    if (args.quantity > product.quantity) {
      throw new Error(`Only ${product.quantity} items available in stock`);
    }

    await ctx.db.patch(args.id, {
      quantity: args.quantity,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});

export const remove = mutation({
  args: { id: v.id("cartItems") },
  handler: async (ctx, args) => {
    const user = await getOrCreateUser(ctx);

    const cartItem = await ctx.db.get(args.id);
    if (!cartItem) {
      throw new Error("Cart item not found");
    }

    if (cartItem.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
  },
});

export const clear = mutation({
  handler: async (ctx) => {
    const user = await getOrCreateUser(ctx);

    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    await Promise.all(cartItems.map((item) => ctx.db.delete(item._id)));
  },
});
