"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import {
  BadgeCheck,
  Ban,
  CreditCard,
  FileCheck2,
  Gavel,
  Package,
  Scale,
  Shield,
  Truck,
  Users,
} from "lucide-react";

type AgreementType = "seller" | "buyer";

const SELLER_SECTIONS = [
  { id: "eligibility", icon: Users },
  { id: "productListings", icon: Package },
  { id: "fulfillment", icon: Truck },
  { id: "qualityStandards", icon: BadgeCheck },
  { id: "feesCommissions", icon: CreditCard },
  { id: "returnsRefunds", icon: FileCheck2 },
  { id: "prohibitedItems", icon: Ban },
  { id: "intellectualProperty", icon: Scale },
  { id: "accountSuspension", icon: Shield },
  { id: "liabilityIndemnification", icon: Gavel },
] as const;

const BUYER_SECTIONS = [
  { id: "purchaseCommitments", icon: FileCheck2 },
  { id: "paymentTerms", icon: CreditCard },
  { id: "deliveryInspection", icon: Truck },
  { id: "disputes", icon: Gavel },
  { id: "returns", icon: Package },
  { id: "communication", icon: Users },
  { id: "accountResponsibilities", icon: Shield },
] as const;

export function AgreementContent({ type }: { type: AgreementType }) {
  const t = useTranslations("agreements");
  const sections = type === "seller" ? SELLER_SECTIONS : BUYER_SECTIONS;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t(`${type}.title`)}</h2>
        <p className="text-sm text-muted-foreground">
          {t(`${type}.lastUpdated`)}: {t(`${type}.lastUpdatedDate`)}
        </p>
      </div>

      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t(`${type}.introduction`)}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {sections.map((section, index) => (
          <Card key={section.id} id={`${type}-${section.id}`} className="scroll-mt-20">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <section.icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-base font-semibold">
                  {index + 1}. {t(`${type}.sections.${section.id}.title`)}
                </h3>
              </div>
              <p className="whitespace-pre-line text-sm text-muted-foreground leading-relaxed">
                {t(`${type}.sections.${section.id}.content`)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

