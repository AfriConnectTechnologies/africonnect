"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Bot, Loader2, Shield } from "lucide-react";
import { AfcftaAiAssistant, GeneralAiAssistant } from "@/components/compliance";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isComplianceEnabledForEmail } from "@/lib/features";
import { ComingSoonPage } from "@/components/ui/coming-soon";

export default function AiAssistantPage() {
  const t = useTranslations("aiAssistantPage");
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const isComplianceEnabled =
    isLoaded &&
    isComplianceEnabledForEmail(user?.primaryEmailAddress?.emailAddress);

  const currentUser = useQuery(
    api.users.getCurrentUser,
    isComplianceEnabled ? undefined : "skip"
  );
  const myBusiness = useQuery(
    api.businesses.getMyBusiness,
    isComplianceEnabled ? undefined : "skip"
  );

  const isLoading = currentUser === undefined || myBusiness === undefined;
  const hasBusiness = !!myBusiness;
  const isEmailVerified = currentUser?.emailVerified ?? false;
  const isBusinessVerified = myBusiness?.verificationStatus === "verified";
  const canAccess = hasBusiness && isEmailVerified && isBusinessVerified;

  useEffect(() => {
    if (!isLoading && !hasBusiness) {
      router.push("/business/register");
    } else if (!isLoading && hasBusiness && !canAccess) {
      router.push("/business/profile");
    }
  }, [isLoading, hasBusiness, canAccess, router]);

  if (isLoaded && !isComplianceEnabled) {
    return (
      <ComingSoonPage
        title={t("title")}
        description={t("unavailable")}
        icon={<Bot className="h-8 w-8 text-primary" />}
      />
    );
  }

  if (isLoading || !canAccess) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Badge variant="outline" className="w-fit flex items-center gap-1">
          <Shield className="h-3 w-3" />
          AfCFTA
        </Badge>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            {t("tabs.general")}
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t("tabs.compliance")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <GeneralAiAssistant />
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          <AfcftaAiAssistant />
        </TabsContent>
      </Tabs>
    </div>
  );
}
