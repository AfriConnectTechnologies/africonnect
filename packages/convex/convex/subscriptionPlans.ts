import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./helpers";

/**
 * Plan limits type for feature gating
 */
export interface PlanLimits {
  maxProducts: number;
  maxMonthlyOrders: number;
  maxOriginCalculations: number;
  maxHsCodeLookups: number;
  maxTeamMembers: number;
  prioritySupport: "none" | "email" | "chat" | "dedicated";
  analytics: "basic" | "advanced" | "full" | "custom";
  apiAccess: "none" | "limited" | "full";
}

/**
 * Default plan limits for each tier
 */
export const DEFAULT_PLAN_LIMITS: Record<string, PlanLimits> = {
  starter: {
    maxProducts: 10,
    maxMonthlyOrders: 50,
    maxOriginCalculations: 5,
    maxHsCodeLookups: 10,
    maxTeamMembers: 1,
    prioritySupport: "none",
    analytics: "basic",
    apiAccess: "none",
  },
  growth: {
    maxProducts: 50,
    maxMonthlyOrders: 200,
    maxOriginCalculations: 25,
    maxHsCodeLookups: 50,
    maxTeamMembers: 3,
    prioritySupport: "email",
    analytics: "advanced",
    apiAccess: "limited",
  },
  pro: {
    maxProducts: 200,
    maxMonthlyOrders: 1000,
    maxOriginCalculations: 100,
    maxHsCodeLookups: 200,
    maxTeamMembers: 10,
    prioritySupport: "chat",
    analytics: "full",
    apiAccess: "full",
  },
  enterprise: {
    maxProducts: -1, // Unlimited
    maxMonthlyOrders: -1,
    maxOriginCalculations: -1,
    maxHsCodeLookups: -1,
    maxTeamMembers: -1,
    prioritySupport: "dedicated",
    analytics: "custom",
    apiAccess: "full",
  },
};

/**
 * List all active subscription plans (public)
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db
      .query("subscriptionPlans")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // Sort by sortOrder
    return plans.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/**
 * Get all plans including inactive (admin only)
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const plans = await ctx.db.query("subscriptionPlans").collect();
    return plans.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/**
 * Get a plan by slug (public)
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const plan = await ctx.db
      .query("subscriptionPlans")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    return plan;
  },
});

/**
 * Get a plan by ID (public)
 */
export const getById = query({
  args: { planId: v.id("subscriptionPlans") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.planId);
  },
});

/**
 * Create a new subscription plan (admin only)
 */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    targetCustomer: v.optional(v.string()),
    monthlyPrice: v.number(),
    annualPrice: v.number(),
    currency: v.string(),
    features: v.string(),
    limits: v.string(),
    isActive: v.boolean(),
    isPopular: v.optional(v.boolean()),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Validate slug format (alphanumeric and kebab-case)
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug)) {
      throw new Error("Slug must be lowercase alphanumeric with optional hyphens (kebab-case)");
    }

    // Validate prices are non-negative numbers
    if (args.monthlyPrice < 0 || args.annualPrice < 0) {
      throw new Error("Prices must be non-negative numbers");
    }
    
    // Validate annual price doesn't exceed reasonable bounds
    if (args.annualPrice > args.monthlyPrice * 12) {
      throw new Error("Annual price cannot exceed monthly price × 12");
    }

    // Validate features JSON
    try {
      const features = JSON.parse(args.features);
      if (!Array.isArray(features)) {
        throw new Error("Features must be a JSON array");
      }
    } catch (e) {
      throw new Error("Invalid features JSON: " + (e instanceof Error ? e.message : "Parse error"));
    }

    // Validate limits JSON
    try {
      JSON.parse(args.limits);
    } catch (e) {
      throw new Error("Invalid limits JSON: " + (e instanceof Error ? e.message : "Parse error"));
    }

    // Check if slug already exists
    const existing = await ctx.db
      .query("subscriptionPlans")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      throw new Error(`Plan with slug "${args.slug}" already exists`);
    }

    const now = Date.now();

    const planId = await ctx.db.insert("subscriptionPlans", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });

    return planId;
  },
});

/**
 * Update a subscription plan (admin only)
 */
export const update = mutation({
  args: {
    planId: v.id("subscriptionPlans"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    targetCustomer: v.optional(v.string()),
    monthlyPrice: v.optional(v.number()),
    annualPrice: v.optional(v.number()),
    features: v.optional(v.string()),
    limits: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    isPopular: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const { planId, ...updates } = args;
    const plan = await ctx.db.get(planId);

    if (!plan) {
      throw new Error("Plan not found");
    }

    // Filter out undefined values
    const validUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        validUpdates[key] = value;
      }
    }

    await ctx.db.patch(planId, {
      ...validUpdates,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(planId);
  },
});

/** New USD prices (cents): $29=2900, $278=27800, etc. */
const CANONICAL_USD_PRICES: Record<string, { monthlyPrice: number; annualPrice: number; targetCustomer: string }> = {
  starter: { monthlyPrice: 2900, annualPrice: 27800, targetCustomer: "Small SMBs" },
  growth: { monthlyPrice: 7900, annualPrice: 75800, targetCustomer: "Growing SMBs" },
  pro: { monthlyPrice: 14900, annualPrice: 143000, targetCustomer: "Mid-Market" },
  enterprise: { monthlyPrice: 0, annualPrice: 0, targetCustomer: "Large orgs" },
};

/**
 * Update plan prices to canonical USD (admin only). One-time migration from ETB to USD.
 * Run from the app while logged in as admin, or via Dashboard if you temporarily
 * bypass auth for the migration run.
 */
export const updatePricesToUsd = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const plans = await ctx.db.query("subscriptionPlans").collect();
    let updated = 0;
    for (const plan of plans) {
      const canonical = CANONICAL_USD_PRICES[plan.slug];
      if (canonical) {
        await ctx.db.patch(plan._id, {
          monthlyPrice: canonical.monthlyPrice,
          annualPrice: canonical.annualPrice,
          currency: "USD",
          targetCustomer: canonical.targetCustomer,
          updatedAt: Date.now(),
        });
        updated++;
      }
    }
    return { updated };
  },
});

/**
 * Delete all plans (for re-seeding)
 * Always requires admin authentication - force flag is ignored for external calls
 */
export const deleteAll = mutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx) => {
    // Always require admin for plan deletion - security first
    await requireAdmin(ctx);
    
    const existingPlans = await ctx.db.query("subscriptionPlans").collect();
    
    if (existingPlans.length === 0) {
      return { deleted: 0 };
    }
    
    // Check if any subscriptions reference these plans
    const subscriptions = await ctx.db.query("subscriptions").collect();
    const hasActiveSubscriptions = subscriptions.some(
      (sub) => sub.status === "active" || sub.status === "trialing"
    );
    
    // Prevent deletion if there are active subscriptions (data integrity)
    if (hasActiveSubscriptions) {
      throw new Error("Cannot delete plans while active subscriptions exist");
    }
    
    let deleted = 0;
    for (const plan of existingPlans) {
      await ctx.db.delete(plan._id);
      deleted++;
    }
    
    return { deleted };
  },
});

/**
 * Seed initial plans (allows initial setup, requires admin if plans exist)
 * Prices in USD (cents). Chapa checkout converts to ETB at payment time.
 */
export const seedPlans = mutation({
  args: {},
  handler: async (ctx) => {
    const existingPlans = await ctx.db.query("subscriptionPlans").collect();
    
    // If plans already exist, require admin to re-seed
    if (existingPlans.length > 0) {
      await requireAdmin(ctx);
      throw new Error("Plans already exist. Delete existing plans first.");
    }
    
    // Allow initial seeding without admin (bootstrapping)

    const now = Date.now();

    // Prices in USD (cents): $29=2900, $278=27800, etc. Annual has 20% discount.
    const plans = [
      {
        name: "Starter",
        slug: "starter",
        description: "Perfect for small businesses just getting started",
        targetCustomer: "Small SMBs",
        monthlyPrice: 2900, // $29/month
        annualPrice: 27800, // $278/year (20% off)
        currency: "USD",
        features: JSON.stringify([
          "Up to 10 products",
          "50 orders per month",
          "5 origin calculations",
          "Basic analytics",
          "Email support",
        ]),
        limits: JSON.stringify(DEFAULT_PLAN_LIMITS.starter),
        isActive: true,
        isPopular: false,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Growth",
        slug: "growth",
        description: "For growing businesses ready to scale",
        targetCustomer: "Growing SMBs",
        monthlyPrice: 7900, // $79/month
        annualPrice: 75800, // $758/year (20% off)
        currency: "USD",
        features: JSON.stringify([
          "Up to 50 products",
          "200 orders per month",
          "25 origin calculations",
          "Advanced analytics",
          "Priority email support",
          "Limited API access",
        ]),
        limits: JSON.stringify(DEFAULT_PLAN_LIMITS.growth),
        isActive: true,
        isPopular: true,
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Pro",
        slug: "pro",
        description: "Full-featured plan for established businesses",
        targetCustomer: "Mid-Market",
        monthlyPrice: 14900, // $149/month
        annualPrice: 143000, // $1,430/year (20% off)
        currency: "USD",
        features: JSON.stringify([
          "Up to 200 products",
          "1,000 orders per month",
          "100 origin calculations",
          "Full analytics suite",
          "Chat support",
          "Full API access",
          "Team collaboration",
        ]),
        limits: JSON.stringify(DEFAULT_PLAN_LIMITS.pro),
        isActive: true,
        isPopular: false,
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Enterprise",
        slug: "enterprise",
        description: "Custom solutions for large organizations",
        targetCustomer: "Large orgs",
        monthlyPrice: 0, // Custom pricing
        annualPrice: 0,
        currency: "USD",
        features: JSON.stringify([
          "Unlimited products",
          "Unlimited orders",
          "Unlimited origin calculations",
          "Custom analytics & reporting",
          "Dedicated account manager",
          "Full API access",
          "Custom integrations",
          "SLA guarantee",
        ]),
        limits: JSON.stringify(DEFAULT_PLAN_LIMITS.enterprise),
        isActive: true,
        isPopular: false,
        sortOrder: 4,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const createdIds = [];
    for (const plan of plans) {
      const id = await ctx.db.insert("subscriptionPlans", plan);
      createdIds.push(id);
    }

    return { created: createdIds.length, ids: createdIds };
  },
});

/**
 * Calculate price based on billing cycle
 */
export const calculatePrice = query({
  args: {
    planId: v.id("subscriptionPlans"),
    billingCycle: v.union(v.literal("monthly"), v.literal("annual")),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planId);
    if (!plan) {
      throw new Error("Plan not found");
    }

    const price =
      args.billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
    const savings =
      args.billingCycle === "annual"
        ? plan.monthlyPrice * 12 - plan.annualPrice
        : 0;

    // Guard against division by zero when monthlyPrice is 0 (e.g., Enterprise)
    const annualEquivalent = plan.monthlyPrice * 12;
    const savingsPercent = savings > 0 && annualEquivalent > 0 
      ? Math.round((savings / annualEquivalent) * 100) 
      : 0;
    
    return {
      price,
      currency: plan.currency,
      billingCycle: args.billingCycle,
      savings,
      savingsPercent,
    };
  },
});
