import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./helpers";

/**
 * Create a payment audit log entry
 * This is called from API routes to track all payment-related actions
 */
export const create = mutation({
  args: {
    paymentId: v.optional(v.id("payments")),
    userId: v.optional(v.string()),
    action: v.string(),
    status: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    txRef: v.optional(v.string()),
    metadata: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("paymentAuditLogs", {
      ...args,
      createdAt: Date.now(),
    });

    return logId;
  },
});

/**
 * Check if a webhook event has already been processed (for deduplication)
 */
export const isWebhookProcessed = query({
  args: {
    txRef: v.string(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("webhookEvents")
      .withIndex("by_tx_ref", (q) => q.eq("txRef", args.txRef))
      .first();

    return !!event;
  },
});

/**
 * Mark a webhook event as processed
 */
export const markWebhookProcessed = mutation({
  args: {
    txRef: v.string(),
    eventType: v.string(),
    signature: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if already processed - creates read dependency for Convex OCC
    const existing = await ctx.db
      .query("webhookEvents")
      .withIndex("by_tx_ref", (q) => q.eq("txRef", args.txRef))
      .first();

    if (existing) {
      return { alreadyProcessed: true, eventId: existing._id };
    }

    // Insert the event
    const eventId = await ctx.db.insert("webhookEvents", {
      txRef: args.txRef,
      eventType: args.eventType,
      signature: args.signature,
      processedAt: Date.now(),
    });

    // Post-insert verification: handle any edge case where duplicates slipped through
    const allEvents = await ctx.db
      .query("webhookEvents")
      .withIndex("by_tx_ref", (q) => q.eq("txRef", args.txRef))
      .collect();

    if (allEvents.length > 1) {
      // Use _id as deterministic tiebreaker (lexicographically smallest wins)
      // _id is guaranteed unique and consistent across all nodes
      allEvents.sort((a, b) => (a._id < b._id ? -1 : 1));
      const winner = allEvents[0];

      if (winner._id !== eventId) {
        await ctx.db.delete(eventId);
        return { alreadyProcessed: true, eventId: winner._id };
      }

      // Clean up duplicates
      for (const event of allEvents.slice(1)) {
        await ctx.db.delete(event._id);
      }
    }

    return { alreadyProcessed: false, eventId };
  },
});

/**
 * Get audit logs for a specific payment (admin only)
 */
export const getByPayment = query({
  args: {
    paymentId: v.id("payments"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const logs = await ctx.db
      .query("paymentAuditLogs")
      .withIndex("by_payment", (q) => q.eq("paymentId", args.paymentId))
      .collect();

    return logs.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Get recent audit logs (admin only)
 */
export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = args.limit || 100;

    const logs = args.action
      ? await ctx.db
          .query("paymentAuditLogs")
          .withIndex("by_action", (q) => q.eq("action", args.action!))
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("paymentAuditLogs")
          .order("desc")
          .take(limit);

    return logs;
  },
});

/**
 * Get audit logs by transaction reference (admin only)
 */
export const getByTxRef = query({
  args: {
    txRef: v.string(),
  },
  handler: async (ctx, args) => {
    // Require admin auth to access audit logs
    await requireAdmin(ctx);

    const logs = await ctx.db
      .query("paymentAuditLogs")
      .withIndex("by_tx_ref", (q) => q.eq("txRef", args.txRef))
      .collect();

    return logs.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Clean up old webhook events (to prevent table bloat)
 * Should be run periodically via a cron job
 * Returns hasMore=true if more records remain to be deleted
 */
export const cleanupOldWebhookEvents = mutation({
  args: {
    olderThanDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const BATCH_SIZE = 500;
    const days = args.olderThanDays || 30;
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

    // Get limited batch of old events
    const oldEvents = await ctx.db
      .query("webhookEvents")
      .withIndex("by_processed")
      .filter((q) => q.lt(q.field("processedAt"), cutoffTime))
      .take(BATCH_SIZE);

    let deleted = 0;
    for (const event of oldEvents) {
      await ctx.db.delete(event._id);
      deleted++;
    }

    // Check if more records remain
    const remaining = await ctx.db
      .query("webhookEvents")
      .withIndex("by_processed")
      .filter((q) => q.lt(q.field("processedAt"), cutoffTime))
      .take(1);

    return { deleted, hasMore: remaining.length > 0 };
  },
});
