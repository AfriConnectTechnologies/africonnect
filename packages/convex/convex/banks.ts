import { mutation, query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { getOrCreateUser, requireAdmin, requireBank } from "./helpers";

const REFERRAL_STATUS_RANK = {
  generated: 0,
  signed_up: 1,
  business_created: 2,
  verified: 3,
  active: 4,
} as const;

function slugifyBankName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function buildReferralPrefix(slug: string) {
  const compact = slug.replace(/-/g, "").toUpperCase();
  return compact.slice(0, 6) || "BANK";
}

function buildReferralCode(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getStageRank(stage: keyof typeof REFERRAL_STATUS_RANK) {
  return REFERRAL_STATUS_RANK[stage];
}

function maxStage(
  left: keyof typeof REFERRAL_STATUS_RANK,
  right: keyof typeof REFERRAL_STATUS_RANK
) {
  return getStageRank(left) >= getStageRank(right) ? left : right;
}

async function getPortfolioBusinessRows(ctx: QueryCtx, bankId: Id<"banks">) {
  const businesses = await ctx.db
    .query("businesses")
    .withIndex("by_referred_bank", (q) => q.eq("referredByBankId", bankId))
    .collect();

  return await Promise.all(
    businesses.map(async (business: Doc<"businesses">) => {
      const owner = await ctx.db.get(business.ownerId);
      const sellerId = owner?.clerkId;
      const [products, orders, payouts, referral] = await Promise.all([
        sellerId
          ? ctx.db
              .query("products")
              .withIndex("by_seller", (q) => q.eq("sellerId", sellerId))
              .collect()
          : Promise.resolve([]),
        sellerId
          ? ctx.db
              .query("orders")
              .withIndex("by_seller", (q) => q.eq("sellerId", sellerId))
              .collect()
          : Promise.resolve([]),
        sellerId
          ? ctx.db
              .query("payouts")
              .withIndex("by_seller", (q) => q.eq("sellerId", sellerId))
              .collect()
          : Promise.resolve([]),
        business.bankReferralId ? ctx.db.get(business.bankReferralId) : Promise.resolve(null),
      ]);

      const completedOrders = orders.filter((order: Doc<"orders">) => order.status === "completed");
      const revenue = completedOrders.reduce(
        (sum: number, order: Doc<"orders">) => sum + order.amount,
        0
      );
      const payoutTotal = payouts
        .filter((payout: Doc<"payouts">) => payout.status === "success")
        .reduce((sum: number, payout: Doc<"payouts">) => sum + payout.amountNet, 0);
      const lastOrderAt = orders.reduce(
        (latest: number | null, order: Doc<"orders">) =>
          latest === null || order.createdAt > latest ? order.createdAt : latest,
        null
      );
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const isActive =
        !!lastOrderAt && lastOrderAt >= thirtyDaysAgo
          ? true
          : products.some((product: Doc<"products">) => product.createdAt >= thirtyDaysAgo);

      let onboardingStage: keyof typeof REFERRAL_STATUS_RANK = "business_created";
      if (business.verificationStatus === "verified") {
        onboardingStage = "verified";
      }
      if (referral) {
        onboardingStage = maxStage(onboardingStage, referral.status);
      }
      if (isActive) {
        onboardingStage = "active";
      }

      return {
        business,
        owner,
        referral,
        orders,
        metrics: {
          productCount: products.length,
          orderCount: orders.length,
          completedOrderCount: completedOrders.length,
          revenue,
          payoutTotal,
          lastOrderAt,
          isActive,
          onboardingStage,
        },
      };
    })
  );
}

async function getReferralRows(ctx: QueryCtx, bankId: Id<"banks">) {
  const referrals = await ctx.db
    .query("bankReferrals")
    .withIndex("by_bank", (q) => q.eq("bankId", bankId))
    .collect();

  return await Promise.all(
    referrals.map(async (referral: Doc<"bankReferrals">) => {
      const [invitedBy, acceptedUser, business] = await Promise.all([
        ctx.db.get(referral.invitedByUserId),
        referral.acceptedUserId ? ctx.db.get(referral.acceptedUserId) : Promise.resolve(null),
        referral.businessId ? ctx.db.get(referral.businessId) : Promise.resolve(null),
      ]);

      let effectiveStatus = referral.status;
      if (business?.verificationStatus === "verified") {
        effectiveStatus = maxStage(effectiveStatus, "verified");
      }

      return {
        ...referral,
        effectiveStatus,
        invitedBy,
        acceptedUser,
        business,
      };
    })
  );
}

export const listBanks = query({
  args: {
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let banks = await ctx.db.query("banks").collect();
    const bankUsers = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "bank"))
      .collect();

    if (args.search) {
      const search = args.search.toLowerCase();
      banks = banks.filter(
        (bank) =>
          bank.name.toLowerCase().includes(search) ||
          bank.slug.toLowerCase().includes(search)
      );
    }

    const banksWithStats = await Promise.all(
      banks.map(async (bank) => {
        const [referrals, businesses] = await Promise.all([
          ctx.db
            .query("bankReferrals")
            .withIndex("by_bank", (q) => q.eq("bankId", bank._id))
            .collect(),
          ctx.db
            .query("businesses")
            .withIndex("by_referred_bank", (q) => q.eq("referredByBankId", bank._id))
            .collect(),
        ]);

        return {
          ...bank,
          bankUsersCount: bankUsers.filter((user) => user.bankId === bank._id).length,
          referralsCount: referrals.length,
          portfolioCount: businesses.length,
        };
      })
    );

    return banksWithStats.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const createBank = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const now = Date.now();
    const baseSlug = slugifyBankName(args.name);
    let slug = baseSlug;
    let suffix = 1;

    while (
      await ctx.db
        .query("banks")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first()
    ) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const referralCodePrefix = buildReferralPrefix(slug);

    return await ctx.db.insert("banks", {
      name: args.name.trim(),
      slug,
      description: args.description?.trim() || undefined,
      status: "active",
      referralCodePrefix,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const assignUserToBank = mutation({
  args: {
    userId: v.id("users"),
    bankId: v.id("banks"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const [user, bank] = await Promise.all([
      ctx.db.get(args.userId),
      ctx.db.get(args.bankId),
    ]);

    if (!user) {
      throw new Error("User not found");
    }
    if (!bank) {
      throw new Error("Bank not found");
    }

    await ctx.db.patch(user._id, {
      role: "bank",
      bankId: bank._id,
      sellerApplicationStatus: undefined,
      sellerApplicationSubmittedAt: undefined,
      sellerApplicationReviewedAt: undefined,
      sellerApplicationReviewedBy: undefined,
    });

    return {
      userId: user._id,
      bankId: bank._id,
    };
  },
});

export const createReferral = mutation({
  args: {
    invitedEmail: v.optional(v.string()),
    companyName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireBank(ctx);
    const bank = await ctx.db.get(user.bankId!);

    if (!bank || bank.status !== "active") {
      throw new Error("Your bank account is not active.");
    }

    const now = Date.now();
    let referralCode = buildReferralCode(bank.referralCodePrefix);
    while (
      await ctx.db
        .query("bankReferrals")
        .withIndex("by_referral_code", (q) => q.eq("referralCode", referralCode))
        .first()
    ) {
      referralCode = buildReferralCode(bank.referralCodePrefix);
    }

    const referralId = await ctx.db.insert("bankReferrals", {
      bankId: bank._id,
      referralCode,
      invitedByUserId: user._id,
      invitedEmail: args.invitedEmail?.trim() || undefined,
      companyName: args.companyName?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      status: "generated",
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(referralId);
  },
});

export const captureReferralSignup = mutation({
  args: {
    referralCode: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateUser(ctx);

    if (user.role === "bank") {
      return null;
    }

    const referral = await ctx.db
      .query("bankReferrals")
      .withIndex("by_referral_code", (q) => q.eq("referralCode", args.referralCode))
      .first();

    if (!referral) {
      throw new Error("Invalid or expired bank referral code.");
    }

    if (user.bankReferralId && user.bankReferralId !== referral._id) {
      return await ctx.db.get(user.bankReferralId);
    }

    if (referral.acceptedUserId && referral.acceptedUserId !== user._id) {
      throw new Error("Referral already claimed");
    }

    const now = Date.now();
    const nextStatus =
      getStageRank(referral.status) >= getStageRank("signed_up")
        ? referral.status
        : "signed_up";

    await ctx.db.patch(referral._id, {
      acceptedUserId: user._id,
      acceptedAt: referral.acceptedAt ?? now,
      status: nextStatus,
      updatedAt: now,
    });

    await ctx.db.patch(user._id, {
      bankReferralId: referral._id,
    });

    return await ctx.db.get(referral._id);
  },
});

export const getMyBankReferrals = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireBank(ctx);
    const bank = await ctx.db.get(user.bankId!);
    const referrals = await getReferralRows(ctx, user.bankId!);

    return {
      bank,
      referrals: referrals.sort((a, b) => b.createdAt - a.createdAt),
    };
  },
});

export const getMyBankOverview = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireBank(ctx);
    const bank = await ctx.db.get(user.bankId!);
    const [portfolioRows, referrals] = await Promise.all([
      getPortfolioBusinessRows(ctx, user.bankId!),
      getReferralRows(ctx, user.bankId!),
    ]);

    const summary = portfolioRows.reduce(
      (acc, row) => {
        acc.portfolioBusinesses += 1;
        acc.verifiedBusinesses += row.business.verificationStatus === "verified" ? 1 : 0;
        acc.activeBusinesses += row.metrics.isActive ? 1 : 0;
        acc.totalProducts += row.metrics.productCount;
        acc.totalOrders += row.metrics.orderCount;
        acc.totalRevenue += row.metrics.revenue;
        acc.totalPayouts += row.metrics.payoutTotal;
        return acc;
      },
      {
        portfolioBusinesses: 0,
        verifiedBusinesses: 0,
        activeBusinesses: 0,
        totalProducts: 0,
        totalOrders: 0,
        totalRevenue: 0,
        totalPayouts: 0,
      }
    );

    const funnel = {
      referred: referrals.length,
      signedUp: referrals.filter((referral) =>
        getStageRank(referral.effectiveStatus) >= getStageRank("signed_up")
      ).length,
      businessCreated: referrals.filter((referral) =>
        getStageRank(referral.effectiveStatus) >= getStageRank("business_created")
      ).length,
      verified: referrals.filter((referral) =>
        getStageRank(referral.effectiveStatus) >= getStageRank("verified")
      ).length,
      active: portfolioRows.filter((row) => row.metrics.isActive).length,
    };

    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index), 1);
      date.setHours(0, 0, 0, 0);
      return {
        label: formatMonthLabel(date),
        start: date.getTime(),
        end: new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime(),
      };
    });

    const monthlyPerformance = months.map((month) => ({
      month: month.label,
      referred: referrals.filter(
        (referral) => referral.createdAt >= month.start && referral.createdAt < month.end
      ).length,
      onboarded: referrals.filter(
        (referral) =>
          !!referral.acceptedAt &&
          referral.acceptedAt >= month.start &&
          referral.acceptedAt < month.end
      ).length,
      verified: referrals.filter(
        (referral) =>
          !!referral.verifiedAt &&
          referral.verifiedAt >= month.start &&
          referral.verifiedAt < month.end
      ).length,
      revenue: portfolioRows.reduce((sum, row) => {
        const inMonthRevenue = row.orders
          .filter(
            (order: Doc<"orders">) =>
              order.status === "completed" &&
              order.createdAt >= month.start &&
              order.createdAt < month.end
          )
          .reduce((orderSum: number, order: Doc<"orders">) => orderSum + order.amount, 0);
        return sum + inMonthRevenue;
      }, 0),
    }));

    const recentPortfolio = portfolioRows
      .sort((a, b) => b.business.createdAt - a.business.createdAt)
      .slice(0, 5);
    const recentReferrals = referrals
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    return {
      bank,
      summary: {
        totalReferrals: referrals.length,
        ...summary,
      },
      funnel,
      monthlyPerformance,
      recentPortfolio,
      recentReferrals,
    };
  },
});

export const getMyBankPortfolio = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("generated"),
        v.literal("signed_up"),
        v.literal("business_created"),
        v.literal("verified"),
        v.literal("active")
      )
    ),
    country: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireBank(ctx);
    let portfolioRows = await getPortfolioBusinessRows(ctx, user.bankId!);

    if (args.search) {
      const search = args.search.toLowerCase();
      portfolioRows = portfolioRows.filter((row) => {
        const ownerName = row.owner?.name?.toLowerCase() ?? "";
        const ownerEmail = row.owner?.email?.toLowerCase() ?? "";
        return (
          row.business.name.toLowerCase().includes(search) ||
          ownerName.includes(search) ||
          ownerEmail.includes(search)
        );
      });
    }

    if (args.status) {
      portfolioRows = portfolioRows.filter((row) => row.metrics.onboardingStage === args.status);
    }

    if (args.country) {
      portfolioRows = portfolioRows.filter((row) => row.business.country === args.country);
    }

    if (args.category) {
      portfolioRows = portfolioRows.filter((row) => row.business.category === args.category);
    }

    return portfolioRows.sort((a, b) => b.business.createdAt - a.business.createdAt);
  },
});

export const getMyBankBusinessDetail = query({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const user = await requireBank(ctx);
    const business = await ctx.db.get(args.businessId);

    if (!business || business.referredByBankId !== user.bankId) {
      throw new Error("Business not found in your bank portfolio.");
    }

    const portfolioRows = await getPortfolioBusinessRows(ctx, user.bankId!);
    const detail = portfolioRows.find((entry) => entry.business._id === args.businessId);

    if (!detail) {
      throw new Error("Business not found in your bank portfolio.");
    }

    const ownerClerkId = detail.owner?.clerkId;
    const orders = ownerClerkId
      ? await ctx.db
          .query("orders")
          .withIndex("by_seller", (q) => q.eq("sellerId", ownerClerkId))
          .collect()
      : [];

    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index), 1);
      date.setHours(0, 0, 0, 0);
      const start = date.getTime();
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
      return {
        month: formatMonthLabel(date),
        revenue: orders
          .filter(
            (order) =>
              order.status === "completed" &&
              order.createdAt >= start &&
              order.createdAt < end
          )
          .reduce((sum, order) => sum + order.amount, 0),
        orders: orders.filter(
          (order) => order.createdAt >= start && order.createdAt < end
        ).length,
      };
    });

    return {
      ...detail,
      monthlyPerformance: months,
    };
  },
});

export const getMyBankAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireBank(ctx);
    const portfolioRows = await getPortfolioBusinessRows(ctx, user.bankId!);

    const categoryMap = new Map<string, number>();
    const countryMap = new Map<string, number>();
    const stageMap = new Map<string, number>();

    for (const row of portfolioRows) {
      categoryMap.set(
        row.business.category,
        (categoryMap.get(row.business.category) ?? 0) + 1
      );
      countryMap.set(
        row.business.country,
        (countryMap.get(row.business.country) ?? 0) + 1
      );
      stageMap.set(
        row.metrics.onboardingStage,
        (stageMap.get(row.metrics.onboardingStage) ?? 0) + 1
      );
    }

    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index), 1);
      date.setHours(0, 0, 0, 0);
      const start = date.getTime();
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();

      return {
        month: formatMonthLabel(date),
        newBusinesses: portfolioRows.filter(
          (row) => row.business.createdAt >= start && row.business.createdAt < end
        ).length,
        activeBusinesses: portfolioRows.filter(
          (row) => row.metrics.isActive && row.business.createdAt < end
        ).length,
        revenue: portfolioRows.reduce((sum, row) => {
          const inMonthRevenue = row.orders
            .filter(
              (order: Doc<"orders">) =>
                order.status === "completed" &&
                order.createdAt >= start &&
                order.createdAt < end
            )
            .reduce((orderSum: number, order: Doc<"orders">) => orderSum + order.amount, 0);
          return sum + inMonthRevenue;
        }, 0),
      };
    });

    return {
      segments: {
        categories: Array.from(categoryMap.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value),
        countries: Array.from(countryMap.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value),
        stages: Array.from(stageMap.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value),
      },
      trends: months,
    };
  },
});
