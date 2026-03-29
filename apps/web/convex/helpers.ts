import { MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export type UserRole = "buyer" | "seller" | "admin" | "bank";
export type SellerApplicationStatus = "pending" | "approved" | "rejected";

/**
 * Plan limits interface for feature gating
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
 * Default (starter) plan limits - used when no subscription exists
 */
export const DEFAULT_PLAN_LIMITS: PlanLimits = {
  maxProducts: 10,
  maxMonthlyOrders: 50,
  maxOriginCalculations: 5,
  maxHsCodeLookups: 10,
  maxTeamMembers: 1,
  prioritySupport: "none",
  analytics: "basic",
  apiAccess: "none",
};

/**
 * Gets the current authenticated user, creating them if they don't exist.
 * This eliminates race conditions where mutations run before ensureUser completes.
 */
export async function getOrCreateUser(ctx: MutationCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Not authenticated");
  }

  let user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user) {
    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email ?? "",
      name: typeof identity.name === "string" ? identity.name : undefined,
      imageUrl: typeof identity.picture === "string" ? identity.picture : undefined,
      role: "buyer", // Default role for new users
    });
    user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("Failed to create user");
    }
  }

  return user;
}

/**
 * Gets the current authenticated user (query context).
 */
export async function getCurrentUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
}

/**
 * Gets the current authenticated user or throws if not found.
 */
export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
}

/**
 * Requires the current user to have admin role.
 */
export async function requireAdmin(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") {
    throw new Error("Unauthorized: Admin access required");
  }
  return user;
}

/**
 * Requires the current user to have bank role and membership.
 */
export async function requireBank(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "bank") {
    throw new Error("Unauthorized: Bank access required");
  }
  if (!user.bankId) {
    throw new Error("Unauthorized: Bank account is not assigned to a bank");
  }
  return user;
}

/**
 * Requires the current user to have seller role.
 */
export async function requireSeller(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!hasSellerAccess(user)) {
    throw new Error("Unauthorized: Seller access required");
  }
  return user;
}

/**
 * Requires the current user to have a specific role or higher.
 */
export async function requireRole(ctx: QueryCtx, allowedRoles: UserRole[]): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!user.role || !allowedRoles.includes(user.role)) {
    throw new Error(`Unauthorized: Required role: ${allowedRoles.join(" or ")}`);
  }
  return user;
}

export function getEffectiveSellerApplicationStatus(
  user: Pick<Doc<"users">, "role" | "sellerApplicationStatus">
): SellerApplicationStatus | "not_applied" {
  if (user.role === "seller" || user.role === "admin") {
    return "approved";
  }

  return user.sellerApplicationStatus ?? "not_applied";
}

export function hasSellerAccess(
  user: Pick<Doc<"users">, "role">
): boolean {
  // Seller-only operations are role-gated; application status is informational.
  return user.role === "admin" || user.role === "seller";
}

export async function requireVerifiedBusiness(
  db: QueryCtx["db"] | MutationCtx["db"],
  user: Doc<"users">
): Promise<Doc<"businesses">> {
  if (!user.businessId) {
    throw new Error(
      "Business verification is required. Complete your business verification in Settings."
    );
  }

  const business = await db.get(user.businessId);
  if (!business) {
    throw new Error(
      "Your business record could not be found. Complete your business verification in Settings."
    );
  }

  if (business.verificationStatus !== "verified") {
    if (business.verificationStatus === "pending") {
      throw new Error(
        "Your business is not verified yet because verification is still pending review. You can continue after approval."
      );
    }

    if (business.verificationStatus === "rejected") {
      throw new Error(
        "Your business is not verified because verification was rejected. Update your business documents in Settings."
      );
    }

    throw new Error(
      `Your business is not verified. Current verification status: ${business.verificationStatus}.`
    );
  }

  return business;
}

export async function requireVerifiedBusinessForBuying(
  db: QueryCtx["db"] | MutationCtx["db"],
  user: Doc<"users">
): Promise<Doc<"businesses">> {
  try {
    return await requireVerifiedBusiness(db, user);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("pending review")) {
        throw new Error(
          "Your business verification is still pending review. You can place orders after approval."
        );
      }

      if (error.message.includes("was rejected")) {
        throw new Error(
          "Your business verification was rejected. Update your business documents in Settings before buying."
        );
      }

      if (error.message.includes("Business verification is required")) {
        throw new Error(
          "Business verification is required before you can buy products. Complete your business verification in Settings."
        );
      }
    }

    throw error;
  }
}

/**
 * Get the subscription limits for a business
 */
export async function getBusinessPlanLimits(
  ctx: QueryCtx,
  businessId: Id<"businesses">
): Promise<PlanLimits> {
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_business", (q) => q.eq("businessId", businessId))
    .first();

  // No subscription or inactive - use default limits
  if (!subscription || subscription.status === "cancelled" || subscription.status === "expired") {
    return DEFAULT_PLAN_LIMITS;
  }

  const plan = await ctx.db.get(subscription.planId);
  if (!plan) {
    return DEFAULT_PLAN_LIMITS;
  }

  try {
    const parsed = JSON.parse(plan.limits);
    // Validate and merge with defaults to ensure all fields exist
    const validated: PlanLimits = {
      maxProducts: typeof parsed.maxProducts === "number" ? parsed.maxProducts : DEFAULT_PLAN_LIMITS.maxProducts,
      maxMonthlyOrders: typeof parsed.maxMonthlyOrders === "number" ? parsed.maxMonthlyOrders : DEFAULT_PLAN_LIMITS.maxMonthlyOrders,
      maxOriginCalculations: typeof parsed.maxOriginCalculations === "number" ? parsed.maxOriginCalculations : DEFAULT_PLAN_LIMITS.maxOriginCalculations,
      maxHsCodeLookups: typeof parsed.maxHsCodeLookups === "number" ? parsed.maxHsCodeLookups : DEFAULT_PLAN_LIMITS.maxHsCodeLookups,
      maxTeamMembers: typeof parsed.maxTeamMembers === "number" ? parsed.maxTeamMembers : DEFAULT_PLAN_LIMITS.maxTeamMembers,
      prioritySupport: ["none", "email", "chat", "dedicated"].includes(parsed.prioritySupport) ? parsed.prioritySupport : DEFAULT_PLAN_LIMITS.prioritySupport,
      analytics: ["basic", "advanced", "full", "custom"].includes(parsed.analytics) ? parsed.analytics : DEFAULT_PLAN_LIMITS.analytics,
      apiAccess: ["none", "limited", "full"].includes(parsed.apiAccess) ? parsed.apiAccess : DEFAULT_PLAN_LIMITS.apiAccess,
    };
    return validated;
  } catch {
    return DEFAULT_PLAN_LIMITS;
  }
}

/**
 * Check if a numeric limit allows the operation
 * Returns true if within limit, false if exceeded
 * -1 means unlimited
 */
export function isWithinLimit(current: number, limit: number): boolean {
  if (limit === -1) return true; // Unlimited
  return current < limit;
}

/**
 * Check product creation limit for a user
 */
export async function checkProductLimit(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<{ allowed: boolean; current: number; limit: number; unlimited: boolean }> {
  const user = await ctx.db.get(userId);
  if (!user) {
    return { allowed: false, current: 0, limit: 0, unlimited: false };
  }

  // Count current products
  const products = await ctx.db
    .query("products")
    .withIndex("by_seller", (q) => q.eq("sellerId", userId))
    .collect();
  const current = products.length;

  // Get limits based on subscription
  let limits = DEFAULT_PLAN_LIMITS;
  if (user.businessId) {
    limits = await getBusinessPlanLimits(ctx, user.businessId);
  }

  const unlimited = limits.maxProducts === -1;
  const allowed = isWithinLimit(current, limits.maxProducts);

  return { allowed, current, limit: limits.maxProducts, unlimited };
}

/**
 * Check monthly origin calculation limit
 */
export async function checkOriginCalculationLimit(
  ctx: QueryCtx,
  businessId: Id<"businesses">
): Promise<{ allowed: boolean; current: number; limit: number; unlimited: boolean }> {
  // Get this month's calculations
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartMs = monthStart.getTime();

  const calculations = await ctx.db
    .query("originCalculations")
    .withIndex("by_business", (q) => q.eq("businessId", businessId))
    .filter((q) => q.gte(q.field("createdAt"), monthStartMs))
    .collect();
  const current = calculations.length;

  // Get limits
  const limits = await getBusinessPlanLimits(ctx, businessId);
  const unlimited = limits.maxOriginCalculations === -1;
  const allowed = isWithinLimit(current, limits.maxOriginCalculations);

  return { allowed, current, limit: limits.maxOriginCalculations, unlimited };
}

/**
 * Check monthly order limit
 */
export async function checkOrderLimit(
  ctx: QueryCtx,
  sellerId: Id<"users">
): Promise<{ allowed: boolean; current: number; limit: number; unlimited: boolean }> {
  // Get seller's business using direct lookup
  const seller = await ctx.db.get(sellerId);

  if (!seller || !seller.businessId) {
    return { allowed: true, current: 0, limit: DEFAULT_PLAN_LIMITS.maxMonthlyOrders, unlimited: false };
  }

  // Get this month's orders
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartMs = monthStart.getTime();

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_seller", (q) => q.eq("sellerId", sellerId))
    .filter((q) => q.gte(q.field("createdAt"), monthStartMs))
    .collect();
  const current = orders.length;

  // Get limits
  const limits = await getBusinessPlanLimits(ctx, seller.businessId);
  const unlimited = limits.maxMonthlyOrders === -1;
  const allowed = isWithinLimit(current, limits.maxMonthlyOrders);

  return { allowed, current, limit: limits.maxMonthlyOrders, unlimited };
}

/**
 * Feature gating error with upgrade suggestion
 */
export class PlanLimitError extends Error {
  constructor(
    public feature: string,
    public current: number,
    public limit: number
  ) {
    super(`You've reached your ${feature} limit (${current}/${limit}). Please upgrade your plan to continue.`);
    this.name = "PlanLimitError";
  }
}

