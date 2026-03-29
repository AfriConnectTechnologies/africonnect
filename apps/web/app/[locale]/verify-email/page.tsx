"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CheckCircle2, 
  XCircle, 
  Mail, 
  Loader2, 
  ArrowRight,
  RefreshCw,
  Globe2
} from "lucide-react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";

function VerifyEmailLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <nav className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Globe2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">AfriConnect</span>
          </div>
        </nav>
      </header>
      <main className="flex-1 flex items-center justify-center pt-16 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <CardTitle className="text-2xl">Loading...</CardTitle>
          </CardHeader>
        </Card>
      </main>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailLoading />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const t = useTranslations("verifyEmail");
  const locale = useLocale();
  const searchParams = useSearchParams();
  
  const token = searchParams.get("token");
  const success = searchParams.get("success");
  const error = searchParams.get("error");
  
  const [verificationState, setVerificationState] = useState<"idle" | "verifying" | "success" | "error">(
    success === "true" ? "success" : error ? "error" : "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string>(error || "");
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendCooldown, setResendCooldown] = useState(0);

  const verificationStatus = useQuery(api.verification.isEmailVerified);
  const resendToken = useMutation(api.verification.resendVerificationToken);

  // Verify token on mount if present
  useEffect(() => {
    const verifyToken = async (verificationToken: string) => {
      setVerificationState("verifying");
      try {
        const response = await fetch("/api/email/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: verificationToken }),
        });
        const data = await response.json();
        
        if (data.success) {
          setVerificationState("success");
        } else {
          setVerificationState("error");
          setErrorMessage(data.error || "Verification failed");
        }
      } catch {
        setVerificationState("error");
        setErrorMessage("Failed to verify email. Please try again.");
      }
    };

    if (token && verificationState === "idle") {
      verifyToken(token);
    }
  }, [token, verificationState]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendEmail = async () => {
    setResendState("sending");
    try {
      const result = await resendToken();
      
      if (result.alreadyVerified) {
        setVerificationState("success");
        setResendState("idle");
        return;
      }

      if (result.rateLimited) {
        setResendCooldown(result.waitSeconds || 60);
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
          setResendCooldown(60);
        } else {
          setResendState("error");
        }
      }
    } catch {
      setResendState("error");
    }
  };

  // If already verified, show success
  if (verificationStatus?.verified && verificationState !== "success") {
    setVerificationState("success");
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <nav className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Globe2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">AfriConnect</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center pt-16 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            {verificationState === "verifying" && (
              <>
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <CardTitle className="text-2xl">{t("verifying.title")}</CardTitle>
                <CardDescription>{t("verifying.description")}</CardDescription>
              </>
            )}

            {verificationState === "success" && (
              <>
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-2xl text-green-600 dark:text-green-400">
                  {t("success.title")}
                </CardTitle>
                <CardDescription>{t("success.description")}</CardDescription>
              </>
            )}

            {verificationState === "error" && (
              <>
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <CardTitle className="text-2xl text-red-600 dark:text-red-400">
                  {t("error.title")}
                </CardTitle>
                <CardDescription>
                  {errorMessage || t("error.description")}
                </CardDescription>
              </>
            )}

            {verificationState === "idle" && !token && (
              <>
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">{t("pending.title")}</CardTitle>
                <CardDescription>
                  {verificationStatus?.email 
                    ? t("pending.descriptionWithEmail", { email: verificationStatus.email })
                    : t("pending.description")
                  }
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {verificationState === "success" && (
              <div className="space-y-3">
                <SignedIn>
                  <Link href="/dashboard" className="block">
                    <Button className="w-full gap-2">
                      {t("success.goToDashboard")}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </SignedIn>
                <SignedOut>
                  <SignInButton mode="modal">
                    <Button className="w-full gap-2">
                      {t("success.signIn")}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </SignInButton>
                </SignedOut>
              </div>
            )}

            {(verificationState === "error" || verificationState === "idle") && !token && (
              <SignedIn>
                <div className="space-y-3">
                  {resendState === "sent" && (
                    <div className="text-sm text-green-600 dark:text-green-400 text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      {t("resend.sent")}
                    </div>
                  )}
                  
                  <Button 
                    onClick={handleResendEmail} 
                    disabled={resendState === "sending" || resendCooldown > 0}
                    variant={verificationState === "error" ? "default" : "outline"}
                    className="w-full gap-2"
                  >
                    {resendState === "sending" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("resend.sending")}
                      </>
                    ) : resendCooldown > 0 ? (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        {t("resend.cooldown", { seconds: resendCooldown })}
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        {t("resend.button")}
                      </>
                    )}
                  </Button>

                  <Link href="/dashboard" className="block">
                    <Button variant="ghost" className="w-full">
                      {t("skipForNow")}
                    </Button>
                  </Link>
                </div>
              </SignedIn>
            )}

            {verificationState === "error" && token && (
              <SignedIn>
                <div className="space-y-3">
                  <Button 
                    onClick={handleResendEmail} 
                    disabled={resendState === "sending" || resendCooldown > 0}
                    className="w-full gap-2"
                  >
                    {resendState === "sending" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("resend.sending")}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        {t("error.requestNewLink")}
                      </>
                    )}
                  </Button>
                  
                  <Link href="/dashboard" className="block">
                    <Button variant="ghost" className="w-full">
                      {t("skipForNow")}
                    </Button>
                  </Link>
                </div>
              </SignedIn>
            )}

            <SignedOut>
              {verificationState !== "success" && (
                <div className="text-center text-sm text-muted-foreground">
                  <SignInButton mode="modal">
                    <button className="text-primary hover:underline">
                      {t("signInToResend")}
                    </button>
                  </SignInButton>
                </div>
              )}
            </SignedOut>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} AfriConnect
        </div>
      </footer>
    </div>
  );
}
