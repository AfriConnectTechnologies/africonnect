import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./helpers";

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
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

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

    return { 
      userId, 
      isNewUser: true, 
      shouldSendWelcomeEmail: true, 
      shouldSendVerificationEmail: true,
      emailVerified: false,
      email, 
      name 
    };
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
    const admin = await requireAdmin(ctx);

    // Prevent admin from demoting themselves
    if (admin._id === args.userId && args.role !== "admin") {
      throw new Error("Cannot change your own admin role");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(args.userId, {
      role: args.role,
    });

    return await ctx.db.get(args.userId);
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

