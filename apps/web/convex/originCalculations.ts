import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./helpers";
import { createLogger, flushLogs } from "./lib/logger";

// Save a new origin calculation (AfCFTA offered free for all sellers and buyers - no plan limit)
export const saveOriginCalculation = mutation({
  args: {
    productId: v.optional(v.id("businessProducts")),
    productName: v.string(),
    costOfMaterials: v.number(),
    laborCosts: v.number(),
    factoryOverheads: v.number(),
    profitMargin: v.number(),
    nonOriginatingMaterials: v.number(),
    vnmDetails: v.optional(v.string()),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const log = createLogger("originCalculations.saveOriginCalculation");
    
    try {
      log.info("Origin calculation initiated", {
        productName: args.productName,
        currency: args.currency,
        hasProductId: !!args.productId,
      });

      const user = await requireUser(ctx);
      log.setContext({ userId: user.clerkId, businessId: user.businessId });

      if (!user.businessId) {
        log.warn("Origin calculation failed - no business registered");
        await flushLogs();
        throw new Error("You don't have a registered business");
      }

      // AfCFTA is free for all - no subscription/plan limit on origin calculations

      // Calculate EXW and VNM percentage
      const exWorksPrice =
        args.costOfMaterials +
        args.laborCosts +
        args.factoryOverheads +
        args.profitMargin;

      if (exWorksPrice <= 0) {
        log.error("Origin calculation failed - invalid EXW price", undefined, {
          exWorksPrice,
          costOfMaterials: args.costOfMaterials,
          laborCosts: args.laborCosts,
        });
        await flushLogs();
        throw new Error("Ex-Works price must be greater than zero");
      }

      const vnmPercentage = (args.nonOriginatingMaterials / exWorksPrice) * 100;
      const isEligible = vnmPercentage <= 60;

      const calculationId = await ctx.db.insert("originCalculations", {
        businessId: user.businessId,
        productId: args.productId,
        productName: args.productName,
        costOfMaterials: args.costOfMaterials,
        laborCosts: args.laborCosts,
        factoryOverheads: args.factoryOverheads,
        profitMargin: args.profitMargin,
        exWorksPrice,
        nonOriginatingMaterials: args.nonOriginatingMaterials,
        vnmDetails: args.vnmDetails,
        vnmPercentage: Math.round(vnmPercentage * 100) / 100, // Round to 2 decimal places
        isEligible,
        currency: args.currency,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      log.info("Origin calculation saved successfully", {
        calculationId,
        productName: args.productName,
        exWorksPrice,
        vnmPercentage: Math.round(vnmPercentage * 100) / 100,
        nonOriginatingMaterials: args.nonOriginatingMaterials,
        isEligible,
        currency: args.currency,
      });

      await flushLogs();
      return await ctx.db.get(calculationId);
    } catch (error) {
      log.error("Origin calculation failed", error, {
        productName: args.productName,
        currency: args.currency,
      });
      await flushLogs();
      throw error;
    }
  },
});

// Update an existing origin calculation
export const updateOriginCalculation = mutation({
  args: {
    calculationId: v.id("originCalculations"),
    productId: v.optional(v.id("businessProducts")),
    productName: v.string(),
    costOfMaterials: v.number(),
    laborCosts: v.number(),
    factoryOverheads: v.number(),
    profitMargin: v.number(),
    nonOriginatingMaterials: v.number(),
    vnmDetails: v.optional(v.string()),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (!user.businessId) {
      throw new Error("You don't have a registered business");
    }

    const calculation = await ctx.db.get(args.calculationId);
    if (!calculation) {
      throw new Error("Calculation not found");
    }

    // Ensure the calculation belongs to the user's business
    if (calculation.businessId !== user.businessId) {
      throw new Error("Unauthorized: You can only update your own calculations");
    }

    // Calculate EXW and VNM percentage
    const exWorksPrice =
      args.costOfMaterials +
      args.laborCosts +
      args.factoryOverheads +
      args.profitMargin;

    if (exWorksPrice <= 0) {
      throw new Error("Ex-Works price must be greater than zero");
    }

    const vnmPercentage = (args.nonOriginatingMaterials / exWorksPrice) * 100;
    const isEligible = vnmPercentage <= 60;

    await ctx.db.patch(args.calculationId, {
      productId: args.productId,
      productName: args.productName,
      costOfMaterials: args.costOfMaterials,
      laborCosts: args.laborCosts,
      factoryOverheads: args.factoryOverheads,
      profitMargin: args.profitMargin,
      exWorksPrice,
      nonOriginatingMaterials: args.nonOriginatingMaterials,
      vnmDetails: args.vnmDetails,
      vnmPercentage: Math.round(vnmPercentage * 100) / 100,
      isEligible,
      currency: args.currency,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.calculationId);
  },
});

// Delete an origin calculation
export const deleteOriginCalculation = mutation({
  args: {
    calculationId: v.id("originCalculations"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (!user.businessId) {
      throw new Error("You don't have a registered business");
    }

    const calculation = await ctx.db.get(args.calculationId);
    if (!calculation) {
      throw new Error("Calculation not found");
    }

    // Ensure the calculation belongs to the user's business
    if (calculation.businessId !== user.businessId) {
      throw new Error("Unauthorized: You can only delete your own calculations");
    }

    await ctx.db.delete(args.calculationId);
    return { success: true };
  },
});

// Get all origin calculations for the current user's business
export const getMyOriginCalculations = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    if (!user.businessId) {
      return [];
    }

    const calculations = await ctx.db
      .query("originCalculations")
      .withIndex("by_business", (q) => q.eq("businessId", user.businessId!))
      .collect();

    return calculations.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get a single origin calculation by ID
export const getOriginCalculation = query({
  args: {
    calculationId: v.id("originCalculations"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const calculation = await ctx.db.get(args.calculationId);
    if (!calculation) {
      return null;
    }

    // Check if user has access to this calculation
    if (calculation.businessId !== user.businessId) {
      return null;
    }

    return calculation;
  },
});

// Get origin calculations summary for current user's business
export const getOriginCalculationsSummary = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    if (!user.businessId) {
      return {
        totalCalculations: 0,
        eligibleCount: 0,
        notEligibleCount: 0,
        hasCalculations: false,
      };
    }

    const calculations = await ctx.db
      .query("originCalculations")
      .withIndex("by_business", (q) => q.eq("businessId", user.businessId!))
      .collect();

    const eligibleCount = calculations.filter((c) => c.isEligible).length;
    const notEligibleCount = calculations.filter((c) => !c.isEligible).length;

    return {
      totalCalculations: calculations.length,
      eligibleCount,
      notEligibleCount,
      hasCalculations: calculations.length > 0,
    };
  },
});

// Check if current user has any origin calculations
export const hasOriginCalculations = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    if (!user.businessId) {
      return false;
    }

    const calculation = await ctx.db
      .query("originCalculations")
      .withIndex("by_business", (q) => q.eq("businessId", user.businessId!))
      .first();

    return calculation !== null;
  },
});
