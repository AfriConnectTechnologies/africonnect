"use client";

import { cn } from "@/lib/utils";

interface BillingToggleProps {
  billingCycle: "monthly" | "annual";
  onToggle: (cycle: "monthly" | "annual") => void;
  savingsPercent?: number;
}

export function BillingToggle({
  billingCycle,
  onToggle,
  savingsPercent = 20,
}: BillingToggleProps) {
  const handleKeyDown = (cycle: "monthly" | "annual") => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle(cycle);
    }
  };

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        className={cn(
          "text-sm font-medium transition-colors cursor-pointer bg-transparent border-none p-0",
          billingCycle === "monthly"
            ? "text-foreground"
            : "text-muted-foreground"
        )}
        onClick={() => onToggle("monthly")}
        onKeyDown={handleKeyDown("monthly")}
      >
        Monthly
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={billingCycle === "annual"}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          billingCycle === "annual" ? "bg-primary" : "bg-input"
        )}
        onClick={() =>
          onToggle(billingCycle === "monthly" ? "annual" : "monthly")
        }
      >
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
            billingCycle === "annual" ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>

      <button
        type="button"
        className={cn(
          "text-sm font-medium transition-colors cursor-pointer bg-transparent border-none p-0",
          billingCycle === "annual"
            ? "text-foreground"
            : "text-muted-foreground"
        )}
        onClick={() => onToggle("annual")}
        onKeyDown={handleKeyDown("annual")}
      >
        Annual
      </button>

      {savingsPercent > 0 && (
        <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:text-green-400">
          Save {savingsPercent}%
        </span>
      )}
    </div>
  );
}
