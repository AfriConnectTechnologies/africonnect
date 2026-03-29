"use client";

import { useQuery } from "convex/react";
import { useTranslations, useLocale } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Loader2, ExternalLink, Shield, Sparkles, Settings, Calendar } from "lucide-react";
import { COMMERCE_ENABLED } from "@/lib/features";
import { ComingSoonPage } from "@/components/ui/coming-soon";

export default function BillingPage() {
  const t = useTranslations("billing");
  const tCommon = useTranslations("common");
  const tOrders = useTranslations("orders");
  const locale = useLocale();
  
  const payments = useQuery(api.payments.list, COMMERCE_ENABLED ? {} : "skip");
  const subscription = useQuery(api.subscriptions.getCurrentSubscription, COMMERCE_ENABLED ? {} : "skip");

  if (!COMMERCE_ENABLED) {
    return (
      <ComingSoonPage
        title={t("title")}
        description={t("description")}
        icon={<CreditCard className="h-8 w-8 text-primary" />}
      />
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatShortDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getSubscriptionStatusBadge = (status: string, cancelAtPeriodEnd: boolean) => {
    if (cancelAtPeriodEnd) {
      return <Badge variant="destructive">{t("status.cancelsSoon")}</Badge>;
    }
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">{t("status.active")}</Badge>;
      case "trialing":
        return <Badge variant="secondary">{t("status.trial")}</Badge>;
      case "past_due":
        return <Badge variant="destructive">{t("status.pastDue")}</Badge>;
      case "cancelled":
        return <Badge variant="outline">{t("status.cancelled")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{tOrders("completed")}</Badge>;
      case "pending":
        return <Badge variant="secondary">{tOrders("pending")}</Badge>;
      case "failed":
        return <Badge variant="destructive">{t("failed")}</Badge>;
      case "cancelled":
        return <Badge variant="outline">{tOrders("cancelled")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      {/* Subscription Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Current Subscription
          </CardTitle>
          <CardDescription>Manage your subscription plan and billing</CardDescription>
        </CardHeader>
        <CardContent>
          {subscription === undefined ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : subscription ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{subscription.plan?.name ?? "Unknown"} Plan</p>
                    {getSubscriptionStatusBadge(subscription.status, subscription.cancelAtPeriodEnd)}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {subscription.billingCycle === "annual" ? "Annual" : "Monthly"} · Renews {formatShortDate(subscription.currentPeriodEnd)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                {subscription.plan ? (
                  <>
                    <p className="font-semibold">
                      {subscription.plan.currency === "ETB" 
                        ? `${((subscription.billingCycle === "annual" ? (subscription.plan.annualPrice ?? 0) : (subscription.plan.monthlyPrice ?? 0)) / 100).toLocaleString()} ETB`
                        : `$${((subscription.billingCycle === "annual" ? (subscription.plan.annualPrice ?? 0) : (subscription.plan.monthlyPrice ?? 0)) / 100).toFixed(0)}`
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      per {subscription.billingCycle === "annual" ? "year" : "month"}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Price unavailable</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-2">No active subscription</p>
              <Button asChild size="sm">
                <Link href="/pricing">View Plans</Link>
              </Button>
            </div>
          )}
        </CardContent>
        {subscription && (
          <CardFooter className="border-t pt-4">
            <Button variant="outline" asChild className="w-full">
              <Link href="/settings/subscription">
                <Settings className="h-4 w-4 mr-2" />
                Manage Subscription
              </Link>
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Payment Method Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("paymentMethod")}
          </CardTitle>
          <CardDescription>{t("paymentMethodDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{t("chapaGateway")}</p>
              <p className="text-sm text-muted-foreground">
                {t("chapaDescription")}
              </p>
            </div>
            <a 
              href="https://chapa.co" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm flex items-center gap-1"
            >
              {t("learnMore")}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>{t("paymentHistory")}</CardTitle>
          <CardDescription>{t("paymentHistoryDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {payments === undefined ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{t("noPaymentHistory")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("reference")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  <TableHead>{tCommon("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment._id}>
                    <TableCell className="text-sm">
                      {formatDate(payment.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {payment.chapaTransactionRef}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {payment.paymentType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {payment.currency} {payment.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(payment.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
