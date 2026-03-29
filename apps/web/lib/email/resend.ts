import { Resend } from "resend";

// Initialize Resend client
export const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
// For testing: use Resend's test address. For production: use a verified domain.
// To use your own domain, verify it at https://resend.com/domains
export const EMAIL_FROM = process.env.EMAIL_FROM || "AfriConnect <onboarding@resend.dev>";
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "minasesotlg@gmail.com";

// Get admin emails (supports comma-separated list)
export function getAdminEmails(): string[] {
  if (!ADMIN_EMAIL) return [];
  return ADMIN_EMAIL.split(",").map((email) => email.trim()).filter(Boolean);
}
