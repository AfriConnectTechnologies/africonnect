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
import { Loader2 } from "lucide-react";

export default function BankAnalyticsPage() {
  const { isLoading: authLoading, isAuthorized } = useRequireBank();
  const locale = useLocale();
  const t = useTranslations("bankPortal");
  const analytics = useQuery(api.banks.getMyBankAnalytics, isAuthorized ? {} : "skip");
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const numberFormatter = new Intl.NumberFormat(locale);

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

  if (analytics === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("analytics.title")}</h1>
        <p className="text-muted-foreground">
          {t("analytics.description")}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("analytics.byCategory.title")}</CardTitle>
            <CardDescription>{t("analytics.byCategory.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.segments.categories.map((entry) => (
              <div
                key={entry.label}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <span>{entry.label}</span>
                <span className="font-medium">{entry.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("analytics.byCountry.title")}</CardTitle>
            <CardDescription>{t("analytics.byCountry.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.segments.countries.map((entry) => (
              <div
                key={entry.label}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <span>{entry.label}</span>
                <span className="font-medium">{entry.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("analytics.byStage.title")}</CardTitle>
            <CardDescription>{t("analytics.byStage.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.segments.stages.map((entry) => (
              <div
                key={entry.label}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <span>{t(`stages.${entry.label}`)}</span>
                <span className="font-medium">{entry.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("analytics.monthly.title")}</CardTitle>
          <CardDescription>
            {t("analytics.monthly.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {analytics.trends.map((month) => (
            <div
              key={month.month}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-lg border p-3 text-sm"
            >
              <div className="font-medium">{formatMonthBucket(month.month, locale)}</div>
              <div className="text-muted-foreground">
                {t("analytics.monthly.newSmes", {
                  count: numberFormatter.format(month.newBusinesses),
                })}
              </div>
              <div className="text-muted-foreground">
                {t("analytics.monthly.active", {
                  count: numberFormatter.format(month.activeBusinesses),
                })}
              </div>
              <div className="font-medium">{currencyFormatter.format(month.revenue)}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
