"use client";

import type { ComponentType } from "react";
import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Building2, Download, FileText, Globe2, Printer, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { Locale } from "@/i18n/config";

type BreakdownItem = {
  label: string;
  count: number;
  share: number;
};

type CurrencyBucket = {
  currency: string;
  amount: number;
};

type CurrencyRateBucket = {
  currency: string;
  rate: number;
};

type TopBuyer = {
  buyerId: string;
  name: string;
  orderCount: number;
  revenue: number;
  revenueByCurrency: CurrencyBucket[];
};

type CreditProfileResponse = {
  access: {
    state:
      | "ready"
      | "no_business"
      | "business_missing"
      | "pending_verification"
      | "rejected_verification"
      | "not_seller";
    title: string;
    message: string;
  };
  business: {
    name: string;
    category: string;
    country: string;
    verificationStatus: string;
    createdAt: number;
  } | null;
  reportMeta: {
    generatedAt: number;
    reportStart: number | null;
    reportEnd: number | null;
    reportWindowStart: number | null;
    ordersTruncated: boolean;
    payoutsTruncated: boolean;
    orderLimit: number;
    payoutLimit: number;
  } | null;
  profile: {
    currency: string;
    profileSummary: {
      ordersCount: number;
      paidOrdersCount: number;
      uniqueBuyers: number;
      countriesRepresented: number;
      totalTransactionVolume: number;
      totalTransactionVolumeByCurrency: CurrencyBucket[];
    };
    transactionHistory: {
      totalOrders: number;
      paidOrders: number;
      totalTransactionVolume: number;
      totalTransactionVolumeByCurrency: CurrencyBucket[];
      averageOrderValue: number;
      averageOrderValueByCurrency: CurrencyBucket[];
      successfulPaymentRate: number;
      recentPaidActivityAt: number | null;
      trend: Array<{
        label: string;
        days: number;
        orderCount: number;
        paidOrderCount: number;
        paidVolume: number;
        paidVolumeByCurrency: CurrencyBucket[];
      }>;
    };
    fulfillment: {
      totalOrders: number;
      processingOrders: number;
      completionRate: number;
      cancellationRate: number;
      averageFulfillmentCycleDays: number;
      payoutSuccessRate: number;
      payoutStatusCounts: {
        pending: number;
        queued: number;
        success: number;
        failed: number;
        reverted: number;
      };
    };
    buyerDiversity: {
      uniqueBuyers: number;
      repeatBuyers: number;
      buyerBusinessCoverageRate: number;
      buyersWithBusinessMetadata: number;
      topBuyerConcentrationRate: number;
      topBuyerConcentrationByCurrency: CurrencyRateBucket[];
      countries: BreakdownItem[];
      categories: BreakdownItem[];
      topBuyers: TopBuyer[];
      coverageNote: string;
    };
  } | null;
};

function currency(value: number, locale: string, displayCurrency: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: displayCurrency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyBreakdown(buckets: CurrencyBucket[], locale: string) {
  return buckets
    .map((bucket) => currency(bucket.amount, locale, bucket.currency))
    .join(" • ");
}

function formatRateBreakdown(buckets: CurrencyRateBucket[], locale: string) {
  return buckets
    .map(
      (bucket) =>
        `${bucket.currency} ${percent(bucket.rate, locale)}`
    )
    .join(" • ");
}

function percent(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value / 100);
}

function integer(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatDate(value: number | null, locale: string, emptyLabel: string) {
  if (!value) {
    return emptyLabel;
  }

  return new Intl.DateTimeFormat(locale).format(new Date(value));
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function BreakdownList({
  title,
  emptyLabel,
  items,
  getCountLabel,
}: {
  title: string;
  emptyLabel: string;
  items: BreakdownItem[];
  getCountLabel: (count: number) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          items.slice(0, 5).map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{item.label}</span>
                <span className="text-muted-foreground">
                  {getCountLabel(item.count)}
                </span>
              </div>
              <Progress value={item.share} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight">{value}</div>
      {detail && <div className="mt-1 text-xs text-muted-foreground">{detail}</div>}
    </div>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function CreditProfileReport() {
  const t = useTranslations("creditProfile");
  const locale = useLocale() as Locale;
  const creditProfile = useQuery(api.creditProfiles.getMyProfile) as
    | CreditProfileResponse
    | undefined;

  if (creditProfile === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  const { access, business, reportMeta, profile } = creditProfile;

  if (access.state !== "ready" || !profile || !business || !reportMeta) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="print:hidden">
          <Link href="/business/credit-profile">
            <Button variant="ghost" className="px-0">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("actions.backToProfile")}
            </Button>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t(`access.${access.state}.title`)}</CardTitle>
            <CardDescription>{t(`access.${access.state}.message`)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link href="/business/profile">
              <Button>
                <Building2 className="mr-2 h-4 w-4" />
                {t("actions.openBusinessProfile")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = profile.profileSummary;
  const txn = profile.transactionHistory;
  const ful = profile.fulfillment;
  const bd = profile.buyerDiversity;
  const cur = profile.currency;
  const hasMultiCurrency = txn.totalTransactionVolumeByCurrency.length > 1;

  return (
    <div className="mx-auto max-w-3xl space-y-0 bg-background print:max-w-none">
      {/* Print / Back actions — hidden in print */}
      <div className="flex items-center justify-between pb-8 print:hidden">
        <Link href="/business/credit-profile">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("actions.back")}
          </Button>
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          {t("actions.printOrSavePdf")}
        </Button>
      </div>

      {/* ── Report Header ── */}
      <header className="border-b-2 border-foreground pb-5">
        <h1 className="text-2xl font-bold tracking-tight">{t("titleReport")}</h1>
        <p className="mt-1 text-lg font-medium">{business.name}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{t("report.category")}: {business.category}</span>
          <span>{t("report.country")}: {business.country}</span>
          <span>{t("report.verifiedSince")}: {formatDate(business.createdAt, locale, t("common.notAvailableYet"))}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{t("report.generatedOn", { date: formatDate(reportMeta.generatedAt, locale, t("common.notAvailableYet")) })}</span>
          <span>{t("report.latestActivity", { date: formatDate(txn.recentPaidActivityAt, locale, t("common.notAvailableYet")) })}</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground italic">{t("summary.description")}</p>
      </header>

      {/* ── 1. Profile Summary ── */}
      <section className="border-b py-6 print:break-inside-avoid">
        <h2 className="text-base font-bold">{t("report.sectionProfileSummary")}</h2>
        <div className="mt-3 space-y-0.5">
          <ReportRow label={t("cards.paidTransactionVolume.title")} value={currency(summary.totalTransactionVolume, locale, cur)} />
          {hasMultiCurrency && (
            <div className="pb-1 pl-0 text-right text-xs text-muted-foreground">
              {formatCurrencyBreakdown(summary.totalTransactionVolumeByCurrency, locale)}
            </div>
          )}
          <ReportRow label={t("cards.paidOrders.title")} value={integer(summary.paidOrdersCount, locale)} />
          <ReportRow label={t("cards.uniqueBuyers.title")} value={integer(summary.uniqueBuyers, locale)} />
          <ReportRow label={t("cards.repeatBuyers.title")} value={integer(bd.repeatBuyers, locale)} />
          <ReportRow label={t("cards.buyerCountries.title")} value={integer(summary.countriesRepresented, locale)} />
        </div>
      </section>

      {/* ── 2. Transaction History ── */}
      <section className="border-b py-6 print:break-inside-avoid">
        <h2 className="text-base font-bold">{t("report.sectionTransactionHistory")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("sections.transactionHistory.description")}</p>
        <div className="mt-3 space-y-0.5">
          <ReportRow label={t("cards.totalSellerOrders.title")} value={integer(txn.totalOrders, locale)} />
          <ReportRow label={t("cards.successfulPaymentRate.title")} value={percent(txn.successfulPaymentRate, locale)} />
          <ReportRow label={t("cards.averageOrderValue.title")} value={currency(txn.averageOrderValue, locale, cur)} />
          {txn.averageOrderValueByCurrency.length > 1 && (
            <div className="pb-1 text-right text-xs text-muted-foreground">
              {formatCurrencyBreakdown(txn.averageOrderValueByCurrency, locale)}
            </div>
          )}
          <ReportRow label={t("cards.recentPaidActivity.title")} value={formatDate(txn.recentPaidActivityAt, locale, t("common.notAvailableYet"))} />
        </div>

        {txn.trend.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold">{t("report.rollingPerformanceWindows")}</h3>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-1.5 pr-4 text-left font-medium" />
                  {txn.trend.map((w) => (
                    <th key={w.days} className="py-1.5 pl-4 text-right font-medium">
                      {t("trend.window", { days: integer(w.days, locale) })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-dashed">
                  <td className="py-1.5 pr-4 text-muted-foreground">{t("trend.orders")}</td>
                  {txn.trend.map((w) => (
                    <td key={w.days} className="py-1.5 pl-4 text-right tabular-nums">{integer(w.orderCount, locale)}</td>
                  ))}
                </tr>
                <tr className="border-b border-dashed">
                  <td className="py-1.5 pr-4 text-muted-foreground">{t("trend.paidOrders")}</td>
                  {txn.trend.map((w) => (
                    <td key={w.days} className="py-1.5 pl-4 text-right tabular-nums">{integer(w.paidOrderCount, locale)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 text-muted-foreground">{t("trend.paidVolume")}</td>
                  {txn.trend.map((w) => (
                    <td key={w.days} className="py-1.5 pl-4 text-right tabular-nums">{currency(w.paidVolume, locale, cur)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 3. Fulfillment Performance ── */}
      <section className="border-b py-6 print:break-inside-avoid">
        <h2 className="text-base font-bold">{t("report.sectionFulfillment")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("sections.fulfillment.description")}</p>
        <div className="mt-3 space-y-0.5">
          <ReportRow label={t("fulfillment.completionRate")} value={percent(ful.completionRate, locale)} />
          <ReportRow label={t("fulfillment.cancellationRate")} value={percent(ful.cancellationRate, locale)} />
          <ReportRow label={t("fulfillment.payoutSuccessRate")} value={percent(ful.payoutSuccessRate, locale)} />
          <ReportRow label={t("fulfillment.ordersCurrentlyProcessing")} value={integer(ful.processingOrders, locale)} />
          <ReportRow
            label={t("fulfillment.averageFulfillmentCycle")}
            value={t("fulfillment.averageFulfillmentCycleValue", {
              days: new Intl.NumberFormat(locale, {
                maximumFractionDigits: 1,
                minimumFractionDigits: 1,
              }).format(ful.averageFulfillmentCycleDays),
            })}
          />
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold">{t("report.payoutOutcomes")}</h3>
          <div className="mt-2 space-y-0.5">
            <ReportRow label={t("fulfillment.payoutStatuses.queued")} value={integer(ful.payoutStatusCounts.queued, locale)} />
            <ReportRow label={t("fulfillment.payoutStatuses.pending")} value={integer(ful.payoutStatusCounts.pending, locale)} />
            <ReportRow label={t("fulfillment.payoutStatuses.success")} value={integer(ful.payoutStatusCounts.success, locale)} />
            <ReportRow label={t("fulfillment.payoutStatuses.failed")} value={integer(ful.payoutStatusCounts.failed, locale)} />
            <ReportRow label={t("fulfillment.payoutStatuses.reverted")} value={integer(ful.payoutStatusCounts.reverted, locale)} />
          </div>
        </div>
      </section>

      {/* ── 4. Buyer Diversity ── */}
      <section className="border-b py-6 print:break-inside-avoid">
        <h2 className="text-base font-bold">{t("report.sectionBuyerDiversity")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {bd.buyersWithBusinessMetadata === bd.uniqueBuyers
            ? t("buyerDiversity.coverage.complete")
            : t("buyerDiversity.coverage.partial")}
        </p>
        <div className="mt-3 space-y-0.5">
          <ReportRow label={t("cards.uniqueBuyersDetailed.title")} value={integer(bd.uniqueBuyers, locale)} />
          <ReportRow label={t("cards.repeatBuyers.title")} value={integer(bd.repeatBuyers, locale)} />
          <ReportRow label={t("cards.metadataCoverage.title")} value={percent(bd.buyerBusinessCoverageRate, locale)} />
          <ReportRow label={t("cards.topBuyerConcentration.title")} value={percent(bd.topBuyerConcentrationRate, locale)} />
        </div>

        {bd.countries.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold">{t("report.buyerCountriesSection")}</h3>
            <div className="mt-2 space-y-0.5">
              {bd.countries.slice(0, 10).map((c) => (
                <ReportRow
                  key={c.label}
                  label={c.label}
                  value={t("report.buyerShare", { count: integer(c.count, locale), share: c.share.toFixed(0) })}
                />
              ))}
            </div>
          </div>
        )}

        {bd.categories.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold">{t("report.buyerCategoriesSection")}</h3>
            <div className="mt-2 space-y-0.5">
              {bd.categories.slice(0, 10).map((c) => (
                <ReportRow
                  key={c.label}
                  label={c.label}
                  value={t("report.buyerShare", { count: integer(c.count, locale), share: c.share.toFixed(0) })}
                />
              ))}
            </div>
          </div>
        )}

        {bd.topBuyers.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold">{t("report.topBuyersSection")}</h3>
            <div className="mt-2 space-y-0.5">
              {bd.topBuyers.map((buyer) => (
                <ReportRow
                  key={buyer.buyerId}
                  label={`${buyer.name} — ${t("report.orders", { count: integer(buyer.orderCount, locale) })}`}
                  value={currency(buyer.revenue, locale, cur)}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── 5. Methodology ── */}
      <section className="py-6 print:break-inside-avoid">
        <h2 className="text-base font-bold">{t("report.sectionMethodology")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("methodology.description")}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>{t("methodology.points.transactionVolume")}</li>
          <li>{t("methodology.points.fulfillment")}</li>
          <li>{t("methodology.points.buyerDiversity")}</li>
        </ul>
      </section>
    </div>
  );
}

export function CreditProfileView() {
  const t = useTranslations("creditProfile");
  const locale = useLocale() as Locale;
  const creditProfile = useQuery(api.creditProfiles.getMyProfile) as
    | CreditProfileResponse
    | undefined;

  if (creditProfile === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  const { access, business, reportMeta, profile } = creditProfile;

  if (access.state !== "ready" || !profile || !business || !reportMeta) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t(`access.${access.state}.title`)}</CardTitle>
            <CardDescription>{t(`access.${access.state}.message`)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link href="/business/profile">
              <Button>
                <Building2 className="mr-2 h-4 w-4" />
                {t("actions.openBusinessProfile")}
              </Button>
            </Link>
            <Link href="/business/register">
              <Button variant="outline">{t("actions.businessSetup")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = profile.profileSummary;
  const transactionHistory = profile.transactionHistory;
  const fulfillment = profile.fulfillment;
  const buyerDiversity = profile.buyerDiversity;
  const displayCurrency = profile.currency;
  const hasOrders = transactionHistory.totalOrders > 0;
  const hasMultiCurrencyVolume =
    transactionHistory.totalTransactionVolumeByCurrency.length > 1;
  const coverageNote =
    buyerDiversity.buyersWithBusinessMetadata === buyerDiversity.uniqueBuyers
      ? t("buyerDiversity.coverage.complete")
      : t("buyerDiversity.coverage.partial");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{t("badges.verifiedSeller")}</Badge>
            <Badge variant="secondary">{t("badges.platformActivity")}</Badge>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        <Link href="/business/credit-profile/report">
          <Button>
            <Download className="mr-2 h-4 w-4" />
            {t("actions.downloadableReport")}
          </Button>
        </Link>
      </div>

      <div className="rounded-lg border bg-muted/40 px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <div>
              <div className="text-sm font-medium">{business.name}</div>
              <p className="text-xs text-muted-foreground">{t("summary.description")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span>{t("summary.generated")}: <span className="font-medium text-foreground">{formatDate(reportMeta.generatedAt, locale, t("common.notAvailableYet"))}</span></span>
            <span>{t("summary.latestProfileActivity")}: <span className="font-medium text-foreground">{formatDate(transactionHistory.recentPaidActivityAt, locale, t("common.notAvailableYet"))}</span></span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t("cards.paidTransactionVolume.title")}
          value={currency(summary.totalTransactionVolume, locale, displayCurrency)}
          description={
            hasMultiCurrencyVolume
              ? `${t("cards.paidTransactionVolume.description")} • ${formatCurrencyBreakdown(
                  summary.totalTransactionVolumeByCurrency,
                  locale
                )}`
              : t("cards.paidTransactionVolume.description")
          }
          icon={TrendingUp}
        />
        <StatCard
          title={t("cards.paidOrders.title")}
          value={integer(summary.paidOrdersCount, locale)}
          description={t("cards.paidOrders.description", {
            totalOrders: integer(transactionHistory.totalOrders, locale),
          })}
          icon={ShieldCheck}
        />
        <StatCard
          title={t("cards.uniqueBuyers.title")}
          value={integer(summary.uniqueBuyers, locale)}
          description={t("cards.uniqueBuyers.description", {
            repeatBuyers: integer(buyerDiversity.repeatBuyers, locale),
          })}
          icon={Users}
        />
        <StatCard
          title={t("cards.buyerCountries.title")}
          value={integer(summary.countriesRepresented, locale)}
          description={t("cards.buyerCountries.description", {
            buyersWithBusinessMetadata: integer(
              buyerDiversity.buyersWithBusinessMetadata,
              locale
            ),
          })}
          icon={Globe2}
        />
      </div>

      {!hasOrders && (
        <Card>
          <CardHeader>
            <CardTitle>{t("empty.title")}</CardTitle>
            <CardDescription>
              {t("empty.description")}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("sections.transactionHistory.title")}</CardTitle>
            <CardDescription>{t("sections.transactionHistory.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label={t("cards.totalSellerOrders.title")}
                value={integer(transactionHistory.totalOrders, locale)}
                detail={t("cards.totalSellerOrders.description")}
              />
              <Metric
                label={t("cards.successfulPaymentRate.title")}
                value={percent(transactionHistory.successfulPaymentRate, locale)}
                detail={t("cards.successfulPaymentRate.description")}
              />
              <Metric
                label={t("cards.averageOrderValue.title")}
                value={currency(transactionHistory.averageOrderValue, locale, displayCurrency)}
                detail={
                  transactionHistory.averageOrderValueByCurrency.length > 1
                    ? `${t("cards.averageOrderValue.description")} • ${formatCurrencyBreakdown(
                        transactionHistory.averageOrderValueByCurrency,
                        locale
                      )}`
                    : t("cards.averageOrderValue.description")
                }
              />
              <Metric
                label={t("cards.recentPaidActivity.title")}
                value={formatDate(
                  transactionHistory.recentPaidActivityAt,
                  locale,
                  t("common.notAvailableYet")
                )}
                detail={t("cards.recentPaidActivity.description")}
              />
            </div>

            <Separator />

            <div>
              <div className="mb-4 text-sm font-medium">{t("trend.rollingPerformanceWindow")}</div>
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-2.5 pr-6 text-left font-medium" />
                      {transactionHistory.trend.map((window) => (
                        <th key={window.days} className="pb-2.5 pl-4 text-right font-medium">
                          {t("trend.window", { days: integer(window.days, locale) })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-dashed">
                      <td className="py-2.5 pr-6 text-muted-foreground">{t("trend.orders")}</td>
                      {transactionHistory.trend.map((window) => (
                        <td key={window.days} className="py-2.5 pl-4 text-right font-medium tabular-nums">
                          {integer(window.orderCount, locale)}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-dashed">
                      <td className="py-2.5 pr-6 text-muted-foreground">{t("trend.paidOrders")}</td>
                      {transactionHistory.trend.map((window) => (
                        <td key={window.days} className="py-2.5 pl-4 text-right font-medium tabular-nums">
                          {integer(window.paidOrderCount, locale)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-6 text-muted-foreground">{t("trend.paidVolume")}</td>
                      {transactionHistory.trend.map((window) => (
                        <td key={window.days} className="py-2.5 pl-4 text-right font-medium tabular-nums">
                          {currency(window.paidVolume, locale, displayCurrency)}
                          {window.paidVolumeByCurrency.length > 1 && (
                            <div className="mt-0.5 text-xs font-normal text-muted-foreground">
                              {formatCurrencyBreakdown(window.paidVolumeByCurrency, locale)}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sections.fulfillment.title")}</CardTitle>
            <CardDescription>
              {t("sections.fulfillment.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>{t("fulfillment.completionRate")}</span>
                <span className="font-medium tabular-nums">{percent(fulfillment.completionRate, locale)}</span>
              </div>
              <Progress value={fulfillment.completionRate} className="h-2" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>{t("fulfillment.cancellationRate")}</span>
                <span className="font-medium tabular-nums">{percent(fulfillment.cancellationRate, locale)}</span>
              </div>
              <Progress value={fulfillment.cancellationRate} className="h-2" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>{t("fulfillment.payoutSuccessRate")}</span>
                <span className="font-medium tabular-nums">{percent(fulfillment.payoutSuccessRate, locale)}</span>
              </div>
              <Progress value={fulfillment.payoutSuccessRate} className="h-2" />
            </div>

            <Separator />

            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-1">
              <Metric
                label={t("fulfillment.ordersCurrentlyProcessing")}
                value={integer(fulfillment.processingOrders, locale)}
              />
              <Metric
                label={t("fulfillment.averageFulfillmentCycle")}
                value={t("fulfillment.averageFulfillmentCycleValue", {
                  days: new Intl.NumberFormat(locale, {
                    maximumFractionDigits: 1,
                    minimumFractionDigits: 1,
                  }).format(fulfillment.averageFulfillmentCycleDays),
                })}
              />
            </div>

            <Separator />

            <div className="text-sm">
              <div className="font-medium">{t("fulfillment.payoutOutcomeCounts")}</div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("fulfillment.payoutStatuses.queued")}</span>
                  <span className="tabular-nums">{integer(fulfillment.payoutStatusCounts.queued, locale)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("fulfillment.payoutStatuses.pending")}</span>
                  <span className="tabular-nums">{integer(fulfillment.payoutStatusCounts.pending, locale)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("fulfillment.payoutStatuses.success")}</span>
                  <span className="tabular-nums">{integer(fulfillment.payoutStatusCounts.success, locale)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("fulfillment.payoutStatuses.failed")}</span>
                  <span className="tabular-nums">{integer(fulfillment.payoutStatusCounts.failed, locale)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("fulfillment.payoutStatuses.reverted")}</span>
                  <span className="tabular-nums">{integer(fulfillment.payoutStatusCounts.reverted, locale)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("sections.buyerDiversity.title")}</CardTitle>
          <CardDescription>{coverageNote}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label={t("cards.uniqueBuyersDetailed.title")}
              value={integer(buyerDiversity.uniqueBuyers, locale)}
              detail={t("cards.uniqueBuyersDetailed.description")}
            />
            <Metric
              label={t("cards.repeatBuyers.title")}
              value={integer(buyerDiversity.repeatBuyers, locale)}
              detail={t("cards.repeatBuyers.description")}
            />
            <Metric
              label={t("cards.metadataCoverage.title")}
              value={percent(buyerDiversity.buyerBusinessCoverageRate, locale)}
              detail={t("cards.metadataCoverage.description", {
                buyersWithBusinessMetadata: integer(
                  buyerDiversity.buyersWithBusinessMetadata,
                  locale
                ),
              })}
            />
            <Metric
              label={t("cards.topBuyerConcentration.title")}
              value={percent(buyerDiversity.topBuyerConcentrationRate, locale)}
              detail={
                buyerDiversity.topBuyerConcentrationByCurrency.length > 1
                  ? `${t("cards.topBuyerConcentration.description")} • ${formatRateBreakdown(
                      buyerDiversity.topBuyerConcentrationByCurrency,
                      locale
                    )}`
                  : t("cards.topBuyerConcentration.description")
              }
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <BreakdownList
              title={t("breakdowns.buyerCountries.title")}
              emptyLabel={t("breakdowns.buyerCountries.empty")}
              items={buyerDiversity.countries}
              getCountLabel={(count) =>
                t("breakdowns.countLabel", { count: integer(count, locale) })
              }
            />
            <BreakdownList
              title={t("breakdowns.buyerCategories.title")}
              emptyLabel={t("breakdowns.buyerCategories.empty")}
              items={buyerDiversity.categories}
              getCountLabel={(count) =>
                t("breakdowns.countLabel", { count: integer(count, locale) })
              }
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("breakdowns.topBuyers.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {buyerDiversity.topBuyers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("breakdowns.topBuyers.empty")}</p>
                ) : (
                  buyerDiversity.topBuyers.map((buyer) => (
                    <div key={buyer.buyerId} className="rounded-lg border p-3">
                      <div className="font-medium">{buyer.name}</div>
                      <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                        <span>
                          {t("breakdowns.topBuyers.orders", {
                            count: integer(buyer.orderCount, locale),
                          })}
                        </span>
                        <span>{currency(buyer.revenue, locale, displayCurrency)}</span>
                      </div>
                      {buyer.revenueByCurrency.length > 1 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {formatCurrencyBreakdown(buyer.revenueByCurrency, locale)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card className="print:break-inside-avoid">
        <CardHeader>
          <CardTitle>{t("methodology.title")}</CardTitle>
          <CardDescription>
            {t("methodology.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t("methodology.points.transactionVolume")}</p>
          <p>{t("methodology.points.fulfillment")}</p>
          <p>{t("methodology.points.buyerDiversity")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
