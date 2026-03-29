"use client";

import React from "react";
import { Check, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { COMPLIANCE_ENABLED } from "@/lib/features";

interface FeatureValue {
  starter: string | boolean | number;
  growth: string | boolean | number;
  pro: string | boolean | number;
  enterprise: string | boolean | number;
}

interface FeatureRow {
  name: string;
  values: FeatureValue;
}

interface FeatureCategory {
  name: string;
  features: FeatureRow[];
}

const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    name: "Marketplace",
    features: [
      {
        name: "Products",
        values: { starter: "10", growth: "50", pro: "200", enterprise: "Unlimited" },
      },
      {
        name: "Monthly Orders",
        values: { starter: "50", growth: "200", pro: "1,000", enterprise: "Unlimited" },
      },
      {
        name: "Product Images",
        values: { starter: true, growth: true, pro: true, enterprise: true },
      },
      {
        name: "Bulk Product Upload",
        values: { starter: false, growth: true, pro: true, enterprise: true },
      },
      ...(COMPLIANCE_ENABLED
        ? [
            {
              name: "Certificate of Origin Prep",
              values: { starter: false, growth: true, pro: true, enterprise: true },
            },
          ]
        : []),
    ],
  },
  {
    name: "Team & Collaboration",
    features: [
      {
        name: "Team Members",
        values: { starter: "1", growth: "3", pro: "10", enterprise: "Unlimited" },
      },
      {
        name: "Role-based Access",
        values: { starter: false, growth: true, pro: true, enterprise: true },
      },
      {
        name: "Activity Logs",
        values: { starter: false, growth: false, pro: true, enterprise: true },
      },
    ],
  },
  {
    name: "Analytics & Reporting",
    features: [
      {
        name: "Basic Analytics",
        values: { starter: true, growth: true, pro: true, enterprise: true },
      },
      {
        name: "Advanced Analytics",
        values: { starter: false, growth: true, pro: true, enterprise: true },
      },
      {
        name: "Custom Reports",
        values: { starter: false, growth: false, pro: true, enterprise: true },
      },
      {
        name: "Export Data",
        values: { starter: false, growth: true, pro: true, enterprise: true },
      },
    ],
  },
  {
    name: "Support",
    features: [
      {
        name: "Email Support",
        values: { starter: true, growth: true, pro: true, enterprise: true },
      },
      {
        name: "Priority Support",
        values: { starter: false, growth: "Email", pro: "Chat", enterprise: "Dedicated" },
      },
    ],
  },
];

function FeatureCell({ value }: { value: string | boolean | number }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="flex justify-center">
        <Check className="h-5 w-5 text-green-500" aria-hidden="true" />
        <span className="sr-only">Included</span>
      </span>
    ) : (
      <span className="flex justify-center">
        <X className="h-5 w-5 text-muted-foreground/50" aria-hidden="true" />
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  return <span className="text-sm">{value}</span>;
}

export function FeatureComparison() {
  const plans = ["starter", "growth", "pro", "enterprise"] as const;
  const planNames = {
    starter: "Starter",
    growth: "Growth",
    pro: "Pro",
    enterprise: "Enterprise",
  };

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Features</TableHead>
            {plans.map((plan) => (
              <TableHead
                key={plan}
                className={cn(
                  "text-center min-w-[120px]",
                  plan === "growth" && "bg-primary/5"
                )}
              >
                {planNames[plan]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {FEATURE_CATEGORIES.map((category) => (
            <React.Fragment key={category.name}>
              <TableRow className="bg-muted/50">
                <TableCell
                  colSpan={5}
                  className="font-semibold text-sm py-2"
                >
                  {category.name}
                </TableCell>
              </TableRow>
              {category.features.map((feature) => (
                <TableRow key={feature.name}>
                  <TableCell className="text-sm">{feature.name}</TableCell>
                  {plans.map((plan) => (
                    <TableCell
                      key={plan}
                      className={cn(
                        "text-center",
                        plan === "growth" && "bg-primary/5"
                      )}
                    >
                      <FeatureCell value={feature.values[plan]} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
