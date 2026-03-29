"use client";

import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface MenuSectionProps {
  title: string;
  children: ReactNode;
}

export function MenuSection({ title, children }: MenuSectionProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground px-1">
        {title}
      </h3>
      <Card className="overflow-hidden">
        <CardContent className="p-0 divide-y">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
