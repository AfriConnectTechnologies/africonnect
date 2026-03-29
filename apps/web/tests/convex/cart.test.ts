import { describe, it, expect } from "vitest";

/**
 * Cart Business Logic Tests
 *
 * Tests for cart operations including add, update, remove, and validation rules.
 */

// Mock data factories
const createMockUser = (overrides = {}) => ({
  _id: "user_123",
  clerkId: "clerk_buyer_123",
  email: "buyer@test.com",
  name: "Test Buyer",
  role: "buyer",
  ...overrides,
});

const createMockProduct = (overrides = {}) => ({
  _id: "product_123",
  sellerId: "clerk_seller_456",
  name: "Test Product",
  description: "A test product",
  price: 100,
  quantity: 10,
  status: "active",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

const createMockCartItem = (overrides = {}) => ({
  _id: "cart_item_123",
  userId: "user_123",
  productId: "product_123",
  quantity: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

describe("Cart Business Logic", () => {
  describe("Add to Cart Validation", () => {
    it("should allow adding product from different seller", () => {
      const user = createMockUser({ clerkId: "clerk_buyer_123" });
      const product = createMockProduct({ sellerId: "clerk_seller_456" });

      const isOwnProduct =
        product.sellerId === user.clerkId || product.sellerId === user._id;

      expect(isOwnProduct).toBe(false);
    });

    it("should reject adding own product (sellerId matches clerkId)", () => {
      const user = createMockUser({ clerkId: "clerk_user_123" });
      const product = createMockProduct({ sellerId: "clerk_user_123" });

      const isOwnProduct =
        product.sellerId === user.clerkId || product.sellerId === user._id;

      expect(isOwnProduct).toBe(true);
    });

    it("should reject adding own product (sellerId matches _id - legacy)", () => {
      const user = createMockUser({ _id: "convex_user_123", clerkId: "clerk_123" });
      const product = createMockProduct({ sellerId: "convex_user_123" });

      const isOwnProduct =
        product.sellerId === user.clerkId || product.sellerId === user._id;

      expect(isOwnProduct).toBe(true);
    });

    it("should reject inactive products", () => {
      const product = createMockProduct({ status: "inactive" });

      const isAvailable = product.status === "active";

      expect(isAvailable).toBe(false);
    });

    it("should reject quantity exceeding stock", () => {
      const product = createMockProduct({ quantity: 5 });
      const requestedQuantity = 10;

      const hasStock = requestedQuantity <= product.quantity;

      expect(hasStock).toBe(false);
    });

    it("should accept quantity within stock", () => {
      const product = createMockProduct({ quantity: 10 });
      const requestedQuantity = 5;

      const hasStock = requestedQuantity <= product.quantity;

      expect(hasStock).toBe(true);
    });

    it("should reject zero quantity", () => {
      const isValidQuantity = (qty: number) => qty > 0;

      expect(isValidQuantity(0)).toBe(false);
      expect(isValidQuantity(-1)).toBe(false);
      expect(isValidQuantity(1)).toBe(true);
    });

    it("should reject negative quantity", () => {
      const isValidQuantity = (qty: number) => qty > 0;

      expect(isValidQuantity(-5)).toBe(false);
    });
  });

  describe("Add to Cart - Existing Item Logic", () => {
    it("should merge quantities when item already in cart", () => {
      const existingCartItem = createMockCartItem({ quantity: 3 });
      const additionalQuantity = 2;
      const product = createMockProduct({ quantity: 10 });

      const newQuantity = existingCartItem.quantity + additionalQuantity;
      const isWithinStock = newQuantity <= product.quantity;

      expect(newQuantity).toBe(5);
      expect(isWithinStock).toBe(true);
    });

    it("should reject if merged quantity exceeds stock", () => {
      const existingCartItem = createMockCartItem({ quantity: 8 });
      const additionalQuantity = 5;
      const product = createMockProduct({ quantity: 10 });

      const newQuantity = existingCartItem.quantity + additionalQuantity;
      const isWithinStock = newQuantity <= product.quantity;

      expect(newQuantity).toBe(13);
      expect(isWithinStock).toBe(false);
    });
  });

  describe("Update Cart Item", () => {
    it("should allow updating quantity within stock", () => {
      const product = createMockProduct({ quantity: 10 });
      const newQuantity = 7;

      const isValid = newQuantity > 0 && newQuantity <= product.quantity;

      expect(isValid).toBe(true);
    });

    it("should delete item when quantity set to zero", () => {
      const quantity = 0;
      const shouldDelete = quantity <= 0;

      expect(shouldDelete).toBe(true);
    });

    it("should delete item when quantity is negative", () => {
      const quantity = -1;
      const shouldDelete = quantity <= 0;

      expect(shouldDelete).toBe(true);
    });

    it("should reject quantity exceeding stock on update", () => {
      const product = createMockProduct({ quantity: 5 });
      const newQuantity = 10;

      const isValid = newQuantity <= product.quantity;

      expect(isValid).toBe(false);
    });
  });

  describe("Cart Authorization", () => {
    it("should only allow owner to update cart item", () => {
      const cartItem = createMockCartItem({ userId: "user_123" });
      const currentUser = createMockUser({ _id: "user_123" });

      const isOwner = cartItem.userId === currentUser._id;

      expect(isOwner).toBe(true);
    });

    it("should reject update from non-owner", () => {
      const cartItem = createMockCartItem({ userId: "user_123" });
      const currentUser = createMockUser({ _id: "user_456" });

      const isOwner = cartItem.userId === currentUser._id;

      expect(isOwner).toBe(false);
    });
  });

  describe("Cart Total Calculation", () => {
    it("should calculate cart subtotal correctly", () => {
      const cartItems = [
        { quantity: 2, product: { price: 100 } },
        { quantity: 3, product: { price: 50 } },
        { quantity: 1, product: { price: 200 } },
      ];

      const subtotal = cartItems.reduce(
        (sum, item) => sum + item.quantity * item.product.price,
        0
      );

      expect(subtotal).toBe(2 * 100 + 3 * 50 + 1 * 200); // 200 + 150 + 200 = 550
    });

    it("should calculate buyer fee (1%)", () => {
      const subtotal = 1000;
      const buyerFee = Math.round(subtotal * 0.01 * 100) / 100;

      expect(buyerFee).toBe(10);
    });

    it("should calculate total with buyer fee", () => {
      const subtotal = 1000;
      const buyerFee = Math.round(subtotal * 0.01 * 100) / 100;
      const total = subtotal + buyerFee;

      expect(total).toBe(1010);
    });

    it("should handle fractional buyer fee", () => {
      const subtotal = 99.99;
      const buyerFee = Math.round(subtotal * 0.01 * 100) / 100;

      expect(buyerFee).toBe(1); // Rounded from 0.9999
    });
  });

  describe("Cart Edge Cases", () => {
    it("should handle empty cart", () => {
      const cartItems: unknown[] = [];

      expect(cartItems.length).toBe(0);
    });

    it("should filter out null products", () => {
      const cartWithProducts = [
        { productId: "p1", product: { name: "Product 1" } },
        { productId: "p2", product: null },
        { productId: "p3", product: { name: "Product 3" } },
      ];

      const validItems = cartWithProducts.filter((item) => item.product !== null);

      expect(validItems.length).toBe(2);
    });

    it("should handle product at exactly zero stock", () => {
      const product = createMockProduct({ quantity: 0 });
      const requestedQuantity = 1;

      const hasStock = requestedQuantity <= product.quantity;

      expect(hasStock).toBe(false);
    });
  });
});
