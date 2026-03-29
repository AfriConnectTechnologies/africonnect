"use client";

import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  Mail,
  Trash2,
  TrendingDown,
  Package,
  AlertTriangle,
} from "lucide-react";

interface OriginResultCardProps {
  productName: string;
  exWorksPrice: number;
  nonOriginatingMaterials: number;
  vnmPercentage: number;
  isEligible: boolean;
  currency: string;
  compact?: boolean;
  showDelete?: boolean;
  onDelete?: () => void;
}

export function OriginResultCard({
  productName,
  exWorksPrice,
  nonOriginatingMaterials,
  vnmPercentage,
  isEligible,
  currency,
  compact = false,
  showDelete = false,
  onDelete,
}: OriginResultCardProps) {
  const t = useTranslations("originEligibility");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const localValue = exWorksPrice - nonOriginatingMaterials;
  const localPercentage = exWorksPrice > 0 
    ? Math.round((localValue / exWorksPrice) * 10000) / 100 
    : 0;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-4 rounded-lg border p-3",
          isEligible
            ? "border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20"
            : "border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {isEligible ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{productName}</div>
            <div className="text-xs text-muted-foreground">
              EXW: {currency} {formatCurrency(exWorksPrice)} | VNM: {vnmPercentage}%
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="secondary"
            className={cn(
              "text-xs",
              isEligible
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
            )}
          >
            {isEligible ? t("eligible") : t("notEligible")}
          </Badge>
          {showDelete && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
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
    <Card
      className={cn(
        "overflow-hidden",
        isEligible
          ? "border-green-200 dark:border-green-900"
          : "border-amber-200 dark:border-amber-900"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {isEligible ? (
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              )}
              {productName}
            </CardTitle>
            <CardDescription>
              {t("certificateOfOriginEligibility")}
            </CardDescription>
          </div>
          <Badge
            variant={isEligible ? "default" : "secondary"}
            className={cn(
              "text-sm px-3 py-1",
              isEligible
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
            )}
          >
            {isEligible ? t("eligible") : t("notEligible")}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Result Summary */}
        <div
          className={cn(
            "rounded-lg p-4",
            isEligible
              ? "bg-green-50 dark:bg-green-950/30"
              : "bg-amber-50 dark:bg-amber-950/30"
          )}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                {t("vnmPercentage")}
              </div>
              <div
                className={cn(
                  "text-2xl font-bold",
                  isEligible
                    ? "text-green-600 dark:text-green-400"
                    : "text-amber-600 dark:text-amber-400"
                )}
              >
                {vnmPercentage}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {t("maxThreshold")}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                {t("localContent")}
              </div>
              <div
                className={cn(
                  "text-2xl font-bold",
                  localPercentage >= 40
                    ? "text-green-600 dark:text-green-400"
                    : "text-amber-600 dark:text-amber-400"
                )}
              >
                {localPercentage}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {t("minLocalContent")}
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t("totalExWorks")}
            </span>
            <span className="font-medium">
              {currency} {formatCurrency(exWorksPrice)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              {t("vnmValue")}
            </span>
            <span className="font-medium text-amber-600 dark:text-amber-400">
              - {currency} {formatCurrency(nonOriginatingMaterials)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="font-medium">{t("localValueAdded")}</span>
            <span className="font-bold text-green-600 dark:text-green-400">
              {currency} {formatCurrency(localValue)}
            </span>
          </div>
        </div>

        {/* Status Message */}
        {isEligible ? (
          <div className="rounded-md bg-green-50 dark:bg-green-950/30 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  {t("eligibleMessage")}
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  {t("eligibleDescription")}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    {t("notEligibleMessage")}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    {t("notEligibleDescription")}
                  </p>
                </div>
              </div>
            </div>

            {/* Contact CTA */}
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {t("contactUs")}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    {t("contactUsDescription")}
                  </p>
                  <a
                    href="mailto:admin@africonnect.africa.com"
                    className="inline-flex items-center gap-2 mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    admin@africonnect.africa.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDelete && onDelete && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="w-full text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("deleteCalculation")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
