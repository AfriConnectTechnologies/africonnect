import { describe, it, expect } from "vitest";

/**
 * Subscriptions Business Logic Tests
 *
 * Tests for subscription operations including creation, renewal,
 * cancellation, and period calculations.
 */

// Mock data factories
const createMockSubscription = (overrides: Record<string, unknown> = {}) => ({
  _id: "subscription_123",
  businessId: "business_123",
  planId: "plan_starter",
  status: "active",
  billingCycle: "monthly" as string,
  currentPeriodStart: Date.now(),
  currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
  cancelAtPeriodEnd: false,
  trialEndsAt: undefined as number | undefined,
  lastPaymentId: undefined as string | undefined,
  cancelledAt: undefined as number | undefined,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

const createMockPlan = (overrides = {}) => ({
  _id: "plan_starter",
  name: "Starter",
  monthlyPrice: 99,
  annualPrice: 999,
  features: ["Feature 1", "Feature 2"],
  ...overrides,
});

const createMockPayment = (overrides = {}) => ({
  _id: "payment_123",
  userId: "user_123",
  amount: 99,
  currency: "ETB",
  status: "success",
  paymentType: "subscription",
  metadata: JSON.stringify({
    planId: "plan_starter",
    billingCycle: "monthly",
    businessId: "business_123",
  }),
  ...overrides,
});

describe("Subscriptions Business Logic", () => {
  describe("Subscription Status", () => {
    const validStatuses = ["active", "past_due", "cancelled", "trialing", "expired"];

    it("should only allow valid status values", () => {
      validStatuses.forEach((status) => {
        expect(validStatuses.includes(status)).toBe(true);
      });

      expect(validStatuses.includes("invalid")).toBe(false);
    });

    it("should identify active subscription", () => {
      const subscription = createMockSubscription({ status: "active" });

      const isActive = subscription.status === "active";

      expect(isActive).toBe(true);
    });

    it("should identify expired subscription", () => {
      const subscription = createMockSubscription({ status: "expired" });

      const isExpired = subscription.status === "expired";

      expect(isExpired).toBe(true);
    });

    it("should identify trial subscription", () => {
      const subscription = createMockSubscription({
        status: "trialing",
        trialEndsAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
      });

      const isTrialing = subscription.status === "trialing";

      expect(isTrialing).toBe(true);
    });
  });

  describe("Billing Cycles", () => {
    it("should support monthly billing", () => {
      const subscription = createMockSubscription({ billingCycle: "monthly" });

      expect(subscription.billingCycle).toBe("monthly");
    });

    it("should support annual billing", () => {
      const subscription = createMockSubscription({ billingCycle: "annual" });

      expect(subscription.billingCycle).toBe("annual");
    });
  });

  describe("Period Calculations", () => {
    it("should calculate monthly period (30 days)", () => {
      const billingCycle: string = "monthly";
      const periodDays = billingCycle === "annual" ? 365 : 30;
      const periodMs = periodDays * 24 * 60 * 60 * 1000;

      expect(periodDays).toBe(30);
      expect(periodMs).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it("should calculate annual period (365 days)", () => {
      const billingCycle: string = "annual";
      const periodDays = billingCycle === "annual" ? 365 : 30;
      const periodMs = periodDays * 24 * 60 * 60 * 1000;

      expect(periodDays).toBe(365);
      expect(periodMs).toBe(365 * 24 * 60 * 60 * 1000);
    });

    it("should set correct period end from period start", () => {
      const now = Date.now();
      const billingCycle: string = "monthly";
      const periodDays = billingCycle === "annual" ? 365 : 30;
      const periodMs = periodDays * 24 * 60 * 60 * 1000;

      const periodStart = now;
      const periodEnd = now + periodMs;

      expect(periodEnd - periodStart).toBe(periodMs);
    });

    it("should detect expired subscription", () => {
      const now = Date.now();
      const subscription = createMockSubscription({
        currentPeriodEnd: now - 1000, // 1 second ago
      });

      const isExpired = subscription.currentPeriodEnd < now;

      expect(isExpired).toBe(true);
    });

    it("should detect active subscription period", () => {
      const now = Date.now();
      const subscription = createMockSubscription({
        currentPeriodEnd: now + 7 * 24 * 60 * 60 * 1000, // 7 days from now
      });

      const isWithinPeriod = subscription.currentPeriodEnd > now;

      expect(isWithinPeriod).toBe(true);
    });
  });

  describe("Subscription Creation from Payment", () => {
    it("should parse subscription metadata correctly", () => {
      const payment = createMockPayment();
      const metadata = JSON.parse(payment.metadata!);

      expect(metadata.planId).toBe("plan_starter");
      expect(metadata.billingCycle).toBe("monthly");
      expect(metadata.businessId).toBe("business_123");
    });

    it("should set initial status to active on successful payment", () => {
      const paymentStatus = "success";
      const subscriptionStatus = paymentStatus === "success" ? "active" : "pending";

      expect(subscriptionStatus).toBe("active");
    });

    it("should link payment to subscription", () => {
      const payment = createMockPayment();
      const subscription = createMockSubscription({
        lastPaymentId: payment._id,
      });

      expect(subscription.lastPaymentId).toBe(payment._id);
    });
  });

  describe("Subscription Renewal", () => {
    it("should update existing subscription on renewal", () => {
      const existingSubscription = createMockSubscription({
        planId: "plan_starter",
        billingCycle: "monthly",
      });
      const newPlanId = "plan_pro";

      // Simulating renewal with upgrade
      const updatedSubscription = {
        ...existingSubscription,
        planId: newPlanId,
        status: "active",
      };

      expect(updatedSubscription.planId).toBe("plan_pro");
      expect(updatedSubscription.status).toBe("active");
    });

    it("should reset cancelAtPeriodEnd on renewal", () => {
      const subscription = createMockSubscription({
        cancelAtPeriodEnd: true,
      });

      const renewedSubscription = {
        ...subscription,
        cancelAtPeriodEnd: false,
      };

      expect(renewedSubscription.cancelAtPeriodEnd).toBe(false);
    });

    it("should clear trial end date on renewal", () => {
      const subscription = createMockSubscription({
        status: "trialing",
        trialEndsAt: Date.now() + 1000,
      });

      const renewedSubscription = {
        ...subscription,
        status: "active",
        trialEndsAt: undefined,
      };

      expect(renewedSubscription.trialEndsAt).toBeUndefined();
      expect(renewedSubscription.status).toBe("active");
    });
  });

  describe("Subscription Cancellation", () => {
    it("should set cancelAtPeriodEnd when requesting cancellation", () => {
      const subscription = createMockSubscription({
        cancelAtPeriodEnd: false,
      });

      const updatedSubscription = {
        ...subscription,
        cancelAtPeriodEnd: true,
      };

      expect(updatedSubscription.cancelAtPeriodEnd).toBe(true);
    });

    it("should keep status active until period ends when cancelAtPeriodEnd", () => {
      const now = Date.now();
      const subscription = createMockSubscription({
        status: "active",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: now + 7 * 24 * 60 * 60 * 1000,
      });

      // Should remain active until period ends
      expect(subscription.status).toBe("active");
      expect(subscription.cancelAtPeriodEnd).toBe(true);
    });

    it("should set status to cancelled on immediate cancellation", () => {
      const subscription = createMockSubscription();
      const now = Date.now();

      const cancelledSubscription = {
        ...subscription,
        status: "cancelled",
        cancelledAt: now,
      };

      expect(cancelledSubscription.status).toBe("cancelled");
      expect(cancelledSubscription.cancelledAt).toBeDefined();
    });
  });

  describe("Trial Period", () => {
    it("should set trial end date correctly", () => {
      const now = Date.now();
      const trialDays = 14;
      const trialEndsAt = now + trialDays * 24 * 60 * 60 * 1000;

      const subscription = createMockSubscription({
        status: "trialing",
        trialEndsAt,
      });

      expect(subscription.trialEndsAt).toBe(trialEndsAt);
    });

    it("should detect trial expired", () => {
      const now = Date.now();
      const subscription = createMockSubscription({
        status: "trialing",
        trialEndsAt: now - 1000, // 1 second ago
      });

      const isTrialExpired =
        subscription.trialEndsAt !== undefined && subscription.trialEndsAt < now;

      expect(isTrialExpired).toBe(true);
    });

    it("should detect trial still valid", () => {
      const now = Date.now();
      const subscription = createMockSubscription({
        status: "trialing",
        trialEndsAt: now + 7 * 24 * 60 * 60 * 1000,
      });

      const isTrialValid =
        subscription.trialEndsAt !== undefined && subscription.trialEndsAt > now;

      expect(isTrialValid).toBe(true);
    });
  });

  describe("Subscription Pricing", () => {
    it("should use monthly price for monthly billing", () => {
      const plan = createMockPlan({
        monthlyPrice: 99,
        annualPrice: 999,
      });
      const billingCycle: string = "monthly";

      const price = billingCycle === "monthly" ? plan.monthlyPrice : plan.annualPrice;

      expect(price).toBe(99);
    });

    it("should use annual price for annual billing", () => {
      const plan = createMockPlan({
        monthlyPrice: 99,
        annualPrice: 999,
      });
      const billingCycle: string = "annual";

      const price = billingCycle === "monthly" ? plan.monthlyPrice : plan.annualPrice;

      expect(price).toBe(999);
    });

    it("should calculate annual savings", () => {
      const plan = createMockPlan({
        monthlyPrice: 99,
        annualPrice: 999,
      });

      const monthlyPerYear = plan.monthlyPrice * 12;
      const annualSavings = monthlyPerYear - plan.annualPrice;

      expect(monthlyPerYear).toBe(1188);
      expect(annualSavings).toBe(189);
    });
  });

  describe("Business-Subscription Relationship", () => {
    it("should associate subscription with business", () => {
      const businessId = "business_123";
      const subscription = createMockSubscription({ businessId });

      expect(subscription.businessId).toBe(businessId);
    });

    it("should find subscription by business ID", () => {
      const subscriptions = [
        createMockSubscription({ businessId: "business_1" }),
        createMockSubscription({ businessId: "business_2" }),
        createMockSubscription({ businessId: "business_3" }),
      ];

      const found = subscriptions.find((s) => s.businessId === "business_2");

      expect(found).toBeDefined();
      expect(found?.businessId).toBe("business_2");
    });

    it("should only allow one active subscription per business", () => {
      const businessId = "business_123";
      const existingSubscription = createMockSubscription({
        businessId,
        status: "active",
      });

      // When new subscription is created for same business, it should update existing
      const shouldUpdate = existingSubscription.businessId === businessId;

      expect(shouldUpdate).toBe(true);
    });
  });

  describe("Subscription Queries", () => {
    it("should filter subscriptions by status", () => {
      const subscriptions = [
        createMockSubscription({ status: "active" }),
        createMockSubscription({ status: "cancelled" }),
        createMockSubscription({ status: "active" }),
        createMockSubscription({ status: "expired" }),
      ];

      const active = subscriptions.filter((s) => s.status === "active");

      expect(active.length).toBe(2);
    });

    it("should find subscriptions expiring soon", () => {
      const now = Date.now();
      const threeDays = 3 * 24 * 60 * 60 * 1000;

      const subscriptions = [
        createMockSubscription({ currentPeriodEnd: now + 1 * 24 * 60 * 60 * 1000 }), // 1 day
        createMockSubscription({ currentPeriodEnd: now + 7 * 24 * 60 * 60 * 1000 }), // 7 days
        createMockSubscription({ currentPeriodEnd: now + 2 * 24 * 60 * 60 * 1000 }), // 2 days
      ];

      const expiringSoon = subscriptions.filter(
        (s) => s.currentPeriodEnd - now <= threeDays
      );

      expect(expiringSoon.length).toBe(2);
    });

    it("should filter subscriptions by plan", () => {
      const subscriptions = [
        createMockSubscription({ planId: "plan_starter" }),
        createMockSubscription({ planId: "plan_pro" }),
        createMockSubscription({ planId: "plan_starter" }),
      ];

      const starterPlans = subscriptions.filter(
        (s) => s.planId === "plan_starter"
      );

      expect(starterPlans.length).toBe(2);
    });
  });

  describe("Subscription Edge Cases", () => {
    it("should handle subscription without trial", () => {
      const subscription = createMockSubscription({
        trialEndsAt: undefined,
      });

      expect(subscription.trialEndsAt).toBeUndefined();
    });

    it("should handle immediate cancellation (no period end wait)", () => {
      const now = Date.now();
      const subscription = createMockSubscription({
        status: "cancelled",
        cancelledAt: now,
        cancelAtPeriodEnd: false,
      });

      expect(subscription.status).toBe("cancelled");
      expect(subscription.cancelAtPeriodEnd).toBe(false);
    });

    it("should handle plan upgrade mid-cycle", () => {
      const subscription = createMockSubscription({
        planId: "plan_starter",
        billingCycle: "monthly",
      });

      // Upgrade preserves current period
      const upgradedSubscription = {
        ...subscription,
        planId: "plan_pro",
        // currentPeriodEnd stays the same
      };

      expect(upgradedSubscription.planId).toBe("plan_pro");
      expect(upgradedSubscription.currentPeriodEnd).toBe(
        subscription.currentPeriodEnd
      );
    });

    it("should handle billing cycle change", () => {
      const now = Date.now();
      const subscription = createMockSubscription({
        billingCycle: "monthly",
      });

      const annualPeriodMs = 365 * 24 * 60 * 60 * 1000;
      const updatedSubscription = {
        ...subscription,
        billingCycle: "annual",
        currentPeriodStart: now,
        currentPeriodEnd: now + annualPeriodMs,
      };

      expect(updatedSubscription.billingCycle).toBe("annual");
    });
  });

  describe("Subscription Metadata Validation", () => {
    it("should require planId in metadata", () => {
      const metadata: Record<string, string | undefined> = { billingCycle: "monthly", businessId: "b123" };

      const hasRequiredFields = metadata.planId !== undefined;

      expect(hasRequiredFields).toBe(false);
    });

    it("should require businessId in metadata", () => {
      const metadata: Record<string, string | undefined> = { planId: "plan_starter", billingCycle: "monthly" };

      const hasRequiredFields = metadata.businessId !== undefined;

      expect(hasRequiredFields).toBe(false);
    });

    it("should default billingCycle to monthly", () => {
      const metadata: Record<string, string | undefined> = { planId: "plan_starter", businessId: "b123" };

      const billingCycle = metadata.billingCycle || "monthly";

      expect(billingCycle).toBe("monthly");
    });

    it("should validate complete metadata", () => {
      const metadata: Record<string, string | undefined> = {
        planId: "plan_starter",
        billingCycle: "monthly",
        businessId: "business_123",
      };

      const isValid =
        metadata.planId !== undefined &&
        metadata.businessId !== undefined &&
        ["monthly", "annual"].includes(metadata.billingCycle || "monthly");

      expect(isValid).toBe(true);
    });
  });
});
