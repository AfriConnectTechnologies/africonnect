"use client";

import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";

export function WelcomeHeader() {
  const t = useTranslations("dashboard");
  const { user } = useUser();
  const currentUser = useQuery(api.users.getCurrentUser);
  const myBusiness = useQuery(api.businesses.getMyBusiness);

  const getInitials = (name: string | undefined | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = currentUser?.name || user?.fullName || user?.firstName || "User";

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14 border-2 border-primary/20">
          <AvatarImage src={currentUser?.imageUrl || user?.imageUrl} alt={displayName} />
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm text-muted-foreground">{t("welcomeBack")}</p>
          <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
          <div className="flex items-center gap-2 mt-1">
            {currentUser?.role && (
              <Badge variant="secondary" className="text-xs">
                {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
              </Badge>
            )}
            {myBusiness?.verificationStatus === "verified" && (
              <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">
                Verified Seller
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
