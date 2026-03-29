"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@africonnect/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { BillingToggle, CurrencyToggle, PricingCard, FeatureComparison } from "@/components/pricing";
import type { PricingPlan } from "@/components/pricing";
import { toast } from "sonner";

export default function PricingPage() {
  const router = useRouter();
  const tPricing = useTranslations("pricing");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [displayCurrency, setDisplayCurrency] = useState<"USD" | "ETB">("USD");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  const dbPlans = useQuery(api.subscriptionPlans.list);
  const currentSubscription = useQuery(api.subscriptions.getCurrentSubscription);

  const parseFeatures = (features: string, planSlug: string): string[] => {
    try {
      const parsed = JSON.parse(features);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error(`Failed to parse features for plan ${planSlug}:`, error);
      return [];
    }
  };

  const plans: PricingPlan[] = dbPlans
    ? dbPlans.map((plan) => ({
        id: plan._id,
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        targetCustomer: plan.targetCustomer,
        monthlyPrice: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
        currency: plan.currency,
        features: parseFeatures(plan.features, plan.slug),
        isPopular: plan.isPopular || plan.slug === "growth",
        isEnterprise: plan.slug === "enterprise",
      }))
    : [];

  const handleSelectPlan = async (planId: string, cycle: "monthly" | "annual") => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    if (plan.isEnterprise) {
      window.location.href = "mailto:admin@africonnect.africa.com?subject=Enterprise%20Plan%20Inquiry";
      return;
    }

    if (currentSubscription && 
        (currentSubscription.status === "active" || currentSubscription.status === "trialing")) {
      router.push("/settings/subscription");
      return;
    }

    setLoadingPlanId(planId);

    try {
      const response = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          billingCycle: cycle,
        }),
      });

      let data: { error?: string; checkoutUrl?: string } = {};
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch {
          const text = await response.text();
          console.error(`Failed to parse JSON response (status ${response.status}):`, text);
          throw new Error(`Server returned invalid JSON (status ${response.status})`);
        }
      } else {
        const text = await response.text();
        console.error(`Non-JSON response (status ${response.status}):`, text);
        throw new Error(`Unexpected server response (status ${response.status})`);
      }

      if (!response.ok) {
        if (data.error === "You need to register a business first before subscribing") {
          toast.error("Business Required", {
            description: "You need to register a business before subscribing to a plan.",
            action: {
              label: "Register Business",
              onClick: () => router.push("/business/register"),
            },
          });
          return;
        }
        if (data.error === "Your business already has an active subscription") {
          toast.info("Already Subscribed", {
            description: "You already have an active subscription. Manage it from your settings.",
            action: {
              label: "Manage Subscription",
              onClick: () => router.push("/settings/subscription"),
            },
          });
          return;
        }
        throw new Error(data.error || "Failed to start checkout");
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Checkout Failed", {
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
      });
    } finally {
      setLoadingPlanId(null);
    }
  };

  return (
    <>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <PublicHeader />

        <main className="flex-1 pt-24">
          <div className="mx-auto max-w-7xl px-6">
            {/* Page Header */}
            <div className="text-center mb-12">
              <p className="text-xs font-medium tracking-widest uppercase text-primary mb-3">Pricing</p>
              <h1 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-semibold leading-tight tracking-tight mb-3">
                {tPricing("title")}
              </h1>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed mb-8">
                {tPricing("subtitle")}
              </p>

              <BillingToggle
                billingCycle={billingCycle}
                onToggle={setBillingCycle}
                savingsPercent={20}
              />

              <div className="mt-5 flex flex-col items-center gap-2">
                <span className="text-xs text-muted-foreground">Display prices in</span>
                <CurrencyToggle currency={displayCurrency} onToggle={setDisplayCurrency} />
              </div>
            </div>

            {/* Pricing Cards */}
            {plans.length === 0 ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-sm text-muted-foreground">{tPricing("loadingPlans")}</div>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto mb-16">
                {plans.map((plan) => (
                  <PricingCard
                    key={plan.id}
                    plan={plan}
                    billingCycle={billingCycle}
                    displayCurrency={displayCurrency}
                    onSelect={handleSelectPlan}
                    isLoading={loadingPlanId === plan.id}
                    isCurrentPlan={currentSubscription?.plan?.slug === plan.slug}
                    hasActiveSubscription={!!(currentSubscription && (currentSubscription.status === "active" || currentSubscription.status === "trialing"))}
                  />
                ))}
              </div>
            )}

            {/* Feature Comparison */}
            <div className="mt-16">
              <h2 className="text-[clamp(1.25rem,2.5vw,2rem)] font-semibold text-center mb-8">
                Compare All Features
              </h2>
              <FeatureComparison />
            </div>

            {/* FAQ Section */}
            <div className="mt-16 max-w-3xl mx-auto">
              <h2 className="text-[clamp(1.25rem,2.5vw,2rem)] font-semibold text-center mb-8">
                Frequently Asked Questions
              </h2>
              <div className="space-y-6">
                <div className="border-b border-border pb-5">
                  <h3 className="text-sm font-medium mb-2">Can I change my plan later?</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Yes, you can upgrade or downgrade your plan at any time. When
                    upgrading, you&apos;ll get immediate access to new features. When
                    downgrading, the change will take effect at your next billing cycle.
                  </p>
                </div>
                <div className="border-b border-border pb-5">
                  <h3 className="text-sm font-medium mb-2">What payment methods do you accept?</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We accept payments via Chapa, which supports Mobile Money, bank
                    transfers, and card payments. All payments are processed securely.
                  </p>
                </div>
                <div className="border-b border-border pb-5">
                  <h3 className="text-sm font-medium mb-2">Is there a free trial?</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    New businesses can start with our Starter plan to explore the
                    platform. Contact us for enterprise trial options.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2">What happens when I reach my limits?</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    You&apos;ll receive notifications as you approach your plan limits.
                    When you reach a limit, you can upgrade your plan to continue
                    using that feature.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-16 text-center bg-primary/[0.03] dark:bg-primary/[0.05] rounded-2xl border border-border/40 p-10">
              <h2 className="text-xl font-semibold mb-3">Need a Custom Solution?</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
                Our Enterprise plan offers custom features, dedicated support, and
                tailored integrations for large organizations.
              </p>
              <Button size="lg" className="rounded-xl" asChild>
                <a href="mailto:admin@africonnect.africa.com">
                  <Mail className="mr-2 h-4 w-4" />
                  Contact Sales
                </a>
              </Button>
            </div>
          </div>
        </main>

        <div className="mt-16">
          <PublicFooter />
        </div>
      </div>
    </>
  );
}
