"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { USD_TO_ETB_RATE } from "@/lib/pricing";

export interface PricingPlan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  targetCustomer?: string;
  monthlyPrice: number; // In cents
  annualPrice: number; // In cents
  currency: string;
  features: string[];
  isPopular?: boolean;
  isEnterprise?: boolean;
}

interface PricingCardProps {
  plan: PricingPlan;
  billingCycle: "monthly" | "annual";
  displayCurrency?: "USD" | "ETB";
  onSelect: (planId: string, billingCycle: "monthly" | "annual") => void;
  isLoading?: boolean;
  isCurrentPlan?: boolean;
  hasActiveSubscription?: boolean;
}

export function PricingCard({
  plan,
  billingCycle,
  displayCurrency = "USD",
  onSelect,
  isLoading,
  isCurrentPlan,
  hasActiveSubscription,
}: PricingCardProps) {
  // Always show monthly rate as the main price (DB stores in cents)
  const monthlyEquivalent = billingCycle === "annual"
    ? Math.round(plan.annualPrice / 12)
    : plan.monthlyPrice;

  // Normalize to USD: DB may store USD cents or ETB cents (legacy)
  const getAmountUSD = (amountInCents: number) => {
    if (plan.currency === "USD") {
      return amountInCents / 100;
    }
    // Legacy ETB: convert ETB cents to USD
    const amountETB = amountInCents / 100;
    return amountETB / USD_TO_ETB_RATE;
  };

  const formatPrice = (amountInCents: number) => {
    const amountUSD = getAmountUSD(amountInCents);
    if (displayCurrency === "ETB") {
      const amountETB = Math.round(amountUSD * USD_TO_ETB_RATE);
      return `${amountETB.toLocaleString()} ETB`;
    }
    return `$${Math.round(amountUSD).toLocaleString()}`;
  };
  
  const priceDisplay = plan.isEnterprise ? "Custom" : formatPrice(monthlyEquivalent);
  const annualTotal = formatPrice(plan.annualPrice);

  return (
    <Card
      className={cn(
        "relative flex flex-col h-full transition-all hover:shadow-lg",
        plan.isPopular && "border-primary shadow-md",
        isCurrentPlan && "ring-2 ring-primary"
      )}
    >
      {plan.isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground">
            Most Popular
          </Badge>
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute -top-3 right-4">
          <Badge variant="secondary">Current Plan</Badge>
        </div>
      )}

      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        {plan.targetCustomer && (
          <CardDescription className="text-sm">
            {plan.targetCustomer}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-6">
        {/* Price */}
        <div className="text-center">
          <span className="text-4xl font-bold">{priceDisplay}</span>
          {!plan.isEnterprise && (
            <span className="text-muted-foreground">/mo</span>
          )}
          {!plan.isEnterprise && (
            <p className="text-sm text-muted-foreground mt-1">
              {billingCycle === "annual" 
                ? `Billed annually at ${annualTotal}`
                : "Billed monthly"}
            </p>
          )}
        </div>

        {/* Description */}
        {plan.description && (
          <p className="text-sm text-muted-foreground text-center">
            {plan.description}
          </p>
        )}

        {/* Features */}
        <ul className="space-y-3">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="pt-4">
        <Button
          className="w-full"
          variant={plan.isPopular ? "default" : "outline"}
          size="lg"
          onClick={() => onSelect(plan.id, billingCycle)}
          disabled={isLoading || isCurrentPlan}
        >
          {isCurrentPlan
            ? "Current Plan"
            : plan.isEnterprise
              ? "Contact Sales"
              : isLoading
                ? "Loading..."
                : hasActiveSubscription
                  ? "Switch Plan"
                  : "Get Started"}
        </Button>
      </CardFooter>
    </Card>
  );
}
