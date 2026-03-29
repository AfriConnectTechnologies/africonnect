"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@africonnect/convex/_generated/api";
import { useCurrentUser } from "@/lib/hooks/useRole";
import {
  clearStoredBankReferralCode,
  getStoredBankReferralCode,
} from "@/lib/bank-referrals";

function isPermanentReferralError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("invalid") || message.includes("expired");
}

export function BankReferralTracker() {
  const currentUser = useCurrentUser();
  const captureReferralSignup = useMutation(api.banks.captureReferralSignup);
  const attemptedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    const storedCode = getStoredBankReferralCode();
    if (!storedCode || !currentUser) {
      return;
    }

    if (currentUser.role === "bank" || currentUser.bankReferralId) {
      clearStoredBankReferralCode();
      return;
    }

    if (attemptedCodeRef.current === storedCode) {
      return;
    }

    attemptedCodeRef.current = storedCode;
    captureReferralSignup({ referralCode: storedCode })
      .then(() => {
        clearStoredBankReferralCode();
      })
      .catch((error) => {
        if (isPermanentReferralError(error)) {
          clearStoredBankReferralCode();
          return;
        }

        attemptedCodeRef.current = null;
      });
  }, [captureReferralSignup, currentUser]);

  return null;
}
