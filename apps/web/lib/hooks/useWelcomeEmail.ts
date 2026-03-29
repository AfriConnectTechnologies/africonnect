"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@africonnect/convex/_generated/api";

/**
 * Hook to ensure user exists and send verification/welcome email for new users.
 * Should be used once in a layout that wraps authenticated pages.
 */
export function useWelcomeEmail(locale: string = "en") {
  const ensureUser = useMutation(api.users.ensureUser);
  const markWelcomeEmailSent = useMutation(api.users.markWelcomeEmailSent);
  const createVerificationToken = useMutation(api.verification.createEmailVerificationToken);
  const hasRunRef = useRef(false);

  useEffect(() => {
    // Only run once per session
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const initUser = async () => {
      try {
        const result = await ensureUser();
        
        // Send verification email for new users or users who haven't been verified yet
        if (result?.shouldSendVerificationEmail && result?.email) {
          try {
            // Create a verification token
            const tokenResult = await createVerificationToken();

            if (tokenResult?.notAuthenticated) {
              return;
            }
            
            if (tokenResult.alreadyVerified) {
              // User is already verified, just mark welcome email as sent if needed
              if (result.shouldSendWelcomeEmail) {
                await markWelcomeEmailSent();
              }
              return;
            }

            if (tokenResult.token) {
              // Send verification email
              const response = await fetch("/api/email/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "email-verification",
                  to: result.email,
                  userName: result.name,
                  verificationToken: tokenResult.token,
                  locale: locale,
                }),
              });

              if (!response.ok) {
                const data = await response.json();
                throw new Error(`API returned ${response.status}: ${JSON.stringify(data)}`);
              }

              const data = await response.json();
              
              // Mark welcome email as sent if verification email was sent successfully
              if (data.success && result.shouldSendWelcomeEmail) {
                await markWelcomeEmailSent();
              }
            }
          } catch (err) {
            console.error("Failed to send verification email:", err);
          }
        } else if (result?.shouldSendWelcomeEmail && result?.email && result?.emailVerified) {
          // User is already verified but hasn't received welcome email
          fetch("/api/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "welcome",
              to: result.email,
              userName: result.name,
              locale: locale,
            }),
          })
          .then(async (res) => {
            if (!res.ok) {
              const data = await res.json();
              throw new Error(`API returned ${res.status}: ${JSON.stringify(data)}`);
            }
            const data = await res.json();
            
            if (data.success) {
              await markWelcomeEmailSent();
            }
          })
          .catch((err) => {
            console.error("Failed to send welcome email:", err);
          });
        }
      } catch (error) {
        console.error("Failed to ensure user:", error);
      }
    };

    initUser();
  }, [ensureUser, markWelcomeEmailSent, createVerificationToken, locale]);
}
