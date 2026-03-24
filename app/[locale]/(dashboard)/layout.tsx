"use client";

import { useEffect } from "react";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";
import { useTranslations, useLocale } from "next-intl";
import { DashboardHeader } from "@/components/dashboard/header";
import { Sidebar } from "@/components/dashboard/sidebar";
import { EmailVerificationBanner } from "@/components/dashboard/email-verification-banner";
import { useWelcomeEmail } from "@/lib/hooks/useWelcomeEmail";
import { ChatProvider } from "@/components/chat";
import { useCurrentRole, useCurrentUser } from "@/lib/hooks/useRole";
import { usePathname, useRouter } from "@/i18n/navigation";
import { BankReferralTracker } from "@/components/dashboard/bank-referral-tracker";

function AuthenticatedDashboard({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const currentUser = useCurrentUser();
  const currentRole = useCurrentRole();
  const pathname = usePathname();
  const router = useRouter();
  const isBankUser = (currentRole as string | null | undefined) === "bank";
  const shouldMountChatProvider =
    currentUser !== undefined && currentUser?.role !== "bank";
  
  // Initialize user and send welcome email for new users
  useWelcomeEmail(locale);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const isBankRoute = pathname === "/bank" || pathname.startsWith("/bank/");
    const isSettingsRoute = pathname === "/settings" || pathname.startsWith("/settings/");

    if (isBankUser) {
      if (!isBankRoute && !isSettingsRoute) {
        router.replace("/bank");
      }
      return;
    }

    if (isBankRoute) {
      router.replace("/dashboard");
      return;
    }
  }, [currentUser, isBankUser, pathname, router]);

  const content = (
    <>
      <BankReferralTracker />
      <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0 print:overflow-visible">
          <div className="print:hidden">
            <EmailVerificationBanner />
            <DashboardHeader />
          </div>
          <main className="flex-1 overflow-y-auto p-4 print:overflow-visible print:p-0 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </>
  );

  return shouldMountChatProvider ? <ChatProvider>{content}</ChatProvider> : content;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("common");
  
  return (
    <>
      <SignedIn>
        <Authenticated>
          <AuthenticatedDashboard>{children}</AuthenticatedDashboard>
        </Authenticated>
        <Unauthenticated>
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-muted-foreground">{t("settingUp")}</div>
          </div>
        </Unauthenticated>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

