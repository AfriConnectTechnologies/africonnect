"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect, useState, createContext, useContext, useCallback, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";

const COOKIE_CONSENT_KEY = "africonnect-cookie-consent";

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
}

interface PostHogContextValue {
  isInitialized: boolean;
  hasConsent: boolean;
  trackEvent: (eventName: string, properties?: Record<string, unknown>) => void;
  identifyUser: (userId: string, properties?: Record<string, unknown>) => void;
  resetUser: () => void;
}

const PostHogContext = createContext<PostHogContextValue>({
  isInitialized: false,
  hasConsent: false,
  trackEvent: () => {},
  identifyUser: () => {},
  resetUser: () => {},
});

export const useAnalytics = () => useContext(PostHogContext);

// Page view tracker component
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthogClient = usePostHog();

  useEffect(() => {
    if (pathname && posthogClient) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      posthogClient.capture("$pageview", {
        $current_url: url,
      });
    }
  }, [pathname, searchParams, posthogClient]);

  return null;
}

// User identification component
function PostHogUserIdentify() {
  const { user, isSignedIn } = useUser();
  const posthogClient = usePostHog();
  const { hasConsent } = useAnalytics();

  useEffect(() => {
    if (posthogClient && isSignedIn && user) {
      const isOptedOut = posthogClient.has_opted_out_capturing?.() ?? false;
      const canIncludePII = hasConsent && !isOptedOut;
      posthogClient.identify(user.id, canIncludePII ? {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
        created_at: user.createdAt,
      } : undefined);
    } else if (posthogClient && !isSignedIn) {
      posthogClient.reset();
    }
  }, [posthogClient, user, isSignedIn, hasConsent]);

  return null;
}

function PostHogProviderInner({ children }: { children: React.ReactNode }) {
  const posthogClient = usePostHog();
  const [hasConsent, setHasConsent] = useState(() => {
    // Initialize consent state from localStorage
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (stored) {
          const prefs: CookiePreferences = JSON.parse(stored);
          return prefs.analytics;
        }
      } catch {
        // Ignore parse errors
      }
    }
    return false;
  });

  // Check and update consent status
  const checkConsent = useCallback(() => {
    try {
      const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (stored) {
        const prefs: CookiePreferences = JSON.parse(stored);
        return prefs.analytics;
      }
    } catch {
      // Ignore parse errors
    }
    return false;
  }, []);

  // Listen for consent changes
  useEffect(() => {
    // Listen for storage changes (consent updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === COOKIE_CONSENT_KEY) {
        const newConsent = checkConsent();
        setHasConsent(newConsent);
        if (posthogClient) {
          if (newConsent) {
            posthogClient.opt_in_capturing();
          } else {
            posthogClient.opt_out_capturing();
          }
        }
      }
    };

    // Also listen for custom events from same-window consent changes
    const handleConsentChange = () => {
      const newConsent = checkConsent();
      setHasConsent(newConsent);
      if (posthogClient) {
        if (newConsent) {
          posthogClient.opt_in_capturing();
        } else {
          posthogClient.opt_out_capturing();
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("cookieConsentChanged", handleConsentChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("cookieConsentChanged", handleConsentChange);
    };
  }, [checkConsent, posthogClient]);

  const trackEvent = useCallback(
    (eventName: string, properties?: Record<string, unknown>) => {
      if (posthogClient && hasConsent) {
        posthogClient.capture(eventName, properties);
      }
    },
    [posthogClient, hasConsent]
  );

  const identifyUser = useCallback(
    (userId: string, properties?: Record<string, unknown>) => {
      if (posthogClient && hasConsent) {
        posthogClient.identify(userId, properties);
      }
    },
    [posthogClient, hasConsent]
  );

  const resetUser = useCallback(() => {
    if (posthogClient) {
      posthogClient.reset();
    }
  }, [posthogClient]);

  const contextValue: PostHogContextValue = {
    isInitialized: !!posthogClient,
    hasConsent,
    trackEvent,
    identifyUser,
    resetUser,
  };

  return (
    <PostHogContext.Provider value={contextValue}>
      {children}
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogUserIdentify />
    </PostHogContext.Provider>
  );
}

// Initialize PostHog once on client side
let posthogInitialized = false;

function initializePostHog() {
  if (posthogInitialized || typeof window === "undefined") {
    return;
  }
  
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  // Use reverse proxy to bypass ad blockers - requests go through /api/ph instead of directly to PostHog
  // Using /api path to skip i18n middleware which would otherwise add locale prefix
  const posthogHost = "/api/ph";

  if (!posthogKey) {
    console.warn("[PostHog] Missing NEXT_PUBLIC_POSTHOG_KEY - analytics disabled");
    return;
  }

  // Check for analytics consent before initializing
  let hasConsent = false;
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (stored) {
      const prefs: CookiePreferences = JSON.parse(stored);
      hasConsent = prefs.analytics;
    }
  } catch {
    // Ignore parse errors
  }

  // Initialize PostHog with reverse proxy
  posthog.init(posthogKey, {
    api_host: posthogHost,
    ui_host: "https://us.posthog.com", // Required for toolbar to work with proxy
    capture_pageview: false, // We handle this manually
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    // Respect user's consent
    opt_out_capturing_by_default: !hasConsent,
    // Privacy settings
    mask_all_text: false,
    mask_all_element_attributes: false,
    // Session recording (optional - requires consent)
    disable_session_recording: !hasConsent,
    // Autocapture settings
    autocapture: hasConsent,
    // Exception tracking - capture uncaught errors automatically
    capture_exceptions: true,
    // Bootstrap with feature flags if needed
    bootstrap: {
      featureFlags: {},
    },
  });

  // Set initial consent state
  if (hasConsent) {
    posthog.opt_in_capturing();
  } else {
    posthog.opt_out_capturing();
  }
  
  posthogInitialized = true;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // Initialize PostHog on client side
  useEffect(() => {
    initializePostHog();
  }, []);

  // Check if PostHog key exists (this is a build-time check)
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>;
  }

  // Always render the provider - PostHog handles SSR gracefully
  return (
    <PHProvider client={posthog}>
      <PostHogProviderInner>{children}</PostHogProviderInner>
    </PHProvider>
  );
}

// Export commonly used analytics events
export const AnalyticsEvents = {
  // User events
  USER_SIGNED_UP: "user_signed_up",
  USER_SIGNED_IN: "user_signed_in",
  USER_SIGNED_OUT: "user_signed_out",

  // Business events
  BUSINESS_CREATED: "business_created",
  BUSINESS_VERIFIED: "business_verified",
  BUSINESS_UPDATED: "business_updated",

  // Product events
  PRODUCT_CREATED: "product_created",
  PRODUCT_UPDATED: "product_updated",
  PRODUCT_DELETED: "product_deleted",
  PRODUCT_VIEWED: "product_viewed",

  // Cart events
  CART_ITEM_ADDED: "cart_item_added",
  CART_ITEM_REMOVED: "cart_item_removed",
  CART_CLEARED: "cart_cleared",

  // Order events
  CHECKOUT_STARTED: "checkout_started",
  ORDER_CREATED: "order_created",
  ORDER_COMPLETED: "order_completed",
  ORDER_CANCELLED: "order_cancelled",

  // Payment events
  PAYMENT_INITIATED: "payment_initiated",
  PAYMENT_COMPLETED: "payment_completed",
  PAYMENT_FAILED: "payment_failed",

  // Subscription events
  SUBSCRIPTION_STARTED: "subscription_started",
  SUBSCRIPTION_UPGRADED: "subscription_upgraded",
  SUBSCRIPTION_DOWNGRADED: "subscription_downgraded",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",

  // Feature usage events
  ORIGIN_CALCULATION_PERFORMED: "origin_calculation_performed",
  COMPLIANCE_CHECK_PERFORMED: "compliance_check_performed",
  HS_CODE_SEARCHED: "hs_code_searched",

  // Chat events
  CHAT_STARTED: "chat_started",
  MESSAGE_SENT: "message_sent",

  // Search events
  SEARCH_PERFORMED: "search_performed",
  FILTER_APPLIED: "filter_applied",
} as const;

export type AnalyticsEvent = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];
