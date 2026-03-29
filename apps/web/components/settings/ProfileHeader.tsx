"use client";

import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { CheckCircle2 } from "lucide-react";

export function ProfileHeader() {
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
  const email = currentUser?.email || user?.primaryEmailAddress?.emailAddress || "";

  const getRoleBadgeStyle = (role: string | undefined) => {
    switch (role) {
      case "seller":
        return "bg-primary/10 text-primary border-primary/20";
      case "admin":
        return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400";
      default:
        return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400";
    }
  };

  return (
    <div className="bg-card rounded-2xl border p-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 border-4 border-primary/20">
          <AvatarImage src={currentUser?.imageUrl || user?.imageUrl} alt={displayName} />
          <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{displayName}</h2>
          <p className="text-muted-foreground">{email}</p>
          <div className="flex items-center gap-2 mt-2">
            {currentUser?.role && (
              <Badge 
                variant="outline" 
                className={`text-xs ${getRoleBadgeStyle(currentUser.role)}`}
              >
                {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
              </Badge>
            )}
            {myBusiness?.verificationStatus === "verified" && (
              <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50 dark:bg-green-900/30">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Verified
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
