import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { hasSellerAccess, requireUser } from "./helpers";

const SETTLED_PAYMENT_STATUSES = new Set(["success"]);

const TERMINAL_ORDER_STATUSES = new Set(["completed", "cancelled"]);
const RESOLVED_PAYOUT_STATUSES = new Set(["success", "failed", "reverted"]);
const CREDIT_PROFILE_ORDER_LIMIT = 500;
const CREDIT_PROFILE_PAYOUT_LIMIT = 500;

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function toPercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return roundToTwo((numerator / denominator) * 100);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function startOfWindow(days: number, now: number) {
  return now - days * 24 * 60 * 60 * 1000;
}

type BuyerAggregate = {
  buyerId: string;
  name: string;
  orderCount: number;
  revenueByCurrency: Map<string, number>;
  country: string | null;
  category: string | null;
  hasBusinessMetadata: boolean;
};

type CurrencyBucket = {
  currency: string;
  amount: number;
};

type CurrencyRateBucket = {
  currency: string;
  rate: number;
};

function addCurrencyAmount(
  totals: Map<string, number>,
  currency: string,
  amount: number
) {
  totals.set(currency, roundToTwo((totals.get(currency) ?? 0) + amount));
}

function bucketsFromTotals(totals: Map<string, number>): CurrencyBucket[] {
  return Array.from(totals.entries())
    .map(([currency, amount]) => ({
      currency,
      amount: roundToTwo(amount),
    }))
    .sort((a, b) => b.amount - a.amount);
}

function bucketOrderAmountsByCurrency(
  orders: Array<{ amount: number; payment?: Doc<"payments"> | null }>
): CurrencyBucket[] {
  const totals = new Map<string, number>();

  for (const order of orders) {
    const currency = order.payment?.currency ?? "USD";
    addCurrencyAmount(totals, currency, order.amount);
  }

  return bucketsFromTotals(totals);
}

function bucketAverageOrderValuesByCurrency(
  orders: Array<{ amount: number; payment?: Doc<"payments"> | null }>
): CurrencyBucket[] {
  const totals = new Map<string, { total: number; count: number }>();

  for (const order of orders) {
    const currency = order.payment?.currency ?? "USD";
    const current = totals.get(currency) ?? { total: 0, count: 0 };
    totals.set(currency, {
      total: current.total + order.amount,
      count: current.count + 1,
    });
  }

  return Array.from(totals.entries())
    .map(([currency, value]) => ({
      currency,
      amount: roundToTwo(value.total / value.count),
    }))
    .sort((a, b) => b.amount - a.amount);
}

function getCanonicalCurrency(currencyBuckets: CurrencyBucket[]) {
  return currencyBuckets[0]?.currency ?? "USD";
}

function getBucketAmount(currencyBuckets: CurrencyBucket[], currency: string) {
  return currencyBuckets.find((bucket) => bucket.currency === currency)?.amount ?? 0;
}

function topBuyerConcentrationByCurrency(
  buyers: BuyerAggregate[],
  totalVolumesByCurrency: CurrencyBucket[]
): CurrencyRateBucket[] {
  return totalVolumesByCurrency.map(({ currency, amount }) => {
    const topAmount = buyers.reduce((max, buyer) => {
      return Math.max(max, buyer.revenueByCurrency.get(currency) ?? 0);
    }, 0);

    return {
      currency,
      rate: toPercent(topAmount, amount),
    };
  });
}

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    if (!user.businessId) {
      return {
        access: {
          state: "no_business",
          title: "Register your business",
          message:
            "A digital credit profile becomes available after you register and verify a business.",
        },
        business: null,
        reportMeta: null,
        profile: null,
      } as const;
    }

    const business = await ctx.db.get(user.businessId);
    if (!business) {
      return {
        access: {
          state: "business_missing",
          title: "Business record not found",
          message:
            "Your account is linked to a business record that is no longer available.",
        },
        business: null,
        reportMeta: null,
        profile: null,
      } as const;
    }

    if (business.verificationStatus !== "verified") {
      return {
        access: {
          state:
            business.verificationStatus === "rejected"
              ? "rejected_verification"
              : "pending_verification",
          title:
            business.verificationStatus === "rejected"
              ? "Verification required"
              : "Verification in progress",
          message:
            business.verificationStatus === "rejected"
              ? "Resolve your business verification first to unlock the digital credit profile."
              : "Your digital credit profile will unlock once the business is verified.",
        },
        business: {
          id: business._id,
          name: business.name,
          category: business.category,
          country: business.country,
          verificationStatus: business.verificationStatus,
          createdAt: business.createdAt,
        },
        reportMeta: null,
        profile: null,
      } as const;
    }

    if (!hasSellerAccess(user)) {
      return {
        access: {
          state: "not_seller",
          title: "Seller access required",
          message:
            "Only verified seller accounts can access the digital credit profile.",
        },
        business: {
          id: business._id,
          name: business.name,
          category: business.category,
          country: business.country,
          verificationStatus: business.verificationStatus,
          createdAt: business.createdAt,
        },
        reportMeta: null,
        profile: null,
      } as const;
    }

    const now = Date.now();
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_seller", (q) => q.eq("sellerId", user.clerkId))
      .order("desc")
      .take(CREDIT_PROFILE_ORDER_LIMIT);
    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_seller", (q) => q.eq("sellerId", user.clerkId))
      .order("desc")
      .take(CREDIT_PROFILE_PAYOUT_LIMIT);

    const payoutByOrderId = new Map(
      payouts.map((payout) => [payout.orderId.toString(), payout])
    );

    const paymentIdByKey = new Map<string, Id<"payments">>();
    const buyerDocIdByKey = new Map<string, Id<"users">>();

    for (const order of orders) {
      if (order.paymentId) {
        paymentIdByKey.set(order.paymentId.toString(), order.paymentId);
      }

      const buyerDocId = ctx.db.normalizeId(
        "users",
        (order.buyerId ?? order.userId) as string
      );
      if (buyerDocId) {
        buyerDocIdByKey.set(buyerDocId.toString(), buyerDocId);
      }
    }

    const paymentEntries = await Promise.all(
      Array.from(paymentIdByKey.values()).map(async (paymentId) => {
        const payment = await ctx.db.get(paymentId);
        return payment
          ? ([payment._id.toString(), payment] as const)
          : null;
      })
    );
    const paymentById = new Map<string, Doc<"payments">>();
    for (const entry of paymentEntries) {
      if (entry) {
        paymentById.set(entry[0], entry[1]);
      }
    }

    const buyerEntries = await Promise.all(
      Array.from(buyerDocIdByKey.values()).map(async (buyerDocId) => {
        const buyer = await ctx.db.get(buyerDocId);
        return buyer
          ? ([buyer._id.toString(), buyer] as const)
          : null;
      })
    );
    const buyerByDocId = new Map<string, Doc<"users">>();
    for (const entry of buyerEntries) {
      if (entry) {
        buyerByDocId.set(entry[0], entry[1]);
      }
    }

    const businessIdByKey = new Map<string, Id<"businesses">>();
    for (const buyer of buyerByDocId.values()) {
      if (buyer.businessId) {
        businessIdByKey.set(buyer.businessId.toString(), buyer.businessId);
      }
    }

    const buyerBusinessEntries = await Promise.all(
      Array.from(businessIdByKey.values()).map(async (businessId) => {
        const buyerBusiness = await ctx.db.get(businessId);
        return buyerBusiness
          ? ([buyerBusiness._id.toString(), buyerBusiness] as const)
          : null;
      })
    );
    const businessById = new Map<string, Doc<"businesses">>();
    for (const entry of buyerBusinessEntries) {
      if (entry) {
        businessById.set(entry[0], entry[1]);
      }
    }

    const enrichedOrders = orders.map((order) => {
      const payment = order.paymentId
        ? paymentById.get(order.paymentId.toString()) ?? null
        : null;
      const buyerDocId = ctx.db.normalizeId(
        "users",
        (order.buyerId ?? order.userId) as string
      );
      const buyer = buyerDocId
        ? buyerByDocId.get(buyerDocId.toString()) ?? null
        : null;
      const buyerBusiness = buyer?.businessId
        ? businessById.get(buyer.businessId.toString()) ?? null
        : null;

      return {
        ...order,
        payment,
        payout: payoutByOrderId.get(order._id.toString()) ?? null,
        buyer,
        buyerBusiness,
      };
    });

    const sortedOrders = enrichedOrders.sort((a, b) => b.createdAt - a.createdAt);
    const selectedOrderIds = new Set(
      sortedOrders
        .slice(0, CREDIT_PROFILE_PAYOUT_LIMIT)
        .map((order) => order._id.toString())
    );
    const windowPayouts = payouts.filter((payout) =>
      selectedOrderIds.has(payout.orderId.toString())
    );
    const paidOrders = sortedOrders.filter(
      (order) => order.payment && SETTLED_PAYMENT_STATUSES.has(order.payment.status)
    );
    const ordersWithPayments = sortedOrders.filter((order) => Boolean(order.payment));
    const terminalOrders = sortedOrders.filter((order) =>
      TERMINAL_ORDER_STATUSES.has(order.status)
    );
    const resolvedPayouts = windowPayouts.filter((payout) =>
      RESOLVED_PAYOUT_STATUSES.has(payout.status)
    );

    const totalTransactionVolumeByCurrency = bucketOrderAmountsByCurrency(paidOrders);
    const canonicalCurrency = getCanonicalCurrency(totalTransactionVolumeByCurrency);
    const totalTransactionVolume = getBucketAmount(
      totalTransactionVolumeByCurrency,
      canonicalCurrency
    );
    const averageOrderValueByCurrency = bucketAverageOrderValuesByCurrency(paidOrders);
    const averageOrderValue = getBucketAmount(
      averageOrderValueByCurrency,
      canonicalCurrency
    );

    const buyerAggregates = new Map<string, BuyerAggregate>();
    for (const order of paidOrders) {
      const buyerKey =
        order.buyerBusiness?._id?.toString() ??
        order.buyer?._id?.toString() ??
        (order.buyerId as string | undefined) ??
        order.userId.toString();
      const existing = buyerAggregates.get(buyerKey);
      const buyerName =
        order.buyerBusiness?.name ??
        "Unknown Buyer";

      if (existing) {
        existing.orderCount += 1;
        addCurrencyAmount(
          existing.revenueByCurrency,
          order.payment?.currency ?? canonicalCurrency,
          order.amount
        );
        if (!existing.country && order.buyerBusiness?.country) {
          existing.country = order.buyerBusiness.country;
        }
        if (!existing.category && order.buyerBusiness?.category) {
          existing.category = order.buyerBusiness.category;
        }
        existing.hasBusinessMetadata =
          existing.hasBusinessMetadata || Boolean(order.buyerBusiness);
      } else {
        buyerAggregates.set(buyerKey, {
          buyerId: buyerKey,
          name: buyerName,
          orderCount: 1,
          revenueByCurrency: new Map([
            [order.payment?.currency ?? canonicalCurrency, roundToTwo(order.amount)],
          ]),
          country: order.buyerBusiness?.country ?? null,
          category: order.buyerBusiness?.category ?? null,
          hasBusinessMetadata: Boolean(order.buyerBusiness),
        });
      }
    }

    const buyers = Array.from(buyerAggregates.values()).sort(
      (a, b) =>
        (b.revenueByCurrency.get(canonicalCurrency) ?? 0) -
        (a.revenueByCurrency.get(canonicalCurrency) ?? 0)
    );
    const buyersWithBusinessMetadata = buyers.filter(
      (buyer) => buyer.hasBusinessMetadata
    ).length;
    const repeatBuyers = buyers.filter((buyer) => buyer.orderCount > 1).length;
    const topBuyerConcentrationByCurrencyBuckets = topBuyerConcentrationByCurrency(
      buyers,
      totalTransactionVolumeByCurrency
    );
    const topBuyerRevenue = buyers[0]?.revenueByCurrency.get(canonicalCurrency) ?? 0;

    const countryCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();

    for (const buyer of buyers) {
      if (buyer.country) {
        countryCounts.set(buyer.country, (countryCounts.get(buyer.country) ?? 0) + 1);
      }
      if (buyer.category) {
        categoryCounts.set(
          buyer.category,
          (categoryCounts.get(buyer.category) ?? 0) + 1
        );
      }
    }

    const countryBreakdown = Array.from(countryCounts.entries())
      .map(([country, count]) => ({
        label: country,
        count,
        share: toPercent(count, buyersWithBusinessMetadata),
      }))
      .sort((a, b) => b.count - a.count);
    const categoryBreakdown = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({
        label: category,
        count,
        share: toPercent(count, buyersWithBusinessMetadata),
      }))
      .sort((a, b) => b.count - a.count);

    const fulfillmentCycleDays = terminalOrders.map((order) =>
      (order.updatedAt - order.createdAt) / (24 * 60 * 60 * 1000)
    );
    const recentPaidActivityAt = paidOrders.reduce<number | null>((latest, order) => {
      const paymentUpdatedAt = order.payment?.updatedAt;
      if (paymentUpdatedAt === undefined) {
        return latest;
      }

      if (latest === null || paymentUpdatedAt > latest) {
        return paymentUpdatedAt;
      }

      return latest;
    }, null);
    const reportStart =
      sortedOrders.length > 0
        ? Math.min(...sortedOrders.map((order) => order.createdAt))
        : null;
    const reportEnd =
      sortedOrders.length > 0
        ? Math.max(...sortedOrders.map((order) => order.updatedAt))
        : null;
    const ordersTruncated = orders.length === CREDIT_PROFILE_ORDER_LIMIT;
    const payoutsTruncated = payouts.length === CREDIT_PROFILE_PAYOUT_LIMIT;

    return {
      access: {
        state: "ready",
        title: "Ready",
        message: "Your digital credit profile is available.",
      },
      business: {
        id: business._id,
        name: business.name,
        category: business.category,
        country: business.country,
        verificationStatus: business.verificationStatus,
        createdAt: business.createdAt,
      },
      reportMeta: {
        generatedAt: now,
        reportStart,
        reportEnd,
        reportWindowStart: reportStart,
        ordersTruncated,
        payoutsTruncated,
        orderLimit: CREDIT_PROFILE_ORDER_LIMIT,
        payoutLimit: CREDIT_PROFILE_PAYOUT_LIMIT,
      },
      profile: {
        currency: canonicalCurrency,
        profileSummary: {
          ordersCount: sortedOrders.length,
          paidOrdersCount: paidOrders.length,
          uniqueBuyers: buyers.length,
          countriesRepresented: countryBreakdown.length,
          totalTransactionVolume,
          totalTransactionVolumeByCurrency,
        },
        transactionHistory: {
          totalOrders: sortedOrders.length,
          paidOrders: paidOrders.length,
          totalTransactionVolume,
          totalTransactionVolumeByCurrency,
          averageOrderValue,
          averageOrderValueByCurrency,
          successfulPaymentRate: toPercent(
            paidOrders.length,
            ordersWithPayments.length
          ),
          recentPaidActivityAt,
          trend: [30, 90, 180].map((days) => {
            const windowStart = startOfWindow(days, now);
            const windowOrders = sortedOrders.filter(
              (order) => order.createdAt >= windowStart
            );
            const windowPaidOrders = windowOrders.filter(
              (order) =>
                order.payment && SETTLED_PAYMENT_STATUSES.has(order.payment.status)
            );
            const windowPaidVolumeByCurrency = bucketOrderAmountsByCurrency(
              windowPaidOrders
            );

            return {
              label: `${days} days`,
              days,
              orderCount: windowOrders.length,
              paidOrderCount: windowPaidOrders.length,
              paidVolume: getBucketAmount(windowPaidVolumeByCurrency, canonicalCurrency),
              paidVolumeByCurrency: windowPaidVolumeByCurrency,
            };
          }),
        },
        fulfillment: {
          totalOrders: sortedOrders.length,
          processingOrders: sortedOrders.filter((order) => order.status === "processing")
            .length,
          completionRate: toPercent(
            sortedOrders.filter((order) => order.status === "completed").length,
            sortedOrders.length
          ),
          cancellationRate: toPercent(
            sortedOrders.filter((order) => order.status === "cancelled").length,
            sortedOrders.length
          ),
          averageFulfillmentCycleDays: roundToTwo(average(fulfillmentCycleDays)),
          payoutSuccessRate: toPercent(
            windowPayouts.filter((payout) => payout.status === "success").length,
            resolvedPayouts.length
          ),
          payoutStatusCounts: {
            pending: windowPayouts.filter((payout) => payout.status === "pending").length,
            queued: windowPayouts.filter((payout) => payout.status === "queued").length,
            success: windowPayouts.filter((payout) => payout.status === "success").length,
            failed: windowPayouts.filter((payout) => payout.status === "failed").length,
            reverted: windowPayouts.filter((payout) => payout.status === "reverted").length,
          },
        },
        buyerDiversity: {
          uniqueBuyers: buyers.length,
          repeatBuyers,
          buyerBusinessCoverageRate: toPercent(
            buyersWithBusinessMetadata,
            buyers.length
          ),
          buyersWithBusinessMetadata,
          topBuyerConcentrationRate: toPercent(
            topBuyerRevenue,
            totalTransactionVolume
          ),
          topBuyerConcentrationByCurrency: topBuyerConcentrationByCurrencyBuckets,
          countries: countryBreakdown,
          categories: categoryBreakdown,
          topBuyers: buyers.slice(0, 5).map((buyer) => ({
            buyerId: buyer.buyerId,
            name: buyer.name,
            orderCount: buyer.orderCount,
            revenue: roundToTwo(
              buyer.revenueByCurrency.get(canonicalCurrency) ?? 0
            ),
            revenueByCurrency: bucketsFromTotals(buyer.revenueByCurrency),
          })),
          coverageNote:
            buyersWithBusinessMetadata === buyers.length
              ? "Buyer diversity is based on linked buyer business records."
              : "Buyer diversity is based only on buyers with linked business records, so some buyers are excluded from the diversity mix.",
        },
      },
    } as const;
  },
});
