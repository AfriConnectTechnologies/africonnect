import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Generate a random token
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Create a verification token for email verification
export const createEmailVerificationToken = mutation({
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

    // Check if user is already verified
    if (user.emailVerified) {
      return { alreadyVerified: true, token: null };
    }

    // Invalidate any existing tokens for this user
    const existingTokens = await ctx.db
      .query("verificationTokens")
      .withIndex("by_user_type", (q) => 
        q.eq("userId", user._id).eq("type", "email")
      )
      .collect();

    for (const token of existingTokens) {
      await ctx.db.patch(token._id, { used: true });
    }

    // Create new token (expires in 24 hours)
    const token = generateToken();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    await ctx.db.insert("verificationTokens", {
      userId: user._id,
      token,
      type: "email",
      expiresAt,
      used: false,
      createdAt: Date.now(),
    });

    return { 
      alreadyVerified: false, 
      token, 
      email: user.email, 
      name: user.name 
    };
  },
});

// Verify email with token (public - no auth required)
export const verifyEmailToken = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenRecord = await ctx.db
      .query("verificationTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!tokenRecord) {
      return { success: false, error: "Invalid verification token" };
    }

    if (tokenRecord.used) {
      return { success: false, error: "Token has already been used" };
    }

    if (tokenRecord.expiresAt < Date.now()) {
      return { success: false, error: "Token has expired" };
    }

    // Mark token as used
    await ctx.db.patch(tokenRecord._id, { used: true });

    // Update user as verified
    const user = await ctx.db.get(tokenRecord.userId);
    if (!user) {
      return { success: false, error: "User not found" };
    }

    await ctx.db.patch(tokenRecord.userId, {
      emailVerified: true,
      emailVerifiedAt: Date.now(),
    });

    return { success: true, email: user.email };
  },
});

// Check if current user's email is verified
export const isEmailVerified = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return { authenticated: false, verified: false };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return { authenticated: true, verified: false, userExists: false };
    }

    return { 
      authenticated: true, 
      verified: user.emailVerified ?? false,
      userExists: true,
      email: user.email,
    };
  },
});

// Resend verification email (creates new token)
export const resendVerificationToken = mutation({
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

    if (user.emailVerified) {
      return { alreadyVerified: true, token: null };
    }

    // Check for recent tokens to prevent spam (max 1 every 60 seconds)
    const recentTokens = await ctx.db
      .query("verificationTokens")
      .withIndex("by_user_type", (q) => 
        q.eq("userId", user._id).eq("type", "email")
      )
      .order("desc")
      .first();

    if (recentTokens && !recentTokens.used && 
        Date.now() - recentTokens.createdAt < 60 * 1000) {
      return { 
        alreadyVerified: false, 
        token: null, 
        rateLimited: true,
        waitSeconds: Math.ceil((60 * 1000 - (Date.now() - recentTokens.createdAt)) / 1000)
      };
    }

    // Invalidate existing tokens
    const existingTokens = await ctx.db
      .query("verificationTokens")
      .withIndex("by_user_type", (q) => 
        q.eq("userId", user._id).eq("type", "email")
      )
      .collect();

    for (const token of existingTokens) {
      await ctx.db.patch(token._id, { used: true });
    }

    // Create new token
    const token = generateToken();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    await ctx.db.insert("verificationTokens", {
      userId: user._id,
      token,
      type: "email",
      expiresAt,
      used: false,
      createdAt: Date.now(),
    });

    return { 
      alreadyVerified: false, 
      token, 
      rateLimited: false,
      email: user.email, 
      name: user.name 
    };
  },
});
