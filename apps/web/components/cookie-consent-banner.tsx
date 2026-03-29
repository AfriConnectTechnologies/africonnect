"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Cookie, Settings, Shield, X } from "lucide-react";
import { Link } from "@/i18n/navigation";

const COOKIE_CONSENT_KEY = "africonnect-cookie-consent";

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
}

const defaultPreferences: CookiePreferences = {
  essential: true, // Always enabled
  analytics: false,
  functional: false,
  marketing: false,
};

export function CookieConsentBanner() {
  const t = useTranslations("cookieConsent");
  const [isVisible, setIsVisible] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [preferences, setPreferences] = React.useState<CookiePreferences>(defaultPreferences);

  // Check if user has already given consent
  React.useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) {
      // Small delay to avoid flash on page load
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    } else {
      try {
        const storedPrefs = JSON.parse(stored);
        setPreferences(storedPrefs);
      } catch {
        setIsVisible(true);
      }
    }
  }, []);

  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(prefs));
    setPreferences(prefs);
    setIsVisible(false);
    setShowSettings(false);
    
    // Dispatch custom event for PostHog provider to listen to
    window.dispatchEvent(new CustomEvent("cookieConsentChanged", { detail: prefs }));
  };

  const handleAcceptAll = () => {
    savePreferences({
      essential: true,
      analytics: true,
      functional: true,
      marketing: true,
    });
  };

  const handleRejectNonEssential = () => {
    savePreferences({
      essential: true,
      analytics: false,
      functional: false,
      marketing: false,
    });
  };

  const handleSavePreferences = () => {
    savePreferences(preferences);
  };

  const handlePreferenceChange = (key: keyof CookiePreferences, value: boolean) => {
    if (key === "essential") return; // Essential cookies cannot be disabled
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6">
      <Card className="mx-auto max-w-2xl border-border/50 bg-background/95 backdrop-blur-md shadow-lg">
        <CardContent className="p-4 sm:p-6">
          {!showSettings ? (
            // Main consent view
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Cookie className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-base">{t("title")}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t("description")}{" "}
                    <Link href="/privacy" className="text-primary hover:underline">
                      {t("privacyPolicy")}
                    </Link>
                    .
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Button onClick={handleAcceptAll} className="flex-1">
                  {t("acceptAll")}
                </Button>
                <Button onClick={handleRejectNonEssential} variant="outline" className="flex-1">
                  {t("rejectNonEssential")}
                </Button>
                <Button
                  onClick={() => setShowSettings(true)}
                  variant="ghost"
                  className="flex-1 gap-2"
                >
                  <Settings className="h-4 w-4" />
                  {t("customize")}
                </Button>
              </div>
            </div>
          ) : (
            // Settings view
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-base">{t("settings.title")}</h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowSettings(false)}
                  aria-label={t("close")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">{t("settings.description")}</p>

              <div className="space-y-3">
                {/* Essential Cookies */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium">{t("settings.essential.title")}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.essential.description")}
                    </p>
                  </div>
                  <Switch checked disabled aria-label={t("settings.essential.title")} />
                </div>

                {/* Functional Cookies */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium">{t("settings.functional.title")}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.functional.description")}
                    </p>
                  </div>
                  <Switch
                    checked={preferences.functional}
                    onCheckedChange={(checked) => handlePreferenceChange("functional", checked)}
                    aria-label={t("settings.functional.title")}
                  />
                </div>

                {/* Analytics Cookies */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium">{t("settings.analytics.title")}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.analytics.description")}
                    </p>
                  </div>
                  <Switch
                    checked={preferences.analytics}
                    onCheckedChange={(checked) => handlePreferenceChange("analytics", checked)}
                    aria-label={t("settings.analytics.title")}
                  />
                </div>

                {/* Marketing Cookies */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium">{t("settings.marketing.title")}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.marketing.description")}
                    </p>
                  </div>
                  <Switch
                    checked={preferences.marketing}
                    onCheckedChange={(checked) => handlePreferenceChange("marketing", checked)}
                    aria-label={t("settings.marketing.title")}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button onClick={handleSavePreferences} className="flex-1">
                  {t("settings.save")}
                </Button>
                <Button onClick={handleAcceptAll} variant="outline" className="flex-1">
                  {t("acceptAll")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
