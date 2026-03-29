import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, requireAdmin, getCurrentUser } from "./helpers";
import { PlanLimits, DEFAULT_PLAN_LIMITS } from "./subscriptionPlans";
import { createLogger, flushLogs } from "./lib/logger";

/**
 * Get the current user's business subscription
 */
export const getCurrentSubscription = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.businessId) {
      return null;
    }

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_business", (q) => q.eq("businessId", user.businessId!))
      .first();

    if (!subscription) {
      return null;
    }

    // Get plan details
    const plan = await ctx.db.get(subscription.planId);

    return {
      ...subscription,
      plan,
    };
  },
});

/**
 * Get subscription by business ID
 */
export const getByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    if (!subscription) {
      return null;
    }

    const plan = await ctx.db.get(subscription.planId);

    return {
      ...subscription,
      plan,
    };
  },
});

/**
 * Get subscription by ID
 */
export const getById = query({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) return null;

    const plan = await ctx.db.get(subscription.planId);
    return { ...subscription, plan };
  },
});

/**
 * Create a new subscription (called after successful payment)
 */
export const create = mutation({
  args: {
    businessId: v.id("businesses"),
    planId: v.id("subscriptionPlans"),
    billingCycle: v.union(v.literal("monthly"), v.literal("annual")),
    paymentId: v.optional(v.id("payments")),
    startTrial: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const log = createLogger("subscriptions.create");
    
    try {
      log.info("Subscription creation initiated", {
        businessId: args.businessId,
        planId: args.planId,
        billingCycle: args.billingCycle,
        startTrial: args.startTrial,
        hasPaymentId: !!args.paymentId,
      });

      const user = await requireUser(ctx);
      log.setContext({ userId: user.clerkId, businessId: args.businessId });

      // Verify user owns this business
      const business = await ctx.db.get(args.businessId);
      if (!business || business.ownerId !== user._id) {
        log.warn("Subscription creation failed - unauthorized", {
          businessId: args.businessId,
          businessOwnerId: business?.ownerId,
          requestingUserId: user._id,
        });
        await flushLogs();
        throw new Error("Unauthorized: You can only create subscriptions for your own business");
      }

      // Check for existing active subscription
      const existing = await ctx.db
        .query("subscriptions")
        .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
        .first();

      if (existing && (existing.status === "active" || existing.status === "trialing")) {
        log.warn("Subscription creation failed - already has active subscription", {
          businessId: args.businessId,
          existingSubscriptionId: existing._id,
          existingStatus: existing.status,
        });
        await flushLogs();
        throw new Error("Business already has an active subscription");
      }

      // Get plan details
      const plan = await ctx.db.get(args.planId);
      if (!plan || !plan.isActive) {
        log.error("Subscription creation failed - invalid plan", undefined, {
          planId: args.planId,
          planExists: !!plan,
          planActive: plan?.isActive,
        });
        await flushLogs();
        throw new Error("Invalid or inactive plan");
      }

      log.debug("Plan validated", { planId: args.planId, planName: plan.name });

      const now = Date.now();
      const periodDays = args.billingCycle === "annual" ? 365 : 30;
      const periodMs = periodDays * 24 * 60 * 60 * 1000;

      // Trial period (14 days)
      const trialDays = 14;
      const trialMs = trialDays * 24 * 60 * 60 * 1000;

      const subscriptionId = await ctx.db.insert("subscriptions", {
        businessId: args.businessId,
        planId: args.planId,
        status: args.startTrial ? "trialing" : "active",
        billingCycle: args.billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: args.startTrial ? now + trialMs : now + periodMs,
        cancelAtPeriodEnd: false,
        trialEndsAt: args.startTrial ? now + trialMs : undefined,
        lastPaymentId: args.paymentId,
        createdAt: now,
        updatedAt: now,
      });

      // If there was an existing cancelled subscription, delete it
      if (existing) {
        await ctx.db.delete(existing._id);
        log.debug("Deleted previous cancelled subscription", { previousSubId: existing._id });
      }

      log.info("Subscription created successfully", {
        subscriptionId,
        businessId: args.businessId,
        planId: args.planId,
        planName: plan.name,
        billingCycle: args.billingCycle,
        status: args.startTrial ? "trialing" : "active",
        periodEnd: new Date(args.startTrial ? now + trialMs : now + periodMs).toISOString(),
      });

      await flushLogs();
      return subscriptionId;
    } catch (error) {
      log.error("Subscription creation failed", error, {
        businessId: args.businessId,
        planId: args.planId,
      });
      await flushLogs();
      throw error;
    }
  },
});

/**
 * Activate subscription after payment (called from webhook)
 */
export const activateAfterPayment = mutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    paymentId: v.id("payments"),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    const now = Date.now();
    const periodDays = subscription.billingCycle === "annual" ? 365 : 30;
    const periodMs = periodDays * 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.subscriptionId, {
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: now + periodMs,
      lastPaymentId: args.paymentId,
      trialEndsAt: undefined,
      updatedAt: now,
    });

    return await ctx.db.get(args.subscriptionId);
  },
});

/**
 * Cancel subscription (sets to cancel at period end)
 */
export const cancel = mutation({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args) => {
    const log = createLogger("subscriptions.cancel");
    
    try {
      log.info("Subscription cancellation initiated", { subscriptionId: args.subscriptionId });

      const user = await requireUser(ctx);
      log.setContext({ userId: user.clerkId });
      
      const subscription = await ctx.db.get(args.subscriptionId);

      if (!subscription) {
        log.error("Subscription cancellation failed - not found", undefined, {
          subscriptionId: args.subscriptionId,
        });
        await flushLogs();
        throw new Error("Subscription not found");
      }

      log.setContext({ businessId: subscription.businessId });

      // Verify ownership
      const business = await ctx.db.get(subscription.businessId);
      if (!business || business.ownerId !== user._id) {
        log.warn("Subscription cancellation failed - unauthorized", {
          subscriptionId: args.subscriptionId,
          businessOwnerId: business?.ownerId,
          requestingUserId: user._id,
        });
        await flushLogs();
        throw new Error("Unauthorized");
      }

      if (subscription.status === "cancelled") {
        log.warn("Subscription cancellation failed - already cancelled", {
          subscriptionId: args.subscriptionId,
        });
        await flushLogs();
        throw new Error("Subscription is already cancelled");
      }

      const plan = await ctx.db.get(subscription.planId);

      await ctx.db.patch(args.subscriptionId, {
        cancelAtPeriodEnd: true,
        cancelledAt: Date.now(),
        updatedAt: Date.now(),
      });

      log.info("Subscription cancelled successfully", {
        subscriptionId: args.subscriptionId,
        businessId: subscription.businessId,
        planId: subscription.planId,
        planName: plan?.name,
        previousStatus: subscription.status,
        cancelAtPeriodEnd: true,
        periodEnd: new Date(subscription.currentPeriodEnd).toISOString(),
      });

      await flushLogs();
      return await ctx.db.get(args.subscriptionId);
    } catch (error) {
      log.error("Subscription cancellation failed", error, {
        subscriptionId: args.subscriptionId,
      });
      await flushLogs();
      throw error;
    }
  },
});

/**
 * Reactivate subscription (remove cancel at period end)
 */
export const reactivate = mutation({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const subscription = await ctx.db.get(args.subscriptionId);

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Verify ownership
    const business = await ctx.db.get(subscription.businessId);
    if (!business || business.ownerId !== user._id) {
      throw new Error("Unauthorized");
    }

    if (subscription.status === "cancelled" || subscription.status === "expired") {
      throw new Error("Cannot reactivate cancelled or expired subscription. Please start a new subscription.");
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw new Error("Subscription is not pending cancellation");
    }

    await ctx.db.patch(args.subscriptionId, {
      cancelAtPeriodEnd: false,
      cancelledAt: undefined,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.subscriptionId);
  },
});

/**
 * Change subscription plan (upgrade/downgrade)
 */
export const changePlan = mutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    newPlanId: v.id("subscriptionPlans"),
  },
  handler: async (ctx, args) => {
    const log = createLogger("subscriptions.changePlan");
    
    try {
      log.info("Subscription plan change initiated", {
        subscriptionId: args.subscriptionId,
        newPlanId: args.newPlanId,
      });

      const user = await requireUser(ctx);
      log.setContext({ userId: user.clerkId });
      
      const subscription = await ctx.db.get(args.subscriptionId);

      if (!subscription) {
        log.error("Plan change failed - subscription not found", undefined, {
          subscriptionId: args.subscriptionId,
        });
        await flushLogs();
        throw new Error("Subscription not found");
      }

      log.setContext({ businessId: subscription.businessId });

      // Verify ownership
      const business = await ctx.db.get(subscription.businessId);
      if (!business || business.ownerId !== user._id) {
        log.warn("Plan change failed - unauthorized", {
          subscriptionId: args.subscriptionId,
          businessOwnerId: business?.ownerId,
        });
        await flushLogs();
        throw new Error("Unauthorized");
      }

      if (subscription.status !== "active" && subscription.status !== "trialing") {
        log.warn("Plan change failed - invalid subscription status", {
          subscriptionId: args.subscriptionId,
          currentStatus: subscription.status,
        });
        await flushLogs();
        throw new Error("Can only change plan on active subscriptions");
      }

      // Get current and new plan
      const currentPlan = await ctx.db.get(subscription.planId);
      const newPlan = await ctx.db.get(args.newPlanId);
      
      if (!newPlan || !newPlan.isActive) {
        log.error("Plan change failed - invalid new plan", undefined, {
          newPlanId: args.newPlanId,
          planExists: !!newPlan,
          planActive: newPlan?.isActive,
        });
        await flushLogs();
        throw new Error("Invalid or inactive plan");
      }

      const isUpgrade = newPlan.monthlyPrice > (currentPlan?.monthlyPrice || 0);

      // For now, just update the plan (in production, you'd handle prorations)
      await ctx.db.patch(args.subscriptionId, {
        planId: args.newPlanId,
        updatedAt: Date.now(),
      });

      log.info("Subscription plan changed successfully", {
        subscriptionId: args.subscriptionId,
        businessId: subscription.businessId,
        previousPlanId: subscription.planId,
        previousPlanName: currentPlan?.name,
        newPlanId: args.newPlanId,
        newPlanName: newPlan.name,
        changeType: isUpgrade ? "upgrade" : "downgrade",
      });

      await flushLogs();
      return await ctx.db.get(args.subscriptionId);
    } catch (error) {
      log.error("Plan change failed", error, {
        subscriptionId: args.subscriptionId,
        newPlanId: args.newPlanId,
      });
      await flushLogs();
      throw error;
    }
  },
});

/**
 * Update subscription status (admin only or system/webhook calls)
 */
export const updateStatus = mutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    status: v.union(
      v.literal("active"),
      v.literal("past_due"),
      v.literal("cancelled"),
      v.literal("trialing"),
      v.literal("expired")
    ),
  },
  handler: async (ctx, args) => {
    // Require authentication - admin or system calls
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Authentication required");
    }
    
    // Verify caller is admin
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user || user.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }
    
    const subscription = await ctx.db.get(args.subscriptionId);

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    await ctx.db.patch(args.subscriptionId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.subscriptionId);
  },
});

/**
 * Check if a business has an active subscription
 */
export const hasActiveSubscription = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    if (!subscription) return false;

    return (
      subscription.status === "active" ||
      subscription.status === "trialing"
    );
  },
});

/**
 * Get subscription limits for a business
 */
export const getBusinessLimits = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    // Default to starter limits if no subscription
    if (!subscription || subscription.status === "cancelled" || subscription.status === "expired") {
      return DEFAULT_PLAN_LIMITS.starter;
    }

    const plan = await ctx.db.get(subscription.planId);
    if (!plan) {
      return DEFAULT_PLAN_LIMITS.starter;
    }

    try {
      return JSON.parse(plan.limits) as PlanLimits;
    } catch {
      return DEFAULT_PLAN_LIMITS.starter;
    }
  },
});

/**
 * List all subscriptions (admin only)
 */
export const listAll = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("past_due"),
        v.literal("cancelled"),
        v.literal("trialing"),
        v.literal("expired")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const subscriptions = args.status
      ? await ctx.db
          .query("subscriptions")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .collect()
      : await ctx.db.query("subscriptions").collect();

    // Enrich with plan and business details
    const enriched = await Promise.all(
      subscriptions.map(async (sub) => {
        const plan = await ctx.db.get(sub.planId);
        const business = await ctx.db.get(sub.businessId);
        return {
          ...sub,
          plan,
          business,
        };
      })
    );

    return enriched;
  },
});

/**
 * Process expired subscriptions (cron job)
 */
export const processExpiredSubscriptions = mutation({
  args: {},
  handler: async (ctx) => {
    const log = createLogger("subscriptions.processExpiredSubscriptions");
    
    try {
      log.info("Processing expired subscriptions - cron job started");
      
      const now = Date.now();

      // Find subscriptions past their period end that should be expired
      const expiredTrials = await ctx.db
        .query("subscriptions")
        .withIndex("by_status", (q) => q.eq("status", "trialing"))
        .filter((q) => q.lt(q.field("currentPeriodEnd"), now))
        .collect();

      const cancelledAtEnd = await ctx.db
        .query("subscriptions")
        .filter((q) =>
          q.and(
            q.eq(q.field("cancelAtPeriodEnd"), true),
            q.lt(q.field("currentPeriodEnd"), now),
            q.neq(q.field("status"), "cancelled")
          )
        )
        .collect();

      log.debug("Found subscriptions to process", {
        expiredTrials: expiredTrials.length,
        cancelledAtEnd: cancelledAtEnd.length,
      });

      let processed = 0;
      const expiredTrialIds: string[] = [];
      const cancelledSubIds: string[] = [];

      // Expire trials
      for (const sub of expiredTrials) {
        await ctx.db.patch(sub._id, {
          status: "expired",
          updatedAt: now,
        });
        processed++;
        expiredTrialIds.push(sub._id);
        
        log.info("Trial subscription expired", {
          subscriptionId: sub._id,
          businessId: sub.businessId,
          planId: sub.planId,
          trialEndedAt: new Date(sub.currentPeriodEnd).toISOString(),
        });
      }

      // Cancel subscriptions that were set to cancel at period end
      for (const sub of cancelledAtEnd) {
        await ctx.db.patch(sub._id, {
          status: "cancelled",
          updatedAt: now,
        });
        processed++;
        cancelledSubIds.push(sub._id);
        
        log.info("Subscription cancelled at period end", {
          subscriptionId: sub._id,
          businessId: sub.businessId,
          planId: sub.planId,
          periodEndedAt: new Date(sub.currentPeriodEnd).toISOString(),
        });
      }

      log.info("Expired subscriptions processing completed", {
        totalProcessed: processed,
        expiredTrials: expiredTrialIds.length,
        cancelledSubscriptions: cancelledSubIds.length,
      });

      await flushLogs();
      return { processed };
    } catch (error) {
      log.error("Failed to process expired subscriptions", error);
      await flushLogs();
      throw error;
    }
  },
});

/**
 * Get subscription usage stats for a business
 */
export const getUsageStats = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    // Require authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Authentication required");
    }
    
    // Get the requesting user
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }

    // Get business
    const business = await ctx.db.get(args.businessId);
    if (!business) {
      throw new Error("Business not found");
    }

    // Verify caller has access to this business (owner or admin)
    if (business.ownerId !== user._id && user.role !== "admin") {
      throw new Error("Unauthorized: You don't have access to this business");
    }

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    // Count products for this specific business (using businessId, not ownerId)
    // Note: If there's no index by_business on products, we filter by seller who owns this business
    const products = await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("sellerId", business.ownerId))
      .collect();

    // Count orders this month for this specific business
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartMs = monthStart.getTime();

    // Use sellerId that matches the business owner
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_seller", (q) => q.eq("sellerId", business.ownerId))
      .filter((q) => q.gte(q.field("createdAt"), monthStartMs))
      .collect();

    // Count origin calculations this month
    const calculations = await ctx.db
      .query("originCalculations")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .filter((q) => q.gte(q.field("createdAt"), monthStartMs))
      .collect();

    // Get limits
    let limits = DEFAULT_PLAN_LIMITS.starter;
    if (subscription && subscription.status !== "cancelled" && subscription.status !== "expired") {
      const plan = await ctx.db.get(subscription.planId);
      if (plan) {
        try {
          limits = JSON.parse(plan.limits) as PlanLimits;
        } catch {
          // Use default
        }
      }
    }

    return {
      products: {
        used: products.length,
        limit: limits.maxProducts,
        unlimited: limits.maxProducts === -1,
      },
      orders: {
        used: orders.length,
        limit: limits.maxMonthlyOrders,
        unlimited: limits.maxMonthlyOrders === -1,
      },
      originCalculations: {
        used: calculations.length,
        limit: limits.maxOriginCalculations,
        unlimited: limits.maxOriginCalculations === -1,
      },
    };
  },
});
