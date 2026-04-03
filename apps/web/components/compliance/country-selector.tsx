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

const countries: { id: TariffCountry; label: string }[] = [
  { id: "ethiopia", label: "Ethiopia" },
  { id: "kenya", label: "EAC" },
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
            {country.id === "kenya" ? (
              <img
                src="/eac.png"
                alt={country.label}
                width={20}
                height={20}
                className="h-5 w-5 object-contain"
              />
            ) : (
              <span className="text-lg">🇪🇹</span>
            )}
            <span>{country.label}</span>
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("countryDescription")}
      </p>
    </div>
  );
}
