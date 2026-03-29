"use client";

import { useQuery } from "convex/react";
import { api } from "@africonnect/convex/_generated/api";
import { useRequireBank } from "@/lib/hooks/useRole";
import { formatMonthBucket } from "@/lib/month-format";
import { useLocale, useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, Handshake, Loader2, TrendingUp, Wallet } from "lucide-react";

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
}

export default function BankOverviewPage() {
  const { isLoading: authLoading, isAuthorized } = useRequireBank();
  const locale = useLocale();
  const t = useTranslations("bankPortal");
  const overview = useQuery(api.banks.getMyBankOverview, isAuthorized ? {} : "skip");

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  if (overview === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {overview.bank?.name ?? t("overview.fallbackTitle")}
          </h1>
          <p className="text-muted-foreground">
            {t("overview.description")}
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          {t("overview.referralBase", {
            code: overview.bank?.referralCodePrefix ?? t("common.notAvailable"),
          })}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("overview.stats.totalReferrals")}</CardTitle>
            <Handshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(overview.summary.totalReferrals)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("overview.stats.portfolioSmes")}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(overview.summary.portfolioBusinesses)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("overview.stats.portfolioSmesMeta", {
                verified: overview.summary.verifiedBusinesses,
                active: overview.summary.activeBusinesses,
              })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("overview.stats.portfolioRevenue")}</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(overview.summary.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {t("overview.stats.portfolioRevenueMeta", {
                orders: formatNumber(overview.summary.totalOrders),
              })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("overview.stats.successfulPayouts")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(overview.summary.totalPayouts)}</div>
            <p className="text-xs text-muted-foreground">
              {t("overview.stats.successfulPayoutsMeta", {
                products: formatNumber(overview.summary.totalProducts),
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("overview.funnel.title")}</CardTitle>
            <CardDescription>
              {t("overview.funnel.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              [t("stages.generated"), overview.funnel.referred],
              [t("stages.signed_up"), overview.funnel.signedUp],
              [t("stages.business_created"), overview.funnel.businessCreated],
              [t("stages.verified"), overview.funnel.verified],
              [t("stages.active"), overview.funnel.active],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold">{formatNumber(value as number)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("overview.momentum.title")}</CardTitle>
            <CardDescription>
              {t("overview.momentum.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.monthlyPerformance.map((month) => (
              <div
                key={month.month}
                className="grid grid-cols-[1fr_repeat(4,minmax(0,auto))] items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <div className="font-medium">{formatMonthBucket(month.month, locale)}</div>
                <div className="text-muted-foreground">{t("overview.momentum.referred", { count: month.referred })}</div>
                <div className="text-muted-foreground">{t("overview.momentum.onboarded", { count: month.onboarded })}</div>
                <div className="text-muted-foreground">{t("overview.momentum.verified", { count: month.verified })}</div>
                <div className="font-medium">{formatMoney(month.revenue)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("overview.recentPortfolio.title")}</CardTitle>
              <CardDescription>
                {t("overview.recentPortfolio.description")}
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/bank/portfolio">
                {t("overview.recentPortfolio.cta")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.recentPortfolio.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                {t("overview.recentPortfolio.empty")}
              </div>
            ) : (
              overview.recentPortfolio.map((entry) => (
                <Link
                  key={entry.business._id}
                  href={`/bank/portfolio/${entry.business._id}`}
                  className="block rounded-lg border p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{entry.business.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {entry.business.category} · {entry.business.country}
                      </p>
                    </div>
                    <Badge variant={entry.metrics.isActive ? "default" : "secondary"}>
                      {t(`stages.${entry.metrics.onboardingStage}`)}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>{t("overview.recentPortfolio.products", { count: entry.metrics.productCount })}</span>
                    <span>{t("overview.recentPortfolio.orders", { count: entry.metrics.orderCount })}</span>
                    <span>{t("overview.recentPortfolio.revenue", { amount: formatMoney(entry.metrics.revenue) })}</span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("overview.recentReferrals.title")}</CardTitle>
              <CardDescription>
                {t("overview.recentReferrals.description")}
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/bank/referrals">
                {t("overview.recentReferrals.cta")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.recentReferrals.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                {t("overview.recentReferrals.empty")}
              </div>
            ) : (
              overview.recentReferrals.map((referral) => (
                <div key={referral._id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {referral.companyName || referral.invitedEmail || t("referrals.unnamedReferral")}
                      </p>
                      <p className="text-xs text-muted-foreground">{referral.referralCode}</p>
                    </div>
                    <Badge variant="outline">
                      {t(`stages.${referral.effectiveStatus}`)}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
