import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOrCreateUser } from "./helpers";

export const get = query({
  handler: async (ctx) => {
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
    const user = await getOrCreateUser(ctx);

    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new Error("Product not found");
    }

    if (product.sellerId === user._id) {
      throw new Error("You can't purchase your own products. This item belongs to you!");
    }

    if (product.status !== "active") {
      throw new Error("Sorry, this product is no longer available for purchase");
    }

    if (args.quantity > product.quantity) {
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
        throw new Error(`Only ${product.quantity} items available in stock`);
      }
      await ctx.db.patch(existingItem._id, {
        quantity: newQuantity,
        updatedAt: now,
      });
      return await ctx.db.get(existingItem._id);
    } else {
      const cartItemId = await ctx.db.insert("cartItems", {
        userId: user._id,
        productId: args.productId,
        quantity: args.quantity,
        createdAt: now,
        updatedAt: now,
      });
      return await ctx.db.get(cartItemId);
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
