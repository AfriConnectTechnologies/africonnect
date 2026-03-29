"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { COMMERCE_ENABLED } from "@/lib/features";

interface ComingSoonProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

/**
 * ComingSoon wrapper component
 * 
 * Wraps content and displays a "Coming Soon" overlay when commerce features are disabled.
 * When COMMERCE_ENABLED is true, it renders children normally.
 */
export function ComingSoon({ 
  children, 
  title = "Coming Soon",
  description = "This feature is currently under development and will be available soon."
}: ComingSoonProps) {
  if (COMMERCE_ENABLED) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-6">
      <ComingSoonBanner title={title} description={description} />
      <div className="opacity-50 pointer-events-none select-none">
        {children}
      </div>
    </div>
  );
}

interface ComingSoonBannerProps {
  title?: string;
  description?: string;
}

/**
 * Standalone Coming Soon banner component
 */
export function ComingSoonBanner({ 
  title = "Coming Soon",
  description = "This feature is currently under development and will be available soon."
}: ComingSoonBannerProps) {
  return (
    <Card className="border-dashed border-2 bg-muted/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {title}
              <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

interface ComingSoonPageProps {
  title: string;
  description?: string;
  icon?: ReactNode;
}

/**
 * Full page Coming Soon placeholder
 */
export function ComingSoonPage({ 
  title,
  description = "This feature is currently under development and will be available soon.",
  icon
}: ComingSoonPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">
          {description}
        </p>
      </div>

      <Card className="border-dashed border-2">
        <CardContent className="py-16 text-center">
          <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            {icon || <Clock className="h-8 w-8 text-primary" />}
          </div>
          <h2 className="text-2xl font-semibold mb-2">Coming Soon</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            We&apos;re working hard to bring you this feature. Stay tuned for updates!
          </p>
          <Badge variant="secondary" className="mt-4">
            Under Development
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Badge component for navigation items
 */
export function ComingSoonBadge() {
  if (COMMERCE_ENABLED) {
    return null;
  }
  
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-muted">
      Soon
    </Badge>
  );
}
