/**
 * Feature Flags Configuration
 * 
 * This file contains feature flags that control various functionality
 * across the application. Feature flags are controlled via environment variables.
 */

/**
 * COMMERCE_ENABLED controls all payment, cart, checkout, and order functionality.
 * When set to false:
 * - Cart, Orders, and Billing pages show "Coming Soon" messaging
 * - Add to Cart buttons are disabled
 * - Checkout functionality is disabled
 * - Payment APIs return 503 Service Unavailable
 * 
 * Set via: NEXT_PUBLIC_ENABLE_COMMERCE=true|false
 */
export const COMMERCE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_COMMERCE === "true";

/**
 * COMPLIANCE_ENABLED controls tariff calculations and certificate of origin tools.
 * When set to false:
 * - Compliance navigation and pages are hidden
 * - Tariff reduction schedule and HS code tariff tools are unavailable
 * - Certificate of origin eligibility calculator is disabled
 *
 * Set via: NEXT_PUBLIC_ENABLE_COMPLIANCE=true|false
 */
export const COMPLIANCE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_COMPLIANCE === "true";

/**
 * COMPLIANCE_AI_ENABLED controls the AfCFTA document-grounded AI assistant.
 * When set to false:
 * - The assistant UI can stay hidden or behave as not configured
 * - Compliance Q&A API routes should not serve responses
 *
 * Set via: NEXT_PUBLIC_ENABLE_COMPLIANCE_AI=true|false
 */
export const COMPLIANCE_AI_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_COMPLIANCE_AI === "true";

const COMPLIANCE_EMAIL_ALLOWLIST = new Set([
  "hiruymulugeta441@gmail.com",
  "minasesotlg@gmail.com",
  "sw.minasefikadu@gmail.com"
]);

function normalizeEmail(email?: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

export function isComplianceEnabledForEmail(email?: string | null): boolean {
  if (COMPLIANCE_ENABLED) {
    return true;
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return false;
  }

  return COMPLIANCE_EMAIL_ALLOWLIST.has(normalizedEmail);
}
