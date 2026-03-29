"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export type TariffCountry = "ethiopia" | "kenya";

interface CountrySelectorProps {
  value: TariffCountry;
  onChange: (country: TariffCountry) => void;
  disabled?: boolean;
}

const countries: { id: TariffCountry; flag: string; labelKey: string }[] = [
  { id: "ethiopia", flag: "🇪🇹", labelKey: "ethiopia" },
  { id: "kenya", flag: "🇰🇪", labelKey: "kenyaEac" },
];

export function CountrySelector({ value, onChange, disabled }: CountrySelectorProps) {
  const t = useTranslations("compliance");

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">
        {t("selectCountry")}
      </label>
      <div className="flex gap-2">
        {countries.map((country) => (
          <Button
            key={country.id}
            type="button"
            variant={value === country.id ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(country.id)}
            disabled={disabled}
            className={cn(
              "flex items-center gap-2",
              value === country.id && "ring-2 ring-primary ring-offset-2"
            )}
          >
            <span className="text-lg">{country.flag}</span>
            <span>{t(country.labelKey)}</span>
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("countryDescription")}
      </p>
    </div>
  );
}
