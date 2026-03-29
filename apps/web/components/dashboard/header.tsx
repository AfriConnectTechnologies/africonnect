"use client";

import { Link } from "@/i18n/navigation";
import { MobileSidebarTrigger } from "./sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useChatContext } from "@/components/chat";
import { BrandIcon } from "@/components/brand-icon";
import { useTranslations } from "next-intl";
import { useCurrentUser } from "@/lib/hooks/useRole";

function MessageNotification() {
  const { unreadCount, isConnected } = useChatContext();
  const tNavigation = useTranslations("navigation");
  const currentUser = useCurrentUser();

  if (!isConnected || currentUser?.role === "bank") return null;

  return (
    <Link href="/messages">
      <Button variant="ghost" size="icon" className="relative">
        <MessageCircle className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs flex items-center justify-center"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
        <span className="sr-only">{tNavigation("messages")}</span>
      </Button>
    </Link>
  );
}

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <MobileSidebarTrigger />
      <Link href="/" className="flex items-center gap-2 md:hidden cursor-pointer">
        <BrandIcon className="h-8 w-8" />
        <span className="font-semibold">AfriConnect</span>
      </Link>
      <div className="flex-1" />
      <MessageNotification />
      <LanguageSwitcher />
      <ThemeToggle />
    </header>
  );
}

