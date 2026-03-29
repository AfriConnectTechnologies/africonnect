import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { hasSellerAccess, requireSeller } from "./helpers";
import type { MutationCtx } from "./_generated/server";
import { createLogger, flushLogs } from "./lib/logger";

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

function getStockStatus(quantity: number, threshold: number): StockStatus {
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= threshold) return "low_stock";
  return "in_stock";
}

async function requireSellerForMutation(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user || !hasSellerAccess(user)) {
    throw new Error("Unauthorized: Seller access required");
  }

  return user;
}

export const list = query({
  args: {
    status: v.optional(
      v.union(v.literal("in_stock"), v.literal("low_stock"), v.literal("out_of_stock"))
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireSeller(ctx);

    const products = await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("sellerId", user.clerkId))
      .collect();

    const enriched = products.map((product) => {
      const threshold = product.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
      const stockStatus = getStockStatus(product.quantity, threshold);
      return {
        ...product,
        lowStockThreshold: threshold,
        stockStatus,
        stockValue: product.quantity * product.price,
      };
    });

    const filtered = args.status
      ? enriched.filter((item) => item.stockStatus === args.status)
      : enriched;

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const getTransactions = query({
  args: {
    productId: v.optional(v.id("products")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireSeller(ctx);

    let transactions;
    const productId = args.productId;
    if (productId !== undefined) {
      const product = await ctx.db.get(productId);
      if (!product || product.sellerId !== user.clerkId) {
        throw new Error("Unauthorized");
      }

      transactions = await ctx.db
        .query("inventoryTransactions")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .collect();
    } else {
      transactions = await ctx.db
        .query("inventoryTransactions")
        .withIndex("by_seller", (q) => q.eq("sellerId", user.clerkId))
        .collect();
    }

    const sorted = transactions.sort((a, b) => b.createdAt - a.createdAt);
    const limit = args.limit && args.limit > 0 ? args.limit : 50;
    const sliced = sorted.slice(0, limit);

    const withProducts = await Promise.all(
      sliced.map(async (tx) => {
        const product = await ctx.db.get(tx.productId);
        return {
          ...tx,
          productName: product?.name ?? null,
          productSku: product?.sku ?? null,
        };
      })
    );

    return withProducts;
  },
});

export const adjustStock = mutation({
  args: {
    productId: v.id("products"),
    delta: v.number(),
    reason: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal("restock"),
        v.literal("adjustment"),
        v.literal("return"),
        v.literal("correction")
      )
    ),
  },
  handler: async (ctx, args) => {
    const log = createLogger("inventory.adjustStock");

    try {
      const user = await requireSellerForMutation(ctx);
      log.setContext({ userId: user.clerkId });

      if (args.delta === 0) {
        throw new Error("Adjustment must be non-zero");
      }

      const product = await ctx.db.get(args.productId);
      if (!product || product.sellerId !== user.clerkId) {
        throw new Error("Unauthorized");
      }

      const previousQuantity = product.quantity;
      const newQuantity = previousQuantity + args.delta;

      if (newQuantity < 0) {
        throw new Error("Insufficient stock for this adjustment");
      }

      const now = Date.now();
      await ctx.db.patch(args.productId, {
        quantity: newQuantity,
        updatedAt: now,
      });

      const direction = args.delta > 0 ? "in" : "out";
      const type =
        args.type ?? (args.delta > 0 ? "restock" : "adjustment");

      await ctx.db.insert("inventoryTransactions", {
        productId: args.productId,
        sellerId: product.sellerId,
        type,
        direction,
        quantity: Math.abs(args.delta),
        previousQuantity,
        newQuantity,
        reason: args.reason,
        createdBy: user._id,
        createdAt: now,
      });

      log.info("Inventory adjusted", {
        productId: args.productId,
        delta: args.delta,
        previousQuantity,
        newQuantity,
        type,
        direction,
      });

      await flushLogs();
      return await ctx.db.get(args.productId);
    } catch (error) {
      log.error("Inventory adjustment failed", error, {
        productId: args.productId,
        delta: args.delta,
      });
      await flushLogs();
      throw error;
    }
  },
});

export const updateThresholds = mutation({
  args: {
    productId: v.id("products"),
    lowStockThreshold: v.optional(v.number()),
    reorderQuantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const log = createLogger("inventory.updateThresholds");

    try {
      const user = await requireSellerForMutation(ctx);
      log.setContext({ userId: user.clerkId });

      const product = await ctx.db.get(args.productId);
      if (!product || product.sellerId !== user.clerkId) {
        throw new Error("Unauthorized");
      }

      if (args.lowStockThreshold !== undefined && args.lowStockThreshold < 0) {
        throw new Error("Low stock threshold must be 0 or greater");
      }
      if (args.reorderQuantity !== undefined && args.reorderQuantity < 0) {
        throw new Error("Reorder quantity must be 0 or greater");
      }

      await ctx.db.patch(args.productId, {
        lowStockThreshold: args.lowStockThreshold ?? product.lowStockThreshold,
        reorderQuantity: args.reorderQuantity ?? product.reorderQuantity,
        updatedAt: Date.now(),
      });

      log.info("Inventory thresholds updated", {
        productId: args.productId,
        lowStockThreshold: args.lowStockThreshold,
        reorderQuantity: args.reorderQuantity,
      });

      await flushLogs();
      return await ctx.db.get(args.productId);
    } catch (error) {
      log.error("Update thresholds failed", error, { productId: args.productId });
      await flushLogs();
      throw error;
    }
  },
});
