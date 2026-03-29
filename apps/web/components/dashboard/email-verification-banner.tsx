"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@africonnect/convex/_generated/api";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Mail, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmailVerificationBanner() {
  const t = useTranslations("verificationBanner");
  const locale = useLocale();
  const verificationStatus = useQuery(api.verification.isEmailVerified);
  const resendToken = useMutation(api.verification.resendVerificationToken);
  
  const [dismissed, setDismissed] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // Don't show if dismissed, loading, not authenticated, or already verified
  if (
    dismissed ||
    verificationStatus === undefined ||
    !verificationStatus.authenticated ||
    !verificationStatus.userExists ||
    verificationStatus.verified
  ) {
    return null;
  }

  const handleResend = async () => {
    setResendState("sending");
    try {
      const result = await resendToken();

      if (result.notAuthenticated) {
        setResendState("idle");
        return;
      }
      
      if (result.alreadyVerified) {
        setDismissed(true);
        return;
      }

      if (result.rateLimited) {
        setResendState("error");
        return;
      }

      if (result.token) {
        // Send the verification email
        const response = await fetch("/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "email-verification",
            to: result.email,
            userName: result.name,
            verificationToken: result.token,
            locale,
          }),
        });
        
        if (response.ok) {
          setResendState("sent");
          // Reset after 5 seconds
          setTimeout(() => setResendState("idle"), 5000);
        } else {
          setResendState("error");
        }
      }
    } catch {
      setResendState("error");
    }
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 p-1.5 rounded-full bg-amber-100 dark:bg-amber-900/50">
              <Mail className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-sm text-amber-800 dark:text-amber-200 truncate">
              {t("message")}
            </p>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {resendState === "sent" ? (
              <span className="text-sm text-green-600 dark:text-green-400">
                {t("sent")}
              </span>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResend}
                  disabled={resendState === "sending"}
                  className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                >
                  {resendState === "sending" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("resend")
                  )}
                </Button>
                <Link href="/verify-email">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                  >
                    {t("verify")}
                  </Button>
                </Link>
              </>
            )}
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded-md text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
              aria-label={t("dismiss")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
