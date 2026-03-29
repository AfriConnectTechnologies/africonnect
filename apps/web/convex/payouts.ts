import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { createLogger, flushLogs } from "./lib/logger";
import { internal } from "./_generated/api";

const RETRY_BACKOFFS_MS = [
  5 * 60 * 1000, // 5 minutes
  15 * 60 * 1000, // 15 minutes
  60 * 60 * 1000, // 1 hour
  6 * 60 * 60 * 1000, // 6 hours
  24 * 60 * 60 * 1000, // 24 hours
];

const MAX_ATTEMPTS = RETRY_BACKOFFS_MS.length;

interface ChapaTransferResponse {
  status?: string;
  message?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

function getBackoffMs(attempts: number) {
  const index = Math.max(0, Math.min(attempts - 1, RETRY_BACKOFFS_MS.length - 1));
  return RETRY_BACKOFFS_MS[index];
}

function buildReference(orderId: Id<"orders">, attempt: number) {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PO-${orderId}-${attempt}-${suffix}`;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

async function getChapaSecret() {
  const isProduction = process.env.NODE_ENV === "production";
  const key =
    process.env.CHAPA_SECRET_KEY ||
    (!isProduction ? process.env.CHAPA_TEST_SECRET_KEY : undefined);
  if (!key) {
    throw new Error("Chapa secret key is not configured");
  }
  return key;
}

const TRANSFER_TIMEOUT_MS = 15_000;
const TRANSFER_RETRY_BACKOFFS_MS = [500, 1500];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createTransfer(payload: {
  amount: number;
  currency: string;
  account_name: string;
  account_number: string;
  bank_code: string;
  reference: string;
}) {
  const secretKey = await getChapaSecret();

  const maxAttempts = TRANSFER_RETRY_BACKOFFS_MS.length + 1;
  let lastErrorMessage = "Transfer request failed";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TRANSFER_TIMEOUT_MS);

    try {
      const response = await fetch("https://api.chapa.co/v1/transfers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          amount: payload.amount.toString(),
          currency: payload.currency,
          account_name: payload.account_name,
          account_number: payload.account_number,
          bank_code: payload.bank_code,
          reference: payload.reference,
        }),
      });

      let data: ChapaTransferResponse | null = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok || data?.status !== "success") {
        const message =
          typeof data?.message === "string"
            ? data.message
            : `Transfer initiation failed (status ${response.status})`;
        throw new Error(message);
      }

      return data;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        lastErrorMessage = `Transfer request timed out after ${TRANSFER_TIMEOUT_MS}ms`;
      } else if (error instanceof Error) {
        lastErrorMessage = error.message;
      } else {
        lastErrorMessage = "Transfer request failed";
      }

      if (attempt < maxAttempts) {
        const backoffMs = TRANSFER_RETRY_BACKOFFS_MS[attempt - 1] ?? 0;
        if (backoffMs > 0) {
          await sleep(backoffMs);
        }
        continue;
      }

      throw new Error(
        `${lastErrorMessage}. Reference: ${payload.reference}. Attempts: ${maxAttempts}.`
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(
    `Transfer request failed. Reference: ${payload.reference}. Attempts: ${maxAttempts}.`
  );
}

export const getTransferContext = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      return null;
    }

    const existingPayout = await ctx.db
      .query("payouts")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();

    const payment = order.paymentId ? await ctx.db.get(order.paymentId) : null;

    const sellerUser = order.sellerId
      ? await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", order.sellerId!))
          .first()
      : null;

    const business = sellerUser
      ? await ctx.db
          .query("businesses")
          .withIndex("by_owner", (q) => q.eq("ownerId", sellerUser._id))
          .first()
      : null;

    return {
      order,
      payment,
      existingPayout,
      sellerUser,
      business,
    };
  },
});

export const preparePayoutAttempt = internalMutation({
  args: {
    orderId: v.id("orders"),
    sellerId: v.string(),
    paymentId: v.optional(v.id("payments")),
    amountGross: v.number(),
    platformFeeSeller: v.number(),
    processorFeeAllocated: v.number(),
    amountNet: v.number(),
    currency: v.string(),
    reference: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("payouts")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();

    const now = Date.now();

    if (existing) {
      const attempts = existing.attempts + 1;
      await ctx.db.patch(existing._id, {
        paymentId: args.paymentId,
        amountGross: args.amountGross,
        platformFeeSeller: args.platformFeeSeller,
        processorFeeAllocated: args.processorFeeAllocated,
        amountNet: args.amountNet,
        currency: args.currency,
        reference: args.reference,
        status: "pending",
        attempts,
        lastError: undefined,
        updatedAt: now,
      });
      return await ctx.db.get(existing._id);
    }

    const payoutId = await ctx.db.insert("payouts", {
      orderId: args.orderId,
      sellerId: args.sellerId,
      paymentId: args.paymentId,
      amountGross: args.amountGross,
      platformFeeSeller: args.platformFeeSeller,
      processorFeeAllocated: args.processorFeeAllocated,
      amountNet: args.amountNet,
      currency: args.currency,
      status: "pending",
      reference: args.reference,
      attempts: 1,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(payoutId);
  },
});

export const updatePayoutStatus = internalMutation({
  args: {
    payoutId: v.id("payouts"),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("queued"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("reverted")
    ),
    chapaReference: v.optional(v.string()),
    bankReference: v.optional(v.string()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.payoutId, {
      status: args.status,
      chapaReference: args.chapaReference,
      bankReference: args.bankReference,
      lastError: args.lastError,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.payoutId);
  },
});

export const listRetryable = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("payouts")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const failed = await ctx.db
      .query("payouts")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect();

    return [...pending, ...failed].filter((payout) => {
      if (payout.attempts >= MAX_ATTEMPTS) return false;
      const backoff = getBackoffMs(payout.attempts);
      return args.now - payout.updatedAt >= backoff;
    });
  },
});

async function performTransfer(
  ctx: ActionCtx,
  args: {
    orderId: Id<"orders">;
    initiatedByClerkId?: string;
  }
): Promise<Doc<"payouts"> | null> {
  const log = createLogger("payouts.performTransfer");

  const context = await ctx.runQuery(
    internal.payouts.getTransferContext,
    { orderId: args.orderId }
  );

  if (!context?.order) {
    throw new Error("Order not found");
  }

  if (args.initiatedByClerkId && context.order.sellerId !== args.initiatedByClerkId) {
    throw new Error("Unauthorized");
  }

  if (!context.order.sellerId) {
    throw new Error("Order is missing seller information");
  }

  if (context.order.status !== "completed") {
    throw new Error("Order must be completed before payout");
  }

  if (!context.payment || context.payment.status !== "success") {
    throw new Error("Payment must be successful before payout");
  }

  if (!context.business) {
    throw new Error("Seller business not found");
  }

  const { payoutBankCode, payoutAccountNumber, payoutAccountName } = context.business;

  if (!payoutBankCode || !payoutAccountNumber || !payoutAccountName) {
    throw new Error("Seller payout bank details are required");
  }

  const amountGross = context.order.amount;
  const platformFeeSeller = roundCurrency(amountGross * 0.01);
  const paymentTotal = context.payment.amount || amountGross;
  const processorFeeTotal = context.payment.processorFeeTotal || 0;
  // Allocate processor fees proportionally by this order's share of the total payment.
  const processorFeeAllocated =
    paymentTotal > 0
      ? roundCurrency(processorFeeTotal * (amountGross / paymentTotal))
      : 0;
  const amountNet = Math.max(
    0,
    roundCurrency(amountGross - platformFeeSeller - processorFeeAllocated)
  );

  if (amountNet <= 0) {
    throw new Error("Net payout amount must be greater than zero");
  }

  const payoutCurrency = context.payment.currency || "ETB";

  if (context.existingPayout) {
    if (["success", "queued", "approved"].includes(context.existingPayout.status)) {
      return context.existingPayout;
    }

    if (context.existingPayout.attempts >= MAX_ATTEMPTS) {
      throw new Error("Maximum payout attempts reached");
    }

    if (context.existingPayout.status === "pending" && args.initiatedByClerkId) {
      const payoutMatchesCurrent =
        context.existingPayout.amountGross === amountGross &&
        context.existingPayout.platformFeeSeller === platformFeeSeller &&
        context.existingPayout.processorFeeAllocated === processorFeeAllocated &&
        context.existingPayout.amountNet === amountNet &&
        context.existingPayout.currency === payoutCurrency;

      if (!payoutMatchesCurrent) {
        throw new Error("Payout details have changed; please contact support");
      }

      if (
        context.business.payoutUpdatedAt !== undefined &&
        context.business.payoutUpdatedAt > context.existingPayout.createdAt
      ) {
        throw new Error("Payout details have changed; please contact support");
      }

      return context.existingPayout;
    }
  }

  const attemptNumber = (context.existingPayout?.attempts || 0) + 1;
  const reference = buildReference(context.order._id, attemptNumber);

  const payout = await ctx.runMutation(
    internal.payouts.preparePayoutAttempt,
    {
      orderId: context.order._id,
      sellerId: context.order.sellerId,
      paymentId: context.payment._id,
      amountGross,
      platformFeeSeller,
      processorFeeAllocated,
      amountNet,
      currency: payoutCurrency,
      reference,
    }
  );

  if (!payout) {
    throw new Error("Failed to create payout record");
  }

  try {
    const transferResponse = await createTransfer({
      amount: amountNet,
      currency: payoutCurrency,
      account_name: payoutAccountName,
      account_number: payoutAccountNumber,
      bank_code: payoutBankCode,
      reference,
    });

    const chapaReference =
      typeof transferResponse.data?.chapa_reference === "string"
        ? transferResponse.data.chapa_reference
        : typeof transferResponse.data?.reference === "string"
          ? transferResponse.data.reference
          : undefined;
    const bankReference =
      typeof transferResponse.data?.bank_reference === "string"
        ? transferResponse.data.bank_reference
        : undefined;

    const updated = await ctx.runMutation(
      internal.payouts.updatePayoutStatus,
      {
        payoutId: payout._id,
        status: "queued",
        chapaReference,
        bankReference,
      }
    );

    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfer failed";
    await ctx.runMutation(
      internal.payouts.updatePayoutStatus,
      {
        payoutId: payout._id,
        status: "failed",
        lastError: message,
      }
    );
    log.error("Transfer failed", error, { orderId: context.order._id });
    await flushLogs();
    throw error;
  }
}

export const transferForOrder = action({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args): Promise<Doc<"payouts"> | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    return await performTransfer(ctx, {
      orderId: args.orderId,
      initiatedByClerkId: identity.subject,
    });
  },
});

export const retryFailedPayouts = internalAction({
  args: {},
  handler: async (ctx) => {
    const log = createLogger("payouts.retryFailedPayouts");
    const now = Date.now();
    const payouts = await ctx.runQuery(
      internal.payouts.listRetryable,
      { now }
    );

    log.info("Starting retry batch", { payoutCount: payouts.length });

    let successCount = 0;
    let failCount = 0;

    for (const payout of payouts) {
      try {
        await performTransfer(ctx, { orderId: payout.orderId });
        successCount++;
        log.info("Payout retry successful", {
          payoutId: payout._id,
          orderId: payout.orderId,
          attempt: payout.attempts + 1,
        });
      } catch (error) {
        failCount++;
        log.error("Payout retry failed", error, {
          payoutId: payout._id,
          orderId: payout.orderId,
          attempt: payout.attempts + 1,
        });
      }
    }

    log.info("Retry batch completed", { successCount, failCount, total: payouts.length });
    await flushLogs();
  },
});

export const listForSeller = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return [];

    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_seller", (q) => q.eq("sellerId", user.clerkId))
      .collect();

    return payouts.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getByOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) return null;

    const isBuyer = order.userId === user._id || order.buyerId === user._id;
    const isSeller = order.sellerId === user.clerkId;

    if (!isBuyer && !isSeller) {
      throw new Error("Unauthorized");
    }

    return await ctx.db
      .query("payouts")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();
  },
});

export const getByReference = query({
  args: { reference: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payouts")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .first();
  },
});

// Internal mutation for setting payout status - used by webhook handlers
export const setStatusInternal = internalMutation({
  args: {
    payoutId: v.id("payouts"),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("queued"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("reverted")
    ),
    chapaReference: v.optional(v.string()),
    bankReference: v.optional(v.string()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const log = createLogger("payouts.setStatusInternal");
    
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) {
      log.error("Payout not found for status update", undefined, { payoutId: args.payoutId });
      await flushLogs();
      throw new Error("Payout not found");
    }

    // Validate state transitions - prevent going backwards from terminal states
    const terminalStates = ["success", "reverted"];
    if (terminalStates.includes(payout.status) && payout.status !== args.status) {
      log.warn("Attempted invalid state transition", {
        payoutId: args.payoutId,
        currentStatus: payout.status,
        attemptedStatus: args.status,
      });
      await flushLogs();
      // Return existing payout without updating
      return payout;
    }

    await ctx.db.patch(args.payoutId, {
      status: args.status,
      chapaReference: args.chapaReference,
      bankReference: args.bankReference,
      lastError: args.lastError,
      updatedAt: Date.now(),
    });

    log.info("Payout status updated", {
      payoutId: args.payoutId,
      previousStatus: payout.status,
      newStatus: args.status,
    });
    await flushLogs();

    return await ctx.db.get(args.payoutId);
  },
});

// Public action for webhook handlers to update payout status
// This wraps the internal mutation so webhooks can call via ConvexHttpClient
export const setPayoutStatusFromWebhook = action({
  args: {
    payoutId: v.id("payouts"),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("queued"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("reverted")
    ),
    chapaReference: v.optional(v.string()),
    bankReference: v.optional(v.string()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Doc<"payouts"> | null> => {
    return await ctx.runMutation(internal.payouts.setStatusInternal, {
      payoutId: args.payoutId,
      status: args.status,
      chapaReference: args.chapaReference,
      bankReference: args.bankReference,
      lastError: args.lastError,
    });
  },
});
