"use client";

import { cn } from "@/lib/utils";
import { USD_TO_ETB_RATE } from "@/lib/pricing";

export { USD_TO_ETB_RATE };

interface CurrencyToggleProps {
  currency: "USD" | "ETB";
  onToggle: (currency: "USD" | "ETB") => void;
}

export function CurrencyToggle({ currency, onToggle }: CurrencyToggleProps) {
  const handleKeyDown = (target: "USD" | "ETB") => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle(target);
    }
  };

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        className={cn(
          "text-sm font-medium transition-colors cursor-pointer bg-transparent border-none p-0",
          currency === "USD" ? "text-foreground" : "text-muted-foreground"
        )}
        onClick={() => onToggle("USD")}
        onKeyDown={handleKeyDown("USD")}
      >
        USD
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={currency === "ETB"}
        aria-label="Switch between USD and ETB"
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          currency === "ETB" ? "bg-primary" : "bg-input"
        )}
        onClick={() => onToggle(currency === "USD" ? "ETB" : "USD")}
      >
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
            currency === "ETB" ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>

      <button
        type="button"
        className={cn(
          "text-sm font-medium transition-colors cursor-pointer bg-transparent border-none p-0",
          currency === "ETB" ? "text-foreground" : "text-muted-foreground"
        )}
        onClick={() => onToggle("ETB")}
        onKeyDown={handleKeyDown("ETB")}
      >
        ETB
      </button>
    </div>
  );
}
