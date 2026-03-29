"use client";

import { useTranslations, useLocale } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, TrendingDown, Calendar, Trash2 } from "lucide-react";

interface Rates {
  "2026": string;
  "2027": string;
  "2028": string;
  "2029": string;
  "2030": string;
}

interface ComplianceCardProps {
  hsCode: string;
  productName: string;
  productNameAmharic?: string;
  isCompliant: boolean;
  currentRate?: string;
  rates?: Rates | string;
  country?: string; // "ethiopia" or "kenya"
  tariffCategory?: string;
  tariffScheduleStatus?: "matched" | "not_matched";
  tariffSource?: string;
  tariffBaseRate?: string;
  tariffUnit?: string;
  onRemove?: () => void;
  showRemove?: boolean;
  compact?: boolean;
}

const countryFlags: Record<string, string> = {
  ethiopia: "🇪🇹",
  kenya: "🇰🇪",
};

export function ComplianceCard({
  hsCode,
  productName,
  productNameAmharic,
  isCompliant,
  currentRate,
  rates,
  country,
  tariffCategory,
  tariffScheduleStatus,
  tariffSource,
  tariffBaseRate,
  tariffUnit,
  onRemove,
  showRemove = true,
  compact = false,
}: ComplianceCardProps) {
  const t = useTranslations("compliance");
  const locale = useLocale();
  const currentYear = new Date().getFullYear();
  const countryFlag = country ? countryFlags[country] : countryFlags.ethiopia;

  // Parse rates if it's a JSON string
  const parsedRates: Rates | null = rates
    ? typeof rates === "string"
      ? JSON.parse(rates)
      : rates
    : null;

  const displayName = locale === "am" && productNameAmharic 
    ? productNameAmharic 
    : productName;
  const scheduleStatus = tariffScheduleStatus || (isCompliant ? "matched" : "not_matched");
  const scheduleMatched = scheduleStatus === "matched";

  const years = ["2026", "2027", "2028", "2029", "2030"] as const;
  type RateYear = (typeof years)[number];
  const firstRateYear = Number(years[0]);
  const lastRateYear = Number(years[years.length - 1]);
  const currentYearKey: RateYear = years.includes(String(currentYear) as RateYear)
    ? (String(currentYear) as RateYear)
    : currentYear < firstRateYear
      ? years[0]
      : years[years.length - 1];

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border p-3 bg-card">
        <div className="flex items-center gap-3 min-w-0">
          {scheduleMatched ? (
            <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{displayName}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <span>{countryFlag}</span>
              <span>HS: {hsCode}</span>
            </div>
            {scheduleMatched && (tariffBaseRate || tariffCategory) && (
              <div className="text-xs text-muted-foreground mt-1">
                {tariffBaseRate ? `${t("baseRate")}: ${tariffBaseRate}%` : ""}
                {tariffBaseRate && tariffCategory ? " | " : ""}
                {tariffCategory ? `${t("tariffCategory")}: ${tariffCategory}` : ""}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {scheduleMatched && (
            <div className="flex flex-col items-end gap-1">
              {currentRate && currentRate !== "N/A" && (
                <Badge variant="secondary" className="text-xs">
                  {t("currentRate")}: {currentRate}%
                </Badge>
              )}
              {tariffBaseRate && (
                <span className="text-xs text-muted-foreground">
                  {t("baseRate")}: {tariffBaseRate}%
                </span>
              )}
            </div>
          )}
          {showRemove && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className={cn(
      "overflow-hidden",
      scheduleMatched
        ? "border-blue-200 dark:border-blue-900" 
        : "border-amber-200 dark:border-amber-900"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              {scheduleMatched ? (
                <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <XCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              )}
              {displayName}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <span>{countryFlag}</span>
              <span>HS Code: {hsCode}</span>
            </CardDescription>
          </div>
          <Badge 
            variant={scheduleMatched ? "default" : "secondary"}
            className={cn(
              scheduleMatched
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" 
                : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
            )}
          >
            {scheduleMatched ? t("tariffScheduleMatched") : t("tariffScheduleNotMatched")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {scheduleMatched && parsedRates ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <TrendingDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-muted-foreground">{t("tariffScheduleCoverage")}</span>
            </div>
            
            {/* Rate Timeline */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {t("rateSchedule")}
              </div>
              <div className="grid grid-cols-5 gap-1">
                {years.map((year) => {
                  const rate = parsedRates[year];
                  const isCurrentYear = parseInt(year) === currentYear;
                  const isPast = parseInt(year) < currentYear;
                  
                  return (
                    <div
                      key={year}
                      className={cn(
                        "text-center p-2 rounded-md text-xs",
                        isCurrentYear 
                          ? "bg-primary text-primary-foreground font-medium" 
                          : isPast
                            ? "bg-muted text-muted-foreground"
                            : "bg-muted/50"
                      )}
                    >
                      <div className="font-medium">{year}</div>
                      <div className={cn(
                        "mt-1",
                        rate === "0" && "text-green-600 dark:text-green-400 font-semibold"
                      )}>
                        {rate}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Current Year Highlight */}
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3">
              <div className="text-sm">
                <span className="text-muted-foreground">{t("currentYearRate")} ({currentYearKey}):</span>
                <span className="ml-2 font-semibold text-blue-700 dark:text-blue-300">
                  {currentRate || parsedRates[currentYearKey]}%
                </span>
              </div>
              {tariffBaseRate && (
                <div className="text-xs text-muted-foreground mt-1">
                  {t("baseRate")}: {tariffBaseRate}%{tariffUnit ? ` (${tariffUnit})` : ""}
                </div>
              )}
              {tariffCategory && (
                <div className="text-xs text-muted-foreground mt-1">
                  {t("tariffCategory")}: {tariffCategory}
                </div>
              )}
              {tariffSource && (
                <div className="text-xs text-muted-foreground mt-1">
                  {t("ruleSource")}: {tariffSource}
                </div>
              )}
              {parsedRates["2030"] === "0" && (
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {t("zeroTariffBy2030")}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t("tariffScheduleNotMatched")}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              {t("noTariffMatchDescription")}
            </p>
          </div>
        )}

        {showRemove && onRemove && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRemove}
            className="w-full text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("removeProduct")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
