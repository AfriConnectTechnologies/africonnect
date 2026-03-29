"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  CreditCard,
  Package,
  TrendingUp,
  Calculator,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { COMPLIANCE_ENABLED } from "@/lib/features";

export default function SubscriptionPage() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const txRef = searchParams.get("tx_ref");

  const [isCancelling, setIsCancelling] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [selectedNewPlanId, setSelectedNewPlanId] = useState<string | null>(null);

  // Fetch data
  const subscription = useQuery(api.subscriptions.getCurrentSubscription);
  const currentUser = useQuery(api.users.getCurrentUser);
  const plans = useQuery(api.subscriptionPlans.list);
  
  // Usage stats query - always call the hook but skip if no businessId
  const usageStats = useQuery(
    api.subscriptions.getUsageStats,
    currentUser?.businessId
      ? { businessId: currentUser.businessId as Id<"businesses"> }
      : "skip"
  );

  // Mutations
  const cancelSubscription = useMutation(api.subscriptions.cancel);
  const reactivateSubscription = useMutation(api.subscriptions.reactivate);
  const changePlanMutation = useMutation(api.subscriptions.changePlan);

  // Show success message if redirected from payment (move to useEffect to avoid side effect during render)
  useEffect(() => {
    if (success === "true" && txRef) {
      toast.success("Payment Successful!", {
        description: "Your subscription has been activated.",
        id: "payment-success",
      });
    }
  }, [success, txRef]);

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    setIsCancelling(true);
    try {
      await cancelSubscription({
        subscriptionId: subscription._id as Id<"subscriptions">,
      });
      toast.success("Subscription Cancelled", {
        description: "Your subscription will remain active until the end of the billing period.",
      });
    } catch (error) {
      toast.error("Failed to cancel subscription", {
        description: error instanceof Error ? error.message : "Something went wrong",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReactivateSubscription = async () => {
    if (!subscription) return;

    setIsReactivating(true);
    try {
      await reactivateSubscription({
        subscriptionId: subscription._id as Id<"subscriptions">,
      });
      toast.success("Subscription Reactivated", {
        description: "Your subscription will continue at the end of the billing period.",
      });
    } catch (error) {
      toast.error("Failed to reactivate subscription", {
        description: error instanceof Error ? error.message : "Something went wrong",
      });
    } finally {
      setIsReactivating(false);
    }
  };

  const handleChangePlan = async (newPlanId: string) => {
    if (!subscription) return;

    setIsChangingPlan(true);
    setSelectedNewPlanId(newPlanId);
    try {
      await changePlanMutation({
        subscriptionId: subscription._id as Id<"subscriptions">,
        newPlanId: newPlanId as Id<"subscriptionPlans">,
      });
      toast.success("Plan Change Scheduled", {
        description: "Your plan will change at the start of your next billing period.",
      });
    } catch (error) {
      toast.error("Failed to change plan", {
        description: error instanceof Error ? error.message : "Something went wrong",
      });
    } finally {
      setIsChangingPlan(false);
      setSelectedNewPlanId(null);
    }
  };

  const formatPrice = (amountInCents: number, currency: string) => {
    const amount = amountInCents / 100;
    if (currency === "ETB") {
      return `${amount.toLocaleString()} ETB`;
    }
    return `$${amount.toFixed(0)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string, cancelAtPeriodEnd: boolean) => {
    if (cancelAtPeriodEnd) {
      return <Badge variant="destructive">Cancels Soon</Badge>;
    }
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "trialing":
        return <Badge variant="secondary">Trial</Badge>;
      case "past_due":
        return <Badge variant="destructive">Past Due</Badge>;
      case "cancelled":
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // No business registered
  if (currentUser && !currentUser.businessId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Subscription</h1>
          <p className="text-muted-foreground">
            Manage your subscription and billing
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Business Required
            </CardTitle>
            <CardDescription>
              You need to register a business before you can subscribe to a plan.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link href="/business/register">Register Your Business</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Loading state
  if (subscription === undefined || usageStats === undefined || plans === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Subscription</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // No subscription - show plans
  if (!subscription) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Subscription</h1>
          <p className="text-muted-foreground">
            Choose a plan to unlock more features
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>No Active Subscription</CardTitle>
            <CardDescription>
              You&apos;re currently on the free tier with limited features. Upgrade to
              unlock more products, orders, and compliance tools.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">10 Products</p>
                  <p className="text-sm text-muted-foreground">Free tier limit</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">50 Orders/mo</p>
                  <p className="text-sm text-muted-foreground">Free tier limit</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calculator className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">5 Calculations/mo</p>
                  <p className="text-sm text-muted-foreground">Free tier limit</p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href="/pricing">
                <TrendingUp className="mr-2 h-4 w-4" />
                View Plans
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const plan = subscription.plan;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {plan?.name} Plan
                {getStatusBadge(subscription.status, subscription.cancelAtPeriodEnd)}
              </CardTitle>
              <CardDescription>
                {subscription.billingCycle === "annual"
                  ? "Billed annually"
                  : "Billed monthly"}
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">
                ${plan ? (subscription.billingCycle === "annual"
                  ? (plan.annualPrice / 100).toFixed(0)
                  : (plan.monthlyPrice / 100).toFixed(0)) : 0}
              </p>
              <p className="text-sm text-muted-foreground">
                per {subscription.billingCycle === "annual" ? "year" : "month"}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Current period:</span>
            <span>
              {formatDate(subscription.currentPeriodStart)} -{" "}
              {formatDate(subscription.currentPeriodEnd)}
            </span>
          </div>

          {subscription.cancelAtPeriodEnd && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">
                Your subscription will end on{" "}
                {formatDate(subscription.currentPeriodEnd)}
              </span>
            </div>
          )}

          {subscription.trialEndsAt && subscription.status === "trialing" && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">
                Your trial ends on {formatDate(subscription.trialEndsAt)}
              </span>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          {subscription.cancelAtPeriodEnd ? (
            <Button
              variant="default"
              onClick={handleReactivateSubscription}
              disabled={isReactivating}
            >
              {isReactivating ? "Reactivating..." : "Reactivate Subscription"}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={isCancelling}
            >
              {isCancelling ? "Cancelling..." : "Cancel Subscription"}
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Change Plan */}
      {plans && plans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Change Plan</CardTitle>
            <CardDescription>
              Upgrade or downgrade your subscription. Changes take effect at the start of your next billing period.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {plans
                .filter((p) => p.slug !== "enterprise") // Hide enterprise for self-service
                .map((p) => {
                  const isCurrentPlan = subscription.plan?.slug === p.slug;
                  // Use explicit tier map for deterministic comparison instead of array index
                  const tierMap: Record<string, number> = { free: 0, starter: 1, growth: 2, pro: 3, enterprise: 4 };
                  const currentPlanTier = tierMap[subscription.plan?.slug ?? ""] ?? 0;
                  const thisPlanTier = tierMap[p.slug] ?? 0;
                  const isUpgrade = thisPlanTier > currentPlanTier;
                  const monthlyPrice = subscription.billingCycle === "annual"
                    ? Math.round(p.annualPrice / 12)
                    : p.monthlyPrice;

                  return (
                    <div
                      key={p._id}
                      className={`relative p-4 rounded-lg border-2 transition-colors ${
                        isCurrentPlan
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-primary/50"
                      }`}
                    >
                      {isCurrentPlan && (
                        <Badge className="absolute -top-2 left-3 text-xs">Current</Badge>
                      )}
                      <div className="space-y-2">
                        <h4 className="font-semibold">{p.name}</h4>
                        <p className="text-2xl font-bold">
                          {formatPrice(monthlyPrice, p.currency)}
                          <span className="text-sm font-normal text-muted-foreground">/mo</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{p.targetCustomer}</p>
                        {!isCurrentPlan && (
                          <Button
                            size="sm"
                            variant={isUpgrade ? "default" : "outline"}
                            className="w-full mt-2"
                            onClick={() => handleChangePlan(p._id)}
                            disabled={isChangingPlan}
                          >
                            {isChangingPlan && selectedNewPlanId === p._id ? (
                              "Changing..."
                            ) : (
                              <>
                                {isUpgrade ? (
                                  <ArrowUpRight className="h-3 w-3 mr-1" />
                                ) : (
                                  <ArrowDownRight className="h-3 w-3 mr-1" />
                                )}
                                {isUpgrade ? "Upgrade" : "Downgrade"}
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Need custom features?{" "}
              <a href="mailto:admin@africonnect.africa.com" className="text-primary hover:underline">
                Contact us
              </a>{" "}
              for Enterprise pricing.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Usage Stats */}
      {usageStats && (
        <Card>
          <CardHeader>
            <CardTitle>Usage This Month</CardTitle>
            <CardDescription>
              Track your usage against your plan limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Products */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>Products</span>
                </div>
                <span>
                  {usageStats.products.used} /{" "}
                  {usageStats.products.unlimited
                    ? "Unlimited"
                    : usageStats.products.limit}
                </span>
              </div>
              {!usageStats.products.unlimited && (
                <Progress
                  value={
                    usageStats.products.limit > 0
                      ? (usageStats.products.used / usageStats.products.limit) * 100
                      : 0
                  }
                  className="h-2"
                />
              )}
            </div>

            {/* Orders */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span>Orders</span>
                </div>
                <span>
                  {usageStats.orders.used} /{" "}
                  {usageStats.orders.unlimited
                    ? "Unlimited"
                    : usageStats.orders.limit}
                </span>
              </div>
              {!usageStats.orders.unlimited && (
                <Progress
                  value={
                    usageStats.orders.limit > 0
                      ? (usageStats.orders.used / usageStats.orders.limit) * 100
                      : 0
                  }
                  className="h-2"
                />
              )}
            </div>

            {/* Origin Calculations */}
            {COMPLIANCE_ENABLED && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                    <span>Origin Calculations</span>
                  </div>
                  <span>
                    {usageStats.originCalculations.used} /{" "}
                    {usageStats.originCalculations.unlimited
                      ? "Unlimited"
                      : usageStats.originCalculations.limit}
                  </span>
                </div>
                {!usageStats.originCalculations.unlimited && (
                  <Progress
                    value={
                      usageStats.originCalculations.limit > 0
                        ? (usageStats.originCalculations.used /
                            usageStats.originCalculations.limit) *
                          100
                        : 0
                    }
                    className="h-2"
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan Features */}
      {plan && (
        <PlanFeaturesCard plan={plan} />
      )}
    </div>
  );
}

// Helper component to safely parse and display plan features
function PlanFeaturesCard({ plan }: { plan: { name: string; features: string; slug?: string } }) {
  const parsedFeatures = useMemo(() => {
    try {
      const parsed = JSON.parse(plan.features ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error(`Failed to parse features for plan ${plan.slug || plan.name}:`, error);
      return [];
    }
  }, [plan.features, plan.slug, plan.name]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan Features</CardTitle>
        <CardDescription>
          Features included in your {plan.name} plan
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 md:grid-cols-2">
          {parsedFeatures.map((feature: string, index: number) => (
            <li key={index} className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
