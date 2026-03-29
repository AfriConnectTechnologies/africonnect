import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser, getOrCreateUser, requireUser } from "./helpers";
import { Id } from "./_generated/dataModel";

const agreementTypeValidator = v.union(v.literal("seller"), v.literal("buyer"));

function getDefaultAgreementContentKey(type: "seller" | "buyer"): string {
  return type === "seller" ? "agreements.seller" : "agreements.buyer";
}

export const getActiveAgreement = query({
  args: {
    type: agreementTypeValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agreementVersions")
      .withIndex("by_type_active", (q) =>
        q.eq("type", args.type).eq("isActive", true)
      )
      .first();
  },
});

export const hasAcceptedCurrentAgreement = query({
  args: {
    type: agreementTypeValidator,
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return { status: "unauthenticated" as const, accepted: false };
    }

    const activeVersion = await ctx.db
      .query("agreementVersions")
      .withIndex("by_type_active", (q) =>
        q.eq("type", args.type).eq("isActive", true)
      )
      .first();

    if (!activeVersion) {
      return {
        status: "missing_active_version" as const,
        accepted: false,
      };
    }

    const acceptance = await ctx.db
      .query("agreementAcceptances")
      .withIndex("by_user_type_version", (q) =>
        q
          .eq("userId", user._id)
          .eq("agreementType", args.type)
          .eq("agreementVersionId", activeVersion._id)
      )
      .first();

    if (acceptance) {
      return { status: "accepted" as const, accepted: true };
    }

    return { status: "not_accepted" as const, accepted: false };
  },
});

export const hasAcceptedAgreement = query({
  args: {
    userId: v.id("users"),
    type: agreementTypeValidator,
  },
  handler: async (ctx, args) => {
    const activeVersion = await ctx.db
      .query("agreementVersions")
      .withIndex("by_type_active", (q) =>
        q.eq("type", args.type).eq("isActive", true)
      )
      .first();

    if (!activeVersion) {
      return false;
    }

    const acceptance = await ctx.db
      .query("agreementAcceptances")
      .withIndex("by_user_type_version", (q) =>
        q
          .eq("userId", args.userId)
          .eq("agreementType", args.type)
          .eq("agreementVersionId", activeVersion._id)
      )
      .first();

    return !!acceptance;
  },
});

export const getUserAgreements = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const acceptances = await ctx.db
      .query("agreementAcceptances")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const acceptancesWithVersion = await Promise.all(
      acceptances.map(async (acceptance) => {
        const version = await ctx.db.get(acceptance.agreementVersionId);
        if (!version) {
          return null;
        }
        return { ...acceptance, version };
      })
    );

    return acceptancesWithVersion
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.acceptedAt - a.acceptedAt);
  },
});

export const acceptAgreement = mutation({
  args: {
    type: agreementTypeValidator,
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateUser(ctx);
    const activeVersion = await ctx.db
      .query("agreementVersions")
      .withIndex("by_type_active", (q) =>
        q.eq("type", args.type).eq("isActive", true)
      )
      .first();

    if (!activeVersion) {
      throw new Error(
        "No active agreement version is configured. Please contact an administrator."
      );
    }

    const existingAcceptance = await ctx.db
      .query("agreementAcceptances")
      .withIndex("by_user_type_version", (q) =>
        q
          .eq("userId", user._id)
          .eq("agreementType", args.type)
          .eq("agreementVersionId", activeVersion._id)
      )
      .first();

    if (existingAcceptance) {
      return existingAcceptance;
    }

    const acceptanceId = await ctx.db.insert("agreementAcceptances", {
      userId: user._id,
      agreementType: args.type,
      agreementVersionId: activeVersion._id,
      acceptedAt: Date.now(),
      userAgent: args.userAgent,
    });

    // Race-safe dedupe: concurrent calls can both pass the pre-check.
    // Keep the earliest acceptance by acceptedAt; use _id only as tie-breaker.
    const duplicates = await ctx.db
      .query("agreementAcceptances")
      .withIndex("by_user_type_version", (q) =>
        q
          .eq("userId", user._id)
          .eq("agreementType", args.type)
          .eq("agreementVersionId", activeVersion._id)
      )
      .collect();

    if (duplicates.length > 1) {
      duplicates.sort((a, b) => {
        if (a.acceptedAt !== b.acceptedAt) {
          return a.acceptedAt - b.acceptedAt;
        }
        return a._id < b._id ? -1 : 1;
      });
      const winner = duplicates[0];

      if (winner._id !== acceptanceId) {
        await ctx.db.delete(acceptanceId);
        return winner;
      }

      for (const duplicate of duplicates.slice(1)) {
        await ctx.db.delete(duplicate._id);
      }
      return winner;
    }

    const canonicalAcceptance = await ctx.db
      .query("agreementAcceptances")
      .withIndex("by_user_type_version", (q) =>
        q
          .eq("userId", user._id)
          .eq("agreementType", args.type)
          .eq("agreementVersionId", activeVersion._id)
      )
      .first();

    if (!canonicalAcceptance) {
      throw new Error("Failed to persist agreement acceptance");
    }

    return canonicalAcceptance;
  },
});

async function requireAdminInMutation(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized: Authentication required");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user || user.role !== "admin") {
    throw new Error("Unauthorized: Admin access required");
  }

  return user;
}

export const createAgreementVersion = mutation({
  args: {
    type: agreementTypeValidator,
    version: v.string(),
    contentKey: v.string(),
    requireReacceptance: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdminInMutation(ctx);
    const now = Date.now();
    const versionId = await ctx.db.insert("agreementVersions", {
      type: args.type,
      version: args.version,
      contentKey: args.contentKey,
      isActive: false,
      requireReacceptance: args.requireReacceptance,
      effectiveDate: now,
      createdAt: now,
    });

    return await ctx.db.get(versionId);
  },
});

export const activateAgreementVersion = mutation({
  args: {
    versionId: v.id("agreementVersions"),
  },
  handler: async (ctx, args) => {
    await requireAdminInMutation(ctx);
    const version = await ctx.db.get(args.versionId);
    if (!version) {
      throw new Error("Agreement version not found");
    }

    const currentlyActive = await ctx.db
      .query("agreementVersions")
      .withIndex("by_type_active", (q) =>
        q.eq("type", version.type).eq("isActive", true)
      )
      .collect();

    for (const active of currentlyActive) {
      if (active._id !== args.versionId) {
        await ctx.db.patch(active._id, {
          isActive: false,
        });
      }
    }

    await ctx.db.patch(args.versionId, {
      isActive: true,
      effectiveDate: Date.now(),
    });

    return await ctx.db.get(args.versionId);
  },
});

export const seedDefaultAgreementVersions = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminInMutation(ctx);
    const now = Date.now();
    const seeded: Id<"agreementVersions">[] = [];

    for (const type of ["seller", "buyer"] as const) {
      const active = await ctx.db
        .query("agreementVersions")
        .withIndex("by_type_active", (q) =>
          q.eq("type", type).eq("isActive", true)
        )
        .first();
      if (active) {
        continue;
      }

      const createdId = await ctx.db.insert("agreementVersions", {
        type,
        version: "1.0",
        contentKey: getDefaultAgreementContentKey(type),
        isActive: true,
        effectiveDate: now,
        createdAt: now,
      });
      seeded.push(createdId);
    }

    return seeded;
  },
});
