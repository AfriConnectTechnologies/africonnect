import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, getCurrentUser } from "./helpers";
import { createLogger, flushLogs } from "./lib/logger";

/**
 * Custom error class for expected validation failures.
 * These errors should not be logged as errors since they represent
 * expected validation conditions.
 */
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Generate a short hash from a string for use in channel IDs.
 * Stream Chat channel IDs must be max 64 characters.
 */
function shortHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to base36 for shorter representation, make positive
  return Math.abs(hash).toString(36);
}

/**
 * Generate a consistent, short channel ID for two participants.
 * Format: {prefix}_{shortHash} (max ~20 chars)
 */
function generateChannelId(prefix: string, ...ids: string[]): string {
  const sorted = [...ids].sort();
  const combined = sorted.join("_");
  const hash = shortHash(combined);
  return `${prefix}_${hash}`;
}

/**
 * Get channel info for a product inquiry between buyer and seller.
 * This doesn't create the channel - that's done client-side via Stream SDK.
 * This just provides the channel ID format and validates access.
 */
export const getProductChannelInfo = query({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return null;
    }

    const product = await ctx.db.get(args.productId);
    if (!product) {
      return null; // Product not found - return null instead of throwing
    }

    // Get seller info using query (for proper typing)
    const seller = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("_id"), product.sellerId))
      .first();
    if (!seller) {
      return null; // Seller not found - return null instead of throwing
    }

    // Get business info if available
    let business = null;
    if (seller.businessId) {
      business = await ctx.db.get(seller.businessId);
    }

    // Generate short channel ID (max 64 chars for Stream Chat)
    const channelId = generateChannelId("p", args.productId, user._id, seller._id);

    // Generate Stream-compatible user IDs (sanitized Clerk IDs)
    const currentUserStreamId = user.clerkId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const sellerStreamId = seller.clerkId.replace(/[^a-zA-Z0-9_-]/g, "_");

    // Get user names for Stream Chat user sync
    const currentUserName = user.name || user.email || "User";
    const sellerNameDisplay = seller.name || seller.email || "Seller";

    return {
      channelId,
      channelType: "messaging",
      productId: args.productId,
      productName: product.name,
      sellerId: seller._id,
      sellerName: sellerNameDisplay,
      sellerClerkId: seller.clerkId,
      sellerStreamId,
      currentUserStreamId,
      currentUserName,
      members: [currentUserStreamId, sellerStreamId],
      memberNames: [currentUserName, sellerNameDisplay],
      businessName: business?.name,
      isOwnProduct: user._id === seller._id,
    };
  },
});

/**
 * Get channel info for a business inquiry.
 */
export const getBusinessChannelInfo = query({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return null;
    }

    const business = await ctx.db.get(args.businessId);
    if (!business) {
      return null; // Business not found - return null instead of throwing
    }

    // Get owner info
    const owner = await ctx.db.get(business.ownerId);
    if (!owner) {
      return null; // Business owner not found - return null instead of throwing
    }

    // Generate short channel ID (max 64 chars for Stream Chat)
    const channelId = generateChannelId("b", args.businessId, user._id, owner._id);

    // Generate Stream-compatible user IDs (sanitized Clerk IDs)
    const currentUserStreamId = user.clerkId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const ownerStreamId = owner.clerkId.replace(/[^a-zA-Z0-9_-]/g, "_");

    // Get user names for Stream Chat user sync
    const currentUserName = user.name || user.email || "User";
    const ownerNameDisplay = owner.name || owner.email || "Owner";

    return {
      channelId,
      channelType: "messaging",
      businessId: args.businessId,
      businessName: business.name,
      ownerId: owner._id,
      ownerName: ownerNameDisplay,
      ownerClerkId: owner.clerkId,
      ownerStreamId,
      currentUserStreamId,
      currentUserName,
      members: [currentUserStreamId, ownerStreamId],
      memberNames: [currentUserName, ownerNameDisplay],
      isOwnBusiness: user._id === owner._id,
    };
  },
});

/**
 * Report a conversation for admin review.
 */
export const reportConversation = mutation({
  args: {
    channelId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const log = createLogger("chat.reportConversation");
    
    try {
      log.info("Chat report initiated", {
        channelId: args.channelId,
        reasonLength: args.reason.length,
      });

      const user = await requireUser(ctx);
      log.setContext({ userId: user.clerkId });

      // Check if already reported by this user
      const existingReport = await ctx.db
        .query("chatReports")
        .withIndex("by_channel_reporter", (q) => 
          q.eq("channelId", args.channelId).eq("reporterId", user._id)
        )
        .first();

      if (existingReport && existingReport.status === "pending") {
        log.warn("Chat report failed - already reported", {
          channelId: args.channelId,
          existingReportId: existingReport._id,
        });
        await flushLogs();
        throw new ValidationError("You have already reported this conversation");
      }

      const reportId = await ctx.db.insert("chatReports", {
        channelId: args.channelId,
        reporterId: user._id,
        reason: args.reason,
        status: "pending",
        createdAt: Date.now(),
      });

      log.info("Chat report created", {
        reportId,
        channelId: args.channelId,
        reporterId: user._id,
      });

      await flushLogs();
      return reportId;
    } catch (error) {
      // Skip error logging for expected validation failures
      if (error instanceof ValidationError) {
        throw error;
      }
      log.error("Chat report failed", error, {
        channelId: args.channelId,
      });
      await flushLogs();
      throw error;
    }
  },
});

/**
 * List all chat reports (admin only).
 */
export const listChatReports = query({
  args: {
    status: v.optional(v.union(v.literal("pending"), v.literal("reviewed"), v.literal("resolved"))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    let reports;
    if (args.status) {
      reports = await ctx.db
        .query("chatReports")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    } else {
      reports = await ctx.db
        .query("chatReports")
        .order("desc")
        .collect();
    }

    // Enrich with reporter info
    const enrichedReports = await Promise.all(
      reports.map(async (report) => {
        const reporter = await ctx.db.get(report.reporterId);
        return {
          ...report,
          reporterName: reporter?.name || reporter?.email || "Unknown",
        };
      })
    );

    return enrichedReports;
  },
});

/**
 * Update chat report status (admin only).
 */
export const updateReportStatus = mutation({
  args: {
    reportId: v.id("chatReports"),
    status: v.union(v.literal("pending"), v.literal("reviewed"), v.literal("resolved")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    await ctx.db.patch(args.reportId, {
      status: args.status,
    });

    return await ctx.db.get(args.reportId);
  },
});

/**
 * Get the current user's Stream Chat ID (derived from Clerk ID).
 */
export const getStreamUserId = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return null;
    }

    // Stream user ID is derived from Clerk ID with sanitization
    return user.clerkId.replace(/[^a-zA-Z0-9_-]/g, "_");
  },
});

/**
 * Delete all chat reports associated with a channel.
 * Called after deleting a channel from Stream Chat.
 */
export const deleteChannelReports = mutation({
  args: {
    channelId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Get all reports for this channel
    const reports = await ctx.db
      .query("chatReports")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();

    // Delete all reports (only allow if user is admin or reported themselves)
    let deletedCount = 0;
    for (const report of reports) {
      // Allow deletion if admin or if user reported this themselves
      if (user.role === "admin" || report.reporterId === user._id) {
        await ctx.db.delete(report._id);
        deletedCount++;
      }
    }

    return { deletedCount };
  },
});
