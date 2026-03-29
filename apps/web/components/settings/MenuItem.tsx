"use client";

import { LucideIcon, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface MenuItemProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  value?: string;
  onClick?: () => void;
  href?: string;
  isSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
}

export function MenuItem({
  icon: Icon,
  label,
  description,
  value,
  onClick,
  isSwitch,
  switchValue,
  onSwitchChange,
  variant = "default",
  disabled,
}: MenuItemProps) {
  const content = (
    <div
      className={cn(
        "flex items-center gap-4 p-4 transition-colors",
        !disabled && "hover:bg-accent/50 cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={!disabled && !isSwitch ? onClick : undefined}
    >
      <div 
        className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
          variant === "destructive" 
            ? "bg-destructive/10" 
            : "bg-muted"
        )}
      >
        <Icon 
          className={cn(
            "h-5 w-5",
            variant === "destructive" 
              ? "text-destructive" 
              : "text-muted-foreground"
          )} 
        />
      </div>
      <div className="flex-1 min-w-0">
        <p 
          className={cn(
            "font-medium",
            variant === "destructive" && "text-destructive"
          )}
        >
          {label}
        </p>
        {description && (
          <p className="text-sm text-muted-foreground truncate">{description}</p>
        )}
      </div>
      {isSwitch ? (
        <Switch
          checked={switchValue}
          onCheckedChange={onSwitchChange}
          disabled={disabled}
        />
      ) : value ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-sm">{value}</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );

  return content;
}
