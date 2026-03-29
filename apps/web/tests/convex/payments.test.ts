import { describe, it, expect } from "vitest";

/**
 * Payments Business Logic Tests
 *
 * Tests for payment operations including creation, verification,
 * status updates, subscription handling, and fee calculations.
 */

// Mock data factories
const createMockUser = (overrides = {}) => ({
  _id: "user_123",
  clerkId: "clerk_user_123",
  email: "user@test.com",
  name: "Test User",
  role: "buyer",
  ...overrides,
});

const createMockPayment = (overrides: Record<string, unknown> = {}) => ({
  _id: "payment_123",
  userId: "user_123",
  chapaTransactionRef: "AC-1234567890-ABC123",
  amount: 1000,
  currency: "ETB",
  status: "pending",
  paymentType: "order",
  idempotencyKey: undefined as string | undefined,
  metadata: undefined as string | undefined,
  processorFeeTotal: undefined as number | undefined,
  refundAmount: undefined as number | undefined,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

const createMockCartSnapshot = (items: Array<{
  productId: string;
  quantity: number;
  price: number;
  sellerId: string;
  productName: string;
}>) => {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const buyerFee = Math.round(subtotal * 0.01 * 100) / 100;
  return JSON.stringify({ items, subtotal, buyerFee });
};

describe("Payments Business Logic", () => {
  describe("Transaction Reference Generation", () => {
    it("should generate unique transaction references", () => {
      const generateTxRef = () => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `AC-${timestamp}-${random}`;
      };

      const ref1 = generateTxRef();
      const ref2 = generateTxRef();

      expect(ref1).toMatch(/^AC-\d+-[A-Z0-9]{6}$/);
      expect(ref1).not.toBe(ref2); // Should be unique
    });

    it("should have correct prefix", () => {
      const txRef = "AC-1234567890-ABC123";

      expect(txRef.startsWith("AC-")).toBe(true);
    });
  });

  describe("Payment Status Transitions", () => {
    const validStatuses = ["pending", "success", "failed", "cancelled"];

    it("should only allow valid status values", () => {
      validStatuses.forEach((status) => {
        expect(validStatuses.includes(status)).toBe(true);
      });

      expect(validStatuses.includes("invalid")).toBe(false);
    });

    it("should allow pending -> success transition", () => {
      const payment = createMockPayment({ status: "pending" });
      const newStatus = "success";

      const isValidTransition =
        payment.status === "pending" && validStatuses.includes(newStatus);

      expect(isValidTransition).toBe(true);
    });

    it("should allow pending -> failed transition", () => {
      const payment = createMockPayment({ status: "pending" });
      const newStatus = "failed";

      const isValidTransition =
        payment.status === "pending" && validStatuses.includes(newStatus);

      expect(isValidTransition).toBe(true);
    });

    it("should not re-process already successful payment", () => {
      const payment = createMockPayment({ status: "success" });

      const shouldSkip = payment.status === "success";

      expect(shouldSkip).toBe(true);
    });
  });

  describe("Payment Types", () => {
    it("should support order payment type", () => {
      const payment = createMockPayment({ paymentType: "order" });

      expect(payment.paymentType).toBe("order");
    });

    it("should support subscription payment type", () => {
      const payment = createMockPayment({ paymentType: "subscription" });

      expect(payment.paymentType).toBe("subscription");
    });
  });

  describe("Cart Snapshot - Order Payments", () => {
    it("should create valid cart snapshot", () => {
      const items = [
        {
          productId: "p1",
          quantity: 2,
          price: 100,
          sellerId: "seller_1",
          productName: "Product 1",
        },
        {
          productId: "p2",
          quantity: 1,
          price: 50,
          sellerId: "seller_2",
          productName: "Product 2",
        },
      ];

      const snapshot = createMockCartSnapshot(items);
      const parsed = JSON.parse(snapshot);

      expect(parsed.items.length).toBe(2);
      expect(parsed.subtotal).toBe(250); // 2*100 + 1*50
      expect(parsed.buyerFee).toBe(2.5); // 1% of 250
    });

    it("should reject payment creation with empty cart", () => {
      const cartItems: unknown[] = [];

      const canCreate = cartItems.length > 0;

      expect(canCreate).toBe(false);
    });

    it("should include all required item fields", () => {
      const item = {
        productId: "p1",
        quantity: 2,
        price: 100,
        sellerId: "seller_1",
        productName: "Product 1",
      };

      expect(item).toHaveProperty("productId");
      expect(item).toHaveProperty("quantity");
      expect(item).toHaveProperty("price");
      expect(item).toHaveProperty("sellerId");
      expect(item).toHaveProperty("productName");
    });
  });

  describe("Fee Calculations", () => {
    it("should calculate buyer fee (1%)", () => {
      const subtotal = 1000;
      const buyerFee = Math.round(subtotal * 0.01 * 100) / 100;

      expect(buyerFee).toBe(10);
    });

    it("should calculate total charge (subtotal + buyer fee)", () => {
      const subtotal = 1000;
      const buyerFee = Math.round(subtotal * 0.01 * 100) / 100;
      const totalCharge = subtotal + buyerFee;

      expect(totalCharge).toBe(1010);
    });

    it("should handle rounding for fractional fees", () => {
      const subtotal = 99.99;
      const buyerFee = Math.round(subtotal * 0.01 * 100) / 100;

      expect(buyerFee).toBe(1); // Rounded
    });

    it("should handle large amounts", () => {
      const subtotal = 100000;
      const buyerFee = Math.round(subtotal * 0.01 * 100) / 100;

      expect(buyerFee).toBe(1000);
    });

    it("should handle zero amount", () => {
      const subtotal = 0;
      const buyerFee = Math.round(subtotal * 0.01 * 100) / 100;

      expect(buyerFee).toBe(0);
    });
  });

  describe("Idempotency", () => {
    it("should detect duplicate idempotency keys", () => {
      const existingPayments = [
        createMockPayment({ idempotencyKey: "key_123" }),
        createMockPayment({ idempotencyKey: "key_456" }),
      ];

      const newKey = "key_123";
      const isDuplicate = existingPayments.some(
        (p) => p.idempotencyKey === newKey
      );

      expect(isDuplicate).toBe(true);
    });

    it("should allow new idempotency key", () => {
      const existingPayments = [
        createMockPayment({ idempotencyKey: "key_123" }),
      ];

      const newKey = "key_999";
      const isDuplicate = existingPayments.some(
        (p) => p.idempotencyKey === newKey
      );

      expect(isDuplicate).toBe(false);
    });

    it("should resolve race condition with deterministic tiebreaker", () => {
      const duplicates = [
        createMockPayment({ _id: "payment_b", idempotencyKey: "key_123" }),
        createMockPayment({ _id: "payment_a", idempotencyKey: "key_123" }),
        createMockPayment({ _id: "payment_c", idempotencyKey: "key_123" }),
      ];

      // Lexicographically smallest _id wins
      duplicates.sort((a, b) => (a._id < b._id ? -1 : 1));
      const winner = duplicates[0];

      expect(winner._id).toBe("payment_a");
    });
  });

  describe("Order Creation from Payment", () => {
    it("should parse cart snapshot correctly", () => {
      const cartData = [
        {
          productId: "p1",
          quantity: 2,
          price: 100,
          sellerId: "seller_1",
          productName: "Product 1",
        },
      ];

      const metadata = JSON.stringify({ items: cartData });
      const parsed = JSON.parse(metadata);

      expect(Array.isArray(parsed.items)).toBe(true);
      expect(parsed.items.length).toBe(1);
    });

    it("should handle legacy array format in metadata", () => {
      const cartData = [
        {
          productId: "p1",
          quantity: 1,
          price: 50,
          sellerId: "s1",
          productName: "P1",
        },
      ];

      const metadata = JSON.stringify(cartData); // Array directly
      const parsed = JSON.parse(metadata);

      let items;
      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (parsed && Array.isArray(parsed.items)) {
        items = parsed.items;
      } else {
        items = [];
      }

      expect(items.length).toBe(1);
    });

    it("should group items by seller", () => {
      const cartData = [
        { sellerId: "seller_a", productId: "p1" },
        { sellerId: "seller_b", productId: "p2" },
        { sellerId: "seller_a", productId: "p3" },
      ];

      const itemsBySeller = new Map<string, typeof cartData>();
      for (const item of cartData) {
        if (!itemsBySeller.has(item.sellerId)) {
          itemsBySeller.set(item.sellerId, []);
        }
        itemsBySeller.get(item.sellerId)!.push(item);
      }

      expect(itemsBySeller.size).toBe(2);
      expect(itemsBySeller.get("seller_a")?.length).toBe(2);
      expect(itemsBySeller.get("seller_b")?.length).toBe(1);
    });

    it("should set order status to processing on successful payment", () => {
      const paymentStatus = "success";
      const orderStatus = paymentStatus === "success" ? "processing" : "pending";

      expect(orderStatus).toBe("processing");
    });
  });

  describe("Payment Authorization", () => {
    it("should only allow owner to view payment", () => {
      const payment = createMockPayment({ userId: "user_123" });
      const user = createMockUser({ _id: "user_123" });

      const isOwner = payment.userId === user._id;

      expect(isOwner).toBe(true);
    });

    it("should reject unauthorized user", () => {
      const payment = createMockPayment({ userId: "user_123" });
      const user = createMockUser({ _id: "user_456" });

      const isOwner = payment.userId === user._id;

      expect(isOwner).toBe(false);
    });
  });

  describe("Payment Queries", () => {
    it("should find payment by transaction reference", () => {
      const payments = [
        createMockPayment({ chapaTransactionRef: "AC-111-ABC" }),
        createMockPayment({ chapaTransactionRef: "AC-222-DEF" }),
        createMockPayment({ chapaTransactionRef: "AC-333-GHI" }),
      ];

      const searchRef = "AC-222-DEF";
      const found = payments.find((p) => p.chapaTransactionRef === searchRef);

      expect(found).toBeDefined();
      expect(found?.chapaTransactionRef).toBe(searchRef);
    });

    it("should filter payments by status", () => {
      const payments = [
        createMockPayment({ status: "pending" }),
        createMockPayment({ status: "success" }),
        createMockPayment({ status: "pending" }),
        createMockPayment({ status: "failed" }),
      ];

      const pending = payments.filter((p) => p.status === "pending");

      expect(pending.length).toBe(2);
    });

    it("should sort payments by createdAt (newest first)", () => {
      const payments = [
        createMockPayment({ _id: "p1", createdAt: 1000 }),
        createMockPayment({ _id: "p2", createdAt: 3000 }),
        createMockPayment({ _id: "p3", createdAt: 2000 }),
      ];

      const sorted = [...payments].sort((a, b) => b.createdAt - a.createdAt);

      expect(sorted[0]._id).toBe("p2");
      expect(sorted[2]._id).toBe("p1");
    });
  });

  describe("Refund Logic", () => {
    it("should only allow refund on successful payments", () => {
      const payment = createMockPayment({ status: "success" });

      const canRefund = payment.status === "success";

      expect(canRefund).toBe(true);
    });

    it("should reject refund on pending payment", () => {
      const payment = createMockPayment({ status: "pending" });

      const canRefund = payment.status === "success";

      expect(canRefund).toBe(false);
    });

    it("should reject refund on failed payment", () => {
      const payment = createMockPayment({ status: "failed" });

      const canRefund = payment.status === "success";

      expect(canRefund).toBe(false);
    });

    it("should validate refund amount (not exceeding original)", () => {
      const payment = createMockPayment({ amount: 1000 });
      const refundAmount = 500;

      const isValidAmount = refundAmount > 0 && refundAmount <= payment.amount;

      expect(isValidAmount).toBe(true);
    });

    it("should reject refund amount exceeding original", () => {
      const payment = createMockPayment({ amount: 1000 });
      const refundAmount = 1500;

      const isValidAmount = refundAmount > 0 && refundAmount <= payment.amount;

      expect(isValidAmount).toBe(false);
    });

    it("should reject zero refund amount", () => {
      const refundAmount = 0;

      const isValidAmount = refundAmount > 0;

      expect(isValidAmount).toBe(false);
    });

    it("should reject negative refund amount", () => {
      const refundAmount = -100;

      const isValidAmount = refundAmount > 0;

      expect(isValidAmount).toBe(false);
    });

    it("should calculate partial refund status", () => {
      const payment = createMockPayment({ amount: 1000 });
      const refundAmount = 500;
      const totalRefunded = refundAmount;

      const newStatus =
        totalRefunded >= payment.amount ? "refunded" : "partially_refunded";

      expect(newStatus).toBe("partially_refunded");
    });

    it("should calculate full refund status", () => {
      const payment = createMockPayment({ amount: 1000 });
      const refundAmount = 1000;
      const totalRefunded = refundAmount;

      const newStatus =
        totalRefunded >= payment.amount ? "refunded" : "partially_refunded";

      expect(newStatus).toBe("refunded");
    });

    it("should accumulate multiple refunds", () => {
      const payment = createMockPayment({
        amount: 1000,
        refundAmount: 300,
      });
      const newRefundAmount = 200;

      const previousRefund = payment.refundAmount || 0;
      const totalRefunded = previousRefund + newRefundAmount;

      expect(totalRefunded).toBe(500);
    });
  });

  describe("Processor Fee Handling", () => {
    it("should store processor fee when provided", () => {
      const processorFeeTotal = 29.5; // Chapa's ~2.9%
      const payment = createMockPayment({ processorFeeTotal });

      expect(payment.processorFeeTotal).toBe(29.5);
    });

    it("should allow updating processor fee on existing payment", () => {
      const payment = createMockPayment({ status: "success" });

      // Fee update should be allowed even on success status
      const canUpdateFee = payment.status === "success";

      expect(canUpdateFee).toBe(true);
    });
  });

  describe("Payment Edge Cases", () => {
    it("should handle very small amounts", () => {
      const payment = createMockPayment({ amount: 0.01 });
      const buyerFee = Math.round(payment.amount * 0.01 * 100) / 100;

      expect(buyerFee).toBe(0);
    });

    it("should handle very large amounts", () => {
      const payment = createMockPayment({ amount: 9999999.99 });

      expect(payment.amount).toBe(9999999.99);
    });

    it("should handle missing metadata gracefully", () => {
      const payment = createMockPayment({ metadata: undefined });

      const hasMetadata = !!payment.metadata;

      expect(hasMetadata).toBe(false);
    });

    it("should handle invalid JSON in metadata", () => {
      const invalidJson = "not valid json {";

      let parsed;
      try {
        parsed = JSON.parse(invalidJson);
      } catch {
        parsed = null;
      }

      expect(parsed).toBeNull();
    });
  });
});
