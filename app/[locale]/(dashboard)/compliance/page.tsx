"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, ExternalLink, Info, FileCheck } from "lucide-react";
import {
  BusinessProducts,
  OriginEligibilityCalculator,
} from "@/components/compliance";
import { Separator } from "@/components/ui/separator";
import { isComplianceEnabledForEmail } from "@/lib/features";
import { ComingSoonPage } from "@/components/ui/coming-soon";

export default function CompliancePage() {
  const t = useTranslations("compliance");
  const router = useRouter();
  const { user } = useUser();
  const isComplianceEnabled = isComplianceEnabledForEmail(
    user?.primaryEmailAddress?.emailAddress
  );

  const currentUser = useQuery(
    api.users.getCurrentUser,
    isComplianceEnabled ? undefined : "skip"
  );
  const myBusiness = useQuery(
    api.businesses.getMyBusiness,
    isComplianceEnabled ? undefined : "skip"
  );
  useQuery(
    api.compliance.getComplianceSummary,
    isComplianceEnabled ? undefined : "skip"
  );

  const isLoading = currentUser === undefined || myBusiness === undefined;
  const hasBusiness = !!myBusiness;
  const isEmailVerified = currentUser?.emailVerified ?? false;
  const isBusinessVerified = myBusiness?.verificationStatus === "verified";
  const canAccessCompliance = hasBusiness && isEmailVerified && isBusinessVerified;

  useEffect(() => {
    if (!isLoading && hasBusiness && !canAccessCompliance) {
      router.push("/business/profile");
    }
  }, [isLoading, hasBusiness, canAccessCompliance, router]);

  if (!isComplianceEnabled) {
    return (
      <ComingSoonPage
        title={t("title")}
        description="Tariff calculations and certificate of origin tools are temporarily unavailable."
        icon={<Shield className="h-8 w-8 text-primary" />}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasBusiness) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t("businessRequired")}
            </CardTitle>
            <CardDescription>
              {t("businessRequiredDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/business/verify")}>
              {t("verifyBusinessLabel")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canAccessCompliance) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Badge variant="outline" className="w-fit flex items-center gap-1">
          <Shield className="h-3 w-3" />
          AfCFTA {t("categoryABadge")}
        </Badge>
      </div>

      {/* AfCFTA Info Card */}
      <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <Info className="h-5 w-5" />
            {t("whatIsAfcfta")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {t("afcftaDescription")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {t("categoryABadge")}
            </Badge>
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              2026-2030
            </Badge>
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {t("tariffReduction")}
            </Badge>
          </div>
          <a
            href="https://au-afcfta.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t("learnMoreAfcfta")}
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>

      {/* Tariff Reduction Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>{t("reductionSchedule")}</CardTitle>
          <CardDescription>{t("reductionScheduleDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">{t("year")}</th>
                  <th className="text-center py-2 px-3 font-medium">2026</th>
                  <th className="text-center py-2 px-3 font-medium">2027</th>
                  <th className="text-center py-2 px-3 font-medium">2028</th>
                  <th className="text-center py-2 px-3 font-medium">2029</th>
                  <th className="text-center py-2 px-3 font-medium">2030</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2 px-3 text-muted-foreground">{t("typicalRateReduction")}</td>
                  <td className="text-center py-2 px-3">
                    <Badge variant="secondary">2%</Badge>
                  </td>
                  <td className="text-center py-2 px-3">
                    <Badge variant="secondary">1.5%</Badge>
                  </td>
                  <td className="text-center py-2 px-3">
                    <Badge variant="secondary">1%</Badge>
                  </td>
                  <td className="text-center py-2 px-3">
                    <Badge variant="secondary">0.5%</Badge>
                  </td>
                  <td className="text-center py-2 px-3">
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      0%
                    </Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            {t("rateDisclaimer")}
          </p>
        </CardContent>
      </Card>

      {/* Tariffs / HS search and Business Products – free for all */}
      <BusinessProducts showHeader={true} />

      {/* Section Divider */}
      <div className="relative py-4">
        <Separator />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-background px-4 flex items-center gap-2 text-muted-foreground">
            <FileCheck className="h-4 w-4" />
            <span className="text-sm font-medium">Rules of Origin</span>
          </div>
        </div>
      </div>

      {/* Certificate of Origin Eligibility Calculator – free for all */}
      <OriginEligibilityCalculator showHeader={true} />
    </div>
  );
}
