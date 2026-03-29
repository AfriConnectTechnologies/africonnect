import { z } from "zod";

/**
 * Payment validation schemas using Zod
 */

// Supported currencies
export const SUPPORTED_CURRENCIES = ["ETB", "USD"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

// Payment types
export const PAYMENT_TYPES = ["order", "subscription"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

// Billing cycles for subscriptions
export const BILLING_CYCLES = ["monthly", "annual"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

/**
 * Schema for payment initialization with currency-specific validation
 */
export const paymentInitializeSchema = z.object({
  amount: z
    .number({ message: "Amount must be a number" })
    .positive("Amount must be greater than 0"),
  currency: z
    .enum(SUPPORTED_CURRENCIES, {
      message: `Currency must be one of: ${SUPPORTED_CURRENCIES.join(", ")}`,
    })
    .default("ETB"),
  paymentType: z
    .enum(PAYMENT_TYPES, {
      message: `Payment type must be one of: ${PAYMENT_TYPES.join(", ")}`,
    })
    .default("order"),
  metadata: z.record(z.string(), z.string()).optional(),
  idempotencyKey: z
    .string()
    .max(64, "Idempotency key too long")
    .regex(/^[a-zA-Z0-9_-]+$/, "Idempotency key contains invalid characters")
    .optional(),
}).superRefine((data, ctx) => {
  // Apply currency-specific limits consistent with validateAmountForCurrency
  const limits: Record<SupportedCurrency, { min: number; max: number }> = {
    ETB: { min: 1, max: 1000000 }, // 1 ETB to 1 million ETB (Chapa limit)
    USD: { min: 1, max: 100000 }, // 1 USD to 100,000 USD
  };
  
  const limit = limits[data.currency as SupportedCurrency];
  if (limit) {
    if (data.amount < limit.min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Minimum amount for ${data.currency} is ${limit.min}`,
        path: ["amount"],
      });
    }
    if (data.amount > limit.max) {
      const maxFormatted = limit.max.toLocaleString();
      const message =
        data.currency === "ETB"
          ? `Order total exceeds the checkout limit of ETB ${maxFormatted}. Please reduce quantity or split your order.`
          : `Maximum amount for ${data.currency} is ${maxFormatted}`;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: ["amount"],
      });
    }
  }
});

export type PaymentInitializeInput = z.infer<typeof paymentInitializeSchema>;

/**
 * Schema for payment verification
 */
export const paymentVerifySchema = z.object({
  tx_ref: z
    .string({ message: "Transaction reference is required" })
    .min(1, "Transaction reference cannot be empty")
    .max(100, "Transaction reference too long")
    .regex(/^AC(-[A-Z0-9]+)+$/, "Invalid transaction reference format"),
});

export type PaymentVerifyInput = z.infer<typeof paymentVerifySchema>;

/**
 * Schema for subscription checkout
 */
export const subscriptionCheckoutSchema = z.object({
  planId: z
    .string({ message: "Plan ID is required" })
    .min(1, "Plan ID cannot be empty"),
  billingCycle: z.enum(BILLING_CYCLES, {
    message: `Billing cycle must be one of: ${BILLING_CYCLES.join(", ")}`,
  }),
  idempotencyKey: z
    .string()
    .max(64, "Idempotency key too long")
    .regex(/^[a-zA-Z0-9_-]+$/, "Idempotency key contains invalid characters")
    .optional(),
});

export type SubscriptionCheckoutInput = z.infer<typeof subscriptionCheckoutSchema>;

/**
 * Schema for webhook payload
 */
export const webhookPayloadSchema = z.object({
  tx_ref: z.string().min(1, "Transaction reference is required"),
  status: z.string().min(1, "Status is required"), // Required - fail fast on incomplete webhooks
  trx_ref: z.string().optional(),
  amount: z.number().optional(),
  currency: z.enum(SUPPORTED_CURRENCIES).optional(), // Validate against supported currencies
  created_at: z.string().optional(),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

/**
 * Validate and parse input with detailed error messages
 */
export function validatePaymentInput<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string; details: z.ZodIssue[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  // Format error message
  const errorMessages = result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  
  return {
    success: false,
    error: errorMessages[0] || "Validation failed",
    details: result.error.issues,
  };
}

/**
 * Sanitize string input to prevent injection attacks
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML/XML tags
    .slice(0, 1000); // Limit length
}

/**
 * Validate amount for specific currency
 */
export function validateAmountForCurrency(
  amount: number,
  currency: SupportedCurrency
): { valid: boolean; error?: string } {
  const limits: Record<SupportedCurrency, { min: number; max: number }> = {
    ETB: { min: 1, max: 1000000 }, // 1 ETB to 1 million ETB (Chapa limit)
    USD: { min: 1, max: 100000 }, // 1 USD to 100,000 USD
  };
  
  const limit = limits[currency];
  
  if (amount < limit.min) {
    return { valid: false, error: `Minimum amount for ${currency} is ${limit.min}` };
  }
  
  if (amount > limit.max) {
    const maxFormatted = limit.max.toLocaleString();
    if (currency === "ETB") {
      return {
        valid: false,
        error: `Order total exceeds the checkout limit of ETB ${maxFormatted}. Please reduce quantity or split your order.`,
      };
    }
    return { valid: false, error: `Maximum amount for ${currency} is ${maxFormatted}` };
  }
  
  return { valid: true };
}
