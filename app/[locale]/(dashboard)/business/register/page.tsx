"use client";

import { useEffect, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { AgreementDialog } from "@/components/agreements/AgreementDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Shield,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type SellerApplicationStatus = "not_applied" | "pending" | "approved" | "rejected";

export default function BusinessRegisterPage() {
  const t = useTranslations("business");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const convex = useConvex();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSellerAgreementDialog, setShowSellerAgreementDialog] = useState(false);

  const currentUser = useQuery(api.users.getCurrentUser);
  const myBusiness = useQuery(api.businesses.getMyBusiness);
  const sellerAgreementState = useQuery(api.agreements.hasAcceptedCurrentAgreement, {
    type: "seller",
  });
  const acceptAgreement = useMutation(api.agreements.acceptAgreement);
  const submitSellerApplication = useMutation(api.users.submitSellerApplication);

  useEffect(() => {
    if (currentUser !== undefined && !currentUser?.businessId) {
      router.push("/business/verify");
    }
  }, [currentUser, router]);

  const sellerApplicationStatus: SellerApplicationStatus =
    currentUser?.role === "seller" || currentUser?.role === "admin"
      ? "approved"
      : currentUser?.sellerApplicationStatus ?? "not_applied";
  const verificationStatusLabels = {
    pending: t("verificationStatus.pending"),
    verified: t("verificationStatus.verified"),
    rejected: t("verificationStatus.rejected"),
  };
  const sellerStatusConfig = {
    pending: { label: t("sellerStatus.pending"), icon: Clock, badge: "secondary" as const },
    approved: { label: t("sellerStatus.approved"), icon: CheckCircle2, badge: "default" as const },
    rejected: { label: t("sellerStatus.rejected"), icon: XCircle, badge: "destructive" as const },
  };

  const submitApplication = async (rethrowOnError = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await acceptAgreement({
        type: "seller",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });

      const updatedAgreementState = await convex.query(
        api.agreements.hasAcceptedCurrentAgreement,
        { type: "seller" }
      );

      if (updatedAgreementState.status === "missing_active_version") {
        throw new Error("Seller agreement is not configured. Please contact support.");
      }

      if (updatedAgreementState.status !== "accepted") {
        throw new Error("Seller agreement acceptance was not confirmed. Please try again.");
      }

      await submitSellerApplication({});
      toast.success(t("sellerApplicationSubmitted"));
      router.push("/business/profile");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t("sellerApplicationFailed");
      toast.error(errorMessage);
      if (rethrowOnError) {
        throw error;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApply = async () => {
    if (!myBusiness || myBusiness.verificationStatus !== "verified") {
      toast.error(t("sellerApplicationRequiresVerifiedBusiness"));
      router.push("/business/profile");
      return;
    }

    if (sellerApplicationStatus === "approved") {
      router.push("/products");
      return;
    }

    if (sellerApplicationStatus === "pending") {
      toast.error(t("sellerApplicationPending"));
      return;
    }

    if (sellerAgreementState === undefined) {
      toast.error(tCommon("loading"));
      return;
    }

    if (sellerAgreementState.status === "accepted") {
      await submitApplication(false);
      return;
    }

    setShowSellerAgreementDialog(true);
  };

  if (currentUser === undefined || myBusiness === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentUser?.businessId || !myBusiness) {
    return null;
  }

  const hasVerifiedBusiness = myBusiness.verificationStatus === "verified";
  const verificationStatusLabel =
    verificationStatusLabels[
      myBusiness.verificationStatus as keyof typeof verificationStatusLabels
    ] ?? myBusiness.verificationStatus;
  const sellerStatus =
    sellerApplicationStatus === "not_applied"
      ? null
      : sellerStatusConfig[sellerApplicationStatus];
  const SellerStatusIcon = sellerStatus?.icon;

  return (
    <div className="space-y-6">
      <AgreementDialog
        open={showSellerAgreementDialog}
        onOpenChange={setShowSellerAgreementDialog}
        type="seller"
        onAccept={() => submitApplication(true)}
      />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("sellerApplicationTitle")}</h1>
        <p className="text-muted-foreground">{t("sellerApplicationDescription")}</p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("sellerApplicationCardTitle")}
          </CardTitle>
          <CardDescription>{t("sellerApplicationCardDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{t("businessVerificationStatusTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {hasVerifiedBusiness
                    ? t("sellerApplicationBusinessVerified")
                    : t("sellerApplicationBusinessPending")}
                </p>
              </div>
              <Badge variant={hasVerifiedBusiness ? "default" : "secondary"}>
                {verificationStatusLabel}
              </Badge>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{t("sellerApplicationStatusTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {sellerApplicationStatus === "approved" && t("sellerApplicationApproved")}
                  {sellerApplicationStatus === "pending" && t("sellerApplicationPending")}
                  {sellerApplicationStatus === "rejected" && t("sellerApplicationRejected")}
                  {sellerApplicationStatus === "not_applied" && t("sellerApplicationNotApplied")}
                </p>
              </div>
              {sellerStatus && SellerStatusIcon ? (
                <Badge variant={sellerStatus.badge}>
                  <SellerStatusIcon className="mr-1 h-3 w-3" />
                  {sellerStatus.label}
                </Badge>
              ) : (
                <Badge variant="outline">{t("sellerApplicationReady")}</Badge>
              )}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-medium">{t("sellerApplicationRequirementsTitle")}</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>{t("sellerApplicationRequirementBusiness")}</li>
              <li>{t("sellerApplicationRequirementAgreement")}</li>
              <li>{t("sellerApplicationRequirementReview")}</li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleApply}
              disabled={isSubmitting || !hasVerifiedBusiness || sellerApplicationStatus === "pending"}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("sellerApplicationSubmitting")}
                </>
              ) : sellerApplicationStatus === "rejected" ? (
                t("sellerApplicationReapply")
              ) : sellerApplicationStatus === "approved" ? (
                t("sellerApplicationManageProducts")
              ) : (
                t("sellerApplicationApply")
              )}
            </Button>

            <Button variant="outline" asChild>
              <Link href="/business/profile">
                {t("sellerApplicationOpenBusiness")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
