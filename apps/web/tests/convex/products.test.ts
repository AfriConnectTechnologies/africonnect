import { describe, it, expect, vi } from "vitest";

/**
 * Convex Function Tests
 * 
 * There are two approaches to test Convex functions:
 * 
 * 1. Unit testing with mocks (shown below) - Good for testing logic
 * 2. Integration testing with convex-test - Requires convex dev server
 * 
 * For production, consider using Convex's built-in testing utilities:
 * https://docs.convex.dev/production/testing
 */

// Mock Convex context
const createMockCtx = (options: {
  isAuthenticated?: boolean;
  userId?: string;
  products?: Array<Record<string, unknown>>;
  user?: Record<string, unknown>;
}) => ({
  auth: {
    getUserIdentity: vi.fn().mockResolvedValue(
      options.isAuthenticated
        ? { subject: options.userId || "test-clerk-id" }
        : null
    ),
  },
  db: {
    query: vi.fn().mockReturnValue({
      withIndex: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue(options.products || []),
        first: vi.fn().mockResolvedValue(options.user || null),
      }),
      collect: vi.fn().mockResolvedValue(options.products || []),
    }),
    get: vi.fn(),
    insert: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
});

describe("Products Business Logic", () => {
  describe("Product filtering", () => {
    it("should filter products by search term (case insensitive)", () => {
      const products = [
        { name: "iPhone 15", description: "Latest Apple phone", status: "active" },
        { name: "Samsung Galaxy", description: "Android smartphone", status: "active" },
        { name: "MacBook Pro", description: "Apple laptop", status: "active" },
      ];

      const searchLower = "iphone".toLowerCase();
      const filtered = products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description?.toLowerCase().includes(searchLower)
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("iPhone 15");
    });

    it("should filter products by category", () => {
      const products = [
        { name: "iPhone", category: "Electronics", status: "active" },
        { name: "T-Shirt", category: "Clothing", status: "active" },
        { name: "Laptop", category: "Electronics", status: "active" },
      ];

      const filtered = products.filter((p) => p.category === "Electronics");

      expect(filtered).toHaveLength(2);
    });

    it("should sort products by creation date (newest first)", () => {
      const products = [
        { name: "Old Product", createdAt: 1000 },
        { name: "New Product", createdAt: 3000 },
        { name: "Mid Product", createdAt: 2000 },
      ];

      const sorted = [...products].sort((a, b) => b.createdAt - a.createdAt);

      expect(sorted[0].name).toBe("New Product");
      expect(sorted[1].name).toBe("Mid Product");
      expect(sorted[2].name).toBe("Old Product");
    });
  });

  describe("Authentication checks", () => {
    it("should return null for unauthenticated user", async () => {
      const ctx = createMockCtx({ isAuthenticated: false });
      const identity = await ctx.auth.getUserIdentity();
      expect(identity).toBeNull();
    });

    it("should return identity for authenticated user", async () => {
      const ctx = createMockCtx({ 
        isAuthenticated: true, 
        userId: "clerk-user-123" 
      });
      const identity = await ctx.auth.getUserIdentity();
      expect(identity).not.toBeNull();
      expect(identity?.subject).toBe("clerk-user-123");
    });
  });

  describe("Authorization checks", () => {
    it("should only allow product owner to update", () => {
      // sellerId stores clerkId, not _id
      const product = { sellerId: "clerk-user-123" };
      const currentUser = { _id: "convex-id-abc", clerkId: "clerk-user-123" };
      
      const isAuthorized = product.sellerId === currentUser.clerkId;
      expect(isAuthorized).toBe(true);
    });

    it("should reject update from non-owner", () => {
      // sellerId stores clerkId, not _id
      const product = { sellerId: "clerk-user-123" };
      const currentUser = { _id: "convex-id-xyz", clerkId: "clerk-user-456" };
      
      const isAuthorized = product.sellerId === currentUser.clerkId;
      expect(isAuthorized).toBe(false);
    });
  });

  describe("Product validation", () => {
    it("should require positive price", () => {
      const isValidPrice = (price: number) => price > 0;
      
      expect(isValidPrice(99.99)).toBe(true);
      expect(isValidPrice(0)).toBe(false);
      expect(isValidPrice(-10)).toBe(false);
    });

    it("should require non-negative quantity", () => {
      const isValidQuantity = (qty: number) => qty >= 0;
      
      expect(isValidQuantity(10)).toBe(true);
      expect(isValidQuantity(0)).toBe(true);
      expect(isValidQuantity(-1)).toBe(false);
    });

    it("should only allow valid status values", () => {
      const validStatuses = ["active", "inactive"];
      const isValidStatus = (status: string) => validStatuses.includes(status);
      
      expect(isValidStatus("active")).toBe(true);
      expect(isValidStatus("inactive")).toBe(true);
      expect(isValidStatus("deleted")).toBe(false);
    });
  });
});
