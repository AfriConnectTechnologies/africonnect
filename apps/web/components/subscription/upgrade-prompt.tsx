"use client";

import Link from "next/link";
import { AlertCircle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface UsageMetric {
  name: string;
  used: number;
  limit: number;
  unlimited: boolean;
}

interface UpgradePromptProps {
  metric: UsageMetric;
  variant?: "inline" | "card";
  showProgress?: boolean;
  className?: string;
}

export function UpgradePrompt({
  metric,
  variant = "inline",
  showProgress = true,
  className,
}: UpgradePromptProps) {
  if (metric.unlimited) return null;

  // Guard against division by zero
  const usagePercent = metric.limit > 0 
    ? Math.round((metric.used / metric.limit) * 100) 
    : 0;
  const isNearLimit = usagePercent >= 80;
  const isAtLimit = metric.limit > 0 ? metric.used >= metric.limit : false;

  if (variant === "card") {
    return (
      <Card className={cn(isAtLimit && "border-destructive", className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
            {isAtLimit && <AlertCircle className="h-4 w-4 text-destructive" />}
          </div>
          <CardDescription>
            {metric.used} / {metric.limit} used
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showProgress && (
            <Progress
              value={usagePercent}
              className={cn(
                "h-2 mb-3",
                isAtLimit && "[&>div]:bg-destructive",
                isNearLimit && !isAtLimit && "[&>div]:bg-yellow-500"
              )}
            />
          )}
          {isNearLimit && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {isAtLimit ? "Limit reached" : `${100 - usagePercent}% remaining`}
              </span>
              <Button size="sm" variant="outline" asChild>
                <Link href="/pricing">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Upgrade
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Inline variant - only show when near/at limit
  if (!isNearLimit) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm rounded-md px-3 py-2",
        isAtLimit
          ? "bg-destructive/10 text-destructive"
          : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
        className
      )}
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        {isAtLimit
          ? `You've reached your ${metric.name.toLowerCase()} limit.`
          : `You're approaching your ${metric.name.toLowerCase()} limit.`}
      </span>
      <Button size="sm" variant="outline" className="shrink-0" asChild>
        <Link href="/pricing">Upgrade</Link>
      </Button>
    </div>
  );
}

interface UsageOverviewProps {
  metrics: UsageMetric[];
  className?: string;
}

export function UsageOverview({ metrics, className }: UsageOverviewProps) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-3", className)}>
      {metrics.map((metric) => (
        <UpgradePrompt key={metric.name} metric={metric} variant="card" />
      ))}
    </div>
  );
}
