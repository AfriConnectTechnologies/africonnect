import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    role: v.optional(v.union(v.literal("buyer"), v.literal("seller"), v.literal("admin"))),
    businessId: v.optional(v.id("businesses")),
    welcomeEmailSent: v.optional(v.boolean()),
    emailVerified: v.optional(v.boolean()),
    emailVerifiedAt: v.optional(v.number()),
    preferences: v.optional(
      v.object({
        theme: v.optional(v.string()),
      })
    ),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  businesses: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    country: v.string(),
    city: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    website: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    category: v.string(),
    verificationStatus: v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_status", ["verificationStatus"])
    .index("by_country", ["country"])
    .index("by_category", ["category"]),

  orders: defineTable({
    userId: v.string(), // buyerId for marketplace orders
    buyerId: v.optional(v.string()), // explicit buyer ID
    sellerId: v.optional(v.string()), // seller ID for marketplace orders
    title: v.string(),
    customer: v.string(),
    amount: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_buyer", ["buyerId"])
    .index("by_seller", ["sellerId"])
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"])
    .index("by_buyer_status", ["buyerId", "status"])
    .index("by_seller_status", ["sellerId", "status"]),

  products: defineTable({
    sellerId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    quantity: v.number(),
    category: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    country: v.optional(v.string()),
    minOrderQuantity: v.optional(v.number()),
    specifications: v.optional(v.string()), // JSON string for key-value specs
    tags: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_seller", ["sellerId"])
    .index("by_status", ["status"])
    .index("by_seller_status", ["sellerId", "status"])
    .index("by_category", ["category"])
    .index("by_country", ["country"])
    .index("by_category_country", ["category", "country"]),

  productImages: defineTable({
    productId: v.id("products"),
    r2Key: v.string(),
    url: v.string(),
    order: v.number(),
    isPrimary: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_product", ["productId"])
    .index("by_product_primary", ["productId", "isPrimary"]),

  cartItems: defineTable({
    userId: v.string(),
    productId: v.id("products"),
    quantity: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_product", ["userId", "productId"]),

  orderItems: defineTable({
    orderId: v.id("orders"),
    productId: v.id("products"),
    quantity: v.number(),
    price: v.number(), // price snapshot at time of order
    createdAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_product", ["productId"]),

  payments: defineTable({
    userId: v.string(),
    orderId: v.optional(v.id("orders")),
    chapaTransactionRef: v.string(), // tx_ref sent to Chapa
    chapaTrxRef: v.optional(v.string()), // trx_ref returned by Chapa
    amount: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    paymentType: v.union(
      v.literal("order"),
      v.literal("subscription")
    ),
    metadata: v.optional(v.string()), // JSON string for additional data
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_order", ["orderId"])
    .index("by_chapa_ref", ["chapaTransactionRef"])
    .index("by_status", ["status"]),

  verificationTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    type: v.union(v.literal("email"), v.literal("password_reset")),
    expiresAt: v.number(),
    used: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"])
    .index("by_user_type", ["userId", "type"]),
});

