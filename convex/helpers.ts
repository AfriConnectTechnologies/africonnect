import { MutationCtx, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

export type UserRole = "buyer" | "seller" | "admin";

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
 * Requires the current user to have seller role.
 */
export async function requireSeller(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "seller" && user.role !== "admin") {
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

