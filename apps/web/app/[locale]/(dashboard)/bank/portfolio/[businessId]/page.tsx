"use client";

import { useParams } from "next/navigation";
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
import { Loader2, TrendingUp, UserRound, Wallet } from "lucide-react";

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
}

export default function BankPortfolioDetailPage() {
  const params = useParams<{ businessId: string }>();
  const { isLoading: authLoading, isAuthorized } = useRequireBank();
  const locale = useLocale();
  const t = useTranslations("bankPortal");
  const tBusiness = useTranslations("business");
  const detail = useQuery(
    api.banks.getMyBankBusinessDetail,
    isAuthorized && params.businessId
      ? { businessId: params.businessId as never }
      : "skip"
  );

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

  if (detail === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const verificationStatusLabel = (() => {
    try {
      return tBusiness(`verificationStatus.${detail.business.verificationStatus}` as never);
    } catch {
      return detail.business.verificationStatus;
    }
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{detail.business.name}</h1>
          <p className="text-muted-foreground">
            {t("detail.description")}
          </p>
        </div>
        <Badge variant={detail.metrics.isActive ? "default" : "secondary"}>
          {t(`stages.${detail.metrics.onboardingStage}`)}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("detail.stats.revenue")}</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(detail.metrics.revenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("detail.stats.orders")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{detail.metrics.orderCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("detail.stats.products")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{detail.metrics.productCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("detail.stats.netPayouts")}</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(detail.metrics.payoutTotal)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.snapshot.title")}</CardTitle>
            <CardDescription>
              {t("detail.snapshot.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">{t("detail.snapshot.country")}</p>
              <p className="font-medium">{detail.business.country}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("detail.snapshot.category")}</p>
              <p className="font-medium">{detail.business.category}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("detail.snapshot.verificationStatus")}</p>
              <p className="font-medium">{verificationStatusLabel}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("detail.snapshot.joinedPlatform")}</p>
              <p className="font-medium">
                {new Date(detail.business.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm text-muted-foreground">{t("detail.snapshot.businessDescription")}</p>
              <p className="font-medium">
                {detail.business.description || t("detail.snapshot.noDescription")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("detail.owner.title")}</CardTitle>
            <CardDescription>
              {t("detail.owner.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <UserRound className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{detail.owner?.name || t("detail.owner.unknownOwner")}</p>
                <p className="text-sm text-muted-foreground">
                  {detail.owner?.email || t("detail.owner.noEmail")}
                </p>
              </div>
            </div>
            {detail.referral ? (
              <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                <p className="font-medium">{t("detail.owner.referralTracking")}</p>
                <p className="mt-1 text-muted-foreground">
                  {t("detail.owner.code")}: <span className="font-mono">{detail.referral.referralCode}</span>
                </p>
                <p className="mt-1 text-muted-foreground">
                  {t("detail.owner.currentReferralRecord")}: {t(`stages.${detail.referral.status}`)}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("detail.monthly.title")}</CardTitle>
          <CardDescription>
            {t("detail.monthly.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {detail.monthlyPerformance.map((month: { month: string; orders: number; revenue: number }) => (
            <div
              key={month.month}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg border p-3 text-sm"
            >
              <div className="font-medium">{formatMonthBucket(month.month, locale)}</div>
              <div className="text-muted-foreground">{t("detail.monthly.orders", { count: month.orders })}</div>
              <div className="font-medium">{formatMoney(month.revenue)}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
