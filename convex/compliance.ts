import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./helpers";
import { createLogger, flushLogs } from "./lib/logger";

// Add a product to a business with HS code compliance info
export const addBusinessProduct = mutation({
  args: {
    hsCode: v.string(),
    productName: v.string(),
    productNameAmharic: v.optional(v.string()),
    isCompliant: v.boolean(),
    currentRate: v.optional(v.string()),
    rates: v.optional(v.string()), // JSON string of rates
    country: v.optional(v.string()), // "ethiopia" or "kenya" (EAC)
    tariffCategory: v.optional(v.string()),
    tariffScheduleStatus: v.optional(
      v.union(v.literal("matched"), v.literal("not_matched"))
    ),
    tariffSource: v.optional(v.string()),
    tariffBaseRate: v.optional(v.string()),
    tariffUnit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const log = createLogger("compliance.addBusinessProduct");
    
    try {
      log.info("Adding business product with HS code", {
        hsCode: args.hsCode,
        productName: args.productName,
        isCompliant: args.isCompliant,
      });

      const user = await requireUser(ctx);
      log.setContext({ userId: user.clerkId, businessId: user.businessId });

      if (!user.businessId) {
        log.warn("Add business product failed - no business registered");
        await flushLogs();
        throw new Error("You don't have a registered business");
      }

      // Check if this HS code already exists for this business (same country)
      const existingProduct = await ctx.db
        .query("businessProducts")
        .withIndex("by_business_hs", (q) =>
          q.eq("businessId", user.businessId!).eq("hsCode", args.hsCode)
        )
      .filter((q) => q.eq(q.field("country"), args.country || "ethiopia"))
        .first();

      if (existingProduct) {
        log.warn("Add business product failed - HS code already exists", {
          hsCode: args.hsCode,
          existingProductId: existingProduct._id,
        });
        await flushLogs();
        throw new Error("This HS code is already added to your business for this country");
      }

      const productId = await ctx.db.insert("businessProducts", {
        businessId: user.businessId,
        hsCode: args.hsCode,
        productName: args.productName,
        productNameAmharic: args.productNameAmharic,
        isCompliant: args.isCompliant,
        currentRate: args.currentRate,
        rates: args.rates,
        country: args.country || "ethiopia",
        tariffCategory: args.tariffCategory,
        tariffScheduleStatus: args.tariffScheduleStatus,
        tariffSource: args.tariffSource,
        tariffBaseRate: args.tariffBaseRate,
        tariffUnit: args.tariffUnit,
        createdAt: Date.now(),
      });

      log.info("Business product added successfully", {
        businessProductId: productId,
        hsCode: args.hsCode,
        productName: args.productName,
        isCompliant: args.isCompliant,
      });

      await flushLogs();
      return await ctx.db.get(productId);
    } catch (error) {
      log.error("Add business product failed", error, {
        hsCode: args.hsCode,
        productName: args.productName,
      });
      await flushLogs();
      throw error;
    }
  },
});

// Remove a product from a business
export const removeBusinessProduct = mutation({
  args: {
    productId: v.id("businessProducts"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (!user.businessId) {
      throw new Error("You don't have a registered business");
    }

    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new Error("Product not found");
    }

    // Ensure the product belongs to the user's business
    if (product.businessId !== user.businessId) {
      throw new Error("Unauthorized: You can only remove your own products");
    }

    await ctx.db.delete(args.productId);
    return { success: true };
  },
});

// Get all products for the current user's business
export const getMyBusinessProducts = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    if (!user.businessId) {
      return [];
    }

    const products = await ctx.db
      .query("businessProducts")
      .withIndex("by_business", (q) => q.eq("businessId", user.businessId!))
      .collect();

    return products.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get products for a specific business (for admin or public view)
export const getBusinessProducts = query({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("businessProducts")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    return products.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get compliance summary for current user's business
export const getComplianceSummary = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    if (!user.businessId) {
      return {
        totalProducts: 0,
        matchedScheduleProducts: 0,
        unmatchedScheduleProducts: 0,
        hasCompletedCheck: false,
      };
    }

    const products = await ctx.db
      .query("businessProducts")
      .withIndex("by_business", (q) => q.eq("businessId", user.businessId!))
      .collect();

    const matchedScheduleProducts = products.filter(
      (p) => (p.tariffScheduleStatus || (p.isCompliant ? "matched" : "not_matched")) === "matched"
    );
    const unmatchedScheduleProducts = products.filter(
      (p) => (p.tariffScheduleStatus || (p.isCompliant ? "matched" : "not_matched")) !== "matched"
    );

    return {
      totalProducts: products.length,
      matchedScheduleProducts: matchedScheduleProducts.length,
      unmatchedScheduleProducts: unmatchedScheduleProducts.length,
      hasCompletedCheck: products.length > 0,
    };
  },
});

// Check if current user has completed compliance check
export const hasCompletedComplianceCheck = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    if (!user.businessId) {
      return false;
    }

    const products = await ctx.db
      .query("businessProducts")
      .withIndex("by_business", (q) => q.eq("businessId", user.businessId!))
      .first();

    return products !== null;
  },
});
