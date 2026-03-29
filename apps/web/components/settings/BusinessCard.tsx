"use client";

import { useQuery } from "convex/react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { Building2, MapPin, ChevronRight } from "lucide-react";

export function BusinessCard() {
  const myBusiness = useQuery(api.businesses.getMyBusiness);

  if (!myBusiness) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400">Verified</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400">Pending</Badge>;
    }
  };

  return (
    <Link href="/business/profile">
      <Card className="bg-primary hover:bg-primary/90 transition-colors cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary-foreground/20 flex items-center justify-center shrink-0">
              {myBusiness.logoUrl ? (
                <Image
                  src={myBusiness.logoUrl}
                  alt={myBusiness.name}
                  width={56}
                  height={56}
                  unoptimized
                  className="h-14 w-14 rounded-xl object-cover"
                />
              ) : (
                <Building2 className="h-7 w-7 text-primary-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-primary-foreground truncate">
                  {myBusiness.name}
                </h3>
                {getStatusBadge(myBusiness.verificationStatus)}
              </div>
              <div className="flex items-center gap-1 text-primary-foreground/80 text-sm mt-1">
                <MapPin className="h-3 w-3" />
                <span className="truncate">
                  {myBusiness.city ? `${myBusiness.city}, ` : ""}{myBusiness.country}
                </span>
              </div>
              <p className="text-primary-foreground/70 text-sm mt-0.5">
                {myBusiness.category}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-primary-foreground shrink-0 group-hover:translate-x-1 transition-transform" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
