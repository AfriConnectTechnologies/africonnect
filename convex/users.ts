import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import {
  getEffectiveSellerApplicationStatus,
  requireAdmin,
  requireVerifiedBusiness,
} from "./helpers";
import { createLogger, flushLogs } from "./lib/logger";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    return user;
  },
});

export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const log = createLogger("users.ensureUser");
    
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (identity === null) {
        log.warn("ensureUser called without authentication");
        await flushLogs();
        throw new Error("Not authenticated");
      }

      log.setContext({ userId: identity.subject });

      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first();

      if (existingUser) {
        // Check if welcome email needs to be sent (user exists but hasn't received welcome email)
        const shouldSendWelcomeEmail = !existingUser.welcomeEmailSent;
        // Check if verification email needs to be sent - send if email is not verified
        // Only send automatically for new users or users who haven't received any email yet
        const shouldSendVerificationEmail = !existingUser.emailVerified && !existingUser.welcomeEmailSent;

        log.debug("Existing user found", {
          internalUserId: existingUser._id,
          role: existingUser.role,
          emailVerified: existingUser.emailVerified,
          shouldSendWelcomeEmail,
          shouldSendVerificationEmail,
        });

        await flushLogs();
        return { 
          userId: existingUser._id, 
          isNewUser: false, 
          shouldSendWelcomeEmail,
          shouldSendVerificationEmail,
          emailVerified: existingUser.emailVerified ?? false,
          email: existingUser.email, 
          name: existingUser.name 
        };
      }

      const email = identity.email ?? "";
      const name = typeof identity.name === "string" ? identity.name : undefined;

      const userId = await ctx.db.insert("users", {
        clerkId: identity.subject,
        email,
        name,
        imageUrl: typeof identity.picture === "string" ? identity.picture : undefined,
        role: "buyer", // Default role for new users
        welcomeEmailSent: false,
        emailVerified: false,
      });

      log.info("New user created", {
        internalUserId: userId,
        clerkId: identity.subject,
        role: "buyer",
        hasEmail: !!email,
      });

      await flushLogs();
      return { 
        userId, 
        isNewUser: true, 
        shouldSendWelcomeEmail: true, 
        shouldSendVerificationEmail: true,
        emailVerified: false,
        email, 
        name 
      };
    } catch (error) {
      log.error("ensureUser failed", error);
      await flushLogs();
      throw error;
    }
  },
});

// Mark welcome email as sent
export const markWelcomeEmailSent = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (user) {
      await ctx.db.patch(user._id, { welcomeEmailSent: true });
    }
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
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
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      name: args.name ?? undefined,
    });

    return await ctx.db.get(user._id);
  },
});

// Get current user's role
export const getUserRole = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    return user?.role ?? "buyer";
  },
});

export const submitSellerApplication = mutation({
  args: {},
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
      throw new Error("User not found");
    }

    const hasAcceptedSellerAgreement = await ctx.runQuery(
      api.agreements.hasAcceptedAgreement,
      { userId: user._id, type: "seller" }
    );

    if (!hasAcceptedSellerAgreement) {
      throw new Error("You must accept the seller agreement before applying.");
    }

    await requireVerifiedBusiness(ctx.db, user);

    if (user.role === "seller" || user.role === "admin") {
      throw new Error("Seller access is already active for this account.");
    }

    if (user.sellerApplicationStatus === "pending") {
      throw new Error("Your seller application is already pending review.");
    }

    const now = Date.now();
    await ctx.db.patch(user._id, {
      sellerApplicationStatus: "pending",
      sellerApplicationSubmittedAt: now,
      sellerApplicationReviewedAt: undefined,
      sellerApplicationReviewedBy: undefined,
    });

    return await ctx.db.get(user._id);
  },
});

export const listSellerApplications = query({
  args: {
    status: v.optional(
      v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))
    ),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let users;
    if (args.status) {
      users = await ctx.db
        .query("users")
        .withIndex("by_seller_application_status", (q) =>
          q.eq("sellerApplicationStatus", args.status!)
        )
        .collect();
    } else {
      users = (await ctx.db.query("users").collect()).filter(
        (user) => user.sellerApplicationStatus !== undefined
      );
    }

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      users = users.filter(
        (user) =>
          user.name?.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower)
      );
    }

    const usersWithBusiness = await Promise.all(
      users.map(async (user) => {
        const business = user.businessId ? await ctx.db.get(user.businessId) : null;
        return {
          ...user,
          business,
          effectiveSellerApplicationStatus: getEffectiveSellerApplicationStatus(user),
        };
      })
    );

    return usersWithBusiness.sort((a, b) => {
      const aDate = a.sellerApplicationSubmittedAt ?? 0;
      const bDate = b.sellerApplicationSubmittedAt ?? 0;
      return bDate - aDate;
    });
  },
});

export const reviewSellerApplication = mutation({
  args: {
    userId: v.id("users"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new Error("User not found");
    }

    if (user.sellerApplicationStatus !== "pending") {
      throw new Error("Application not pending");
    }

    if (!user.businessId) {
      throw new Error("User does not have a business linked.");
    }

    const business = await ctx.db.get(user.businessId);
    if (!business || business.verificationStatus !== "verified") {
      throw new Error("Only users with verified businesses can be reviewed for seller access.");
    }

    const now = Date.now();
    await ctx.db.patch(user._id, {
      sellerApplicationStatus: args.status,
      sellerApplicationReviewedAt: now,
      sellerApplicationReviewedBy: admin._id,
      role:
        user.role === "admin"
          ? "admin"
          : args.status === "approved"
            ? "seller"
            : "buyer",
    });

    return await ctx.db.get(user._id);
  },
});

// List all users (admin only)
export const listUsers = query({
  args: {
    role: v.optional(v.union(v.literal("buyer"), v.literal("seller"), v.literal("admin"))),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let users;
    if (args.role) {
      users = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", args.role!))
        .collect();
    } else {
      users = await ctx.db.query("users").collect();
    }

    // Apply search filter if provided
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      users = users.filter(
        (u) =>
          u.name?.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower)
      );
    }

    // Fetch business info for each user with a businessId
    const usersWithBusiness = await Promise.all(
      users.map(async (user) => {
        let business = null;
        if (user.businessId) {
          business = await ctx.db.get(user.businessId);
        }
        return { ...user, business };
      })
    );

    return usersWithBusiness;
  },
});

// Get users by role (admin only)
export const getUsersByRole = query({
  args: {
    role: v.union(v.literal("buyer"), v.literal("seller"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    return await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .collect();
  },
});

// Set user role (admin only)
export const setUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("buyer"), v.literal("seller"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    // Require admin FIRST before any logging to prevent unauthenticated log entries
    const admin = await requireAdmin(ctx);
    
    const log = createLogger("users.setUserRole");
    log.setContext({ userId: admin.clerkId });
    
    try {
      log.info("User role change initiated", {
        targetUserId: args.userId,
        newRole: args.role,
      });

      // Prevent admin from demoting themselves
      if (admin._id === args.userId && args.role !== "admin") {
        log.warn("Admin attempted to demote themselves", {
          adminId: admin._id,
          requestedRole: args.role,
        });
        await flushLogs();
        throw new Error("Cannot change your own admin role");
      }

      const user = await ctx.db.get(args.userId);
      if (!user) {
        log.error("User role change failed - user not found", undefined, {
          targetUserId: args.userId,
        });
        await flushLogs();
        throw new Error("User not found");
      }

      const previousRole = user.role;

      await ctx.db.patch(args.userId, {
        role: args.role,
        ...(args.role === "seller"
          ? {
              sellerApplicationStatus: "approved" as const,
              sellerApplicationSubmittedAt: user.sellerApplicationSubmittedAt ?? Date.now(),
              sellerApplicationReviewedAt: Date.now(),
              sellerApplicationReviewedBy: admin._id,
            }
          : args.role === "buyer"
            ? {
                sellerApplicationStatus: undefined,
                sellerApplicationSubmittedAt: undefined,
                sellerApplicationReviewedAt: undefined,
                sellerApplicationReviewedBy: undefined,
              }
          : {}),
      });

      log.info("User role changed successfully", {
        targetUserId: args.userId,
        targetUserEmail: user.email,
        previousRole,
        newRole: args.role,
        changedByAdminId: admin._id,
      });

      await flushLogs();
      return await ctx.db.get(args.userId);
    } catch (error) {
      log.error("User role change failed", error, {
        targetUserId: args.userId,
        newRole: args.role,
      });
      await flushLogs();
      throw error;
    }
  },
});

// Get user by ID (admin only)
export const getUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.userId);
  },
});

