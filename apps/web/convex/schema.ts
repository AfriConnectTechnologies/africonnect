import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const nullableOptionalString = v.optional(v.union(v.string(), v.null()));

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    role: v.optional(
      v.union(
        v.literal("buyer"),
        v.literal("seller"),
        v.literal("admin"),
        v.literal("bank")
      )
    ),
    businessId: v.optional(v.id("businesses")),
    bankId: v.optional(v.id("banks")),
    bankReferralId: v.optional(v.id("bankReferrals")),
    sellerApplicationStatus: v.optional(
      v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))
    ),
    sellerApplicationSubmittedAt: v.optional(v.number()),
    sellerApplicationReviewedAt: v.optional(v.number()),
    sellerApplicationReviewedBy: v.optional(v.id("users")),
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
    .index("by_role", ["role"])
    .index("by_seller_application_status", ["sellerApplicationStatus"]),

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
    // Registration documents
    businessLicenceImageUrl: nullableOptionalString,
    businessLicenceNumber: nullableOptionalString,
    memoOfAssociationImageUrl: nullableOptionalString,
    tinCertificateImageUrl: nullableOptionalString,
    tinCertificateNumber: nullableOptionalString,
    hasImportExportPermit: v.optional(v.boolean()),
    importExportPermitImageUrl: nullableOptionalString,
    importExportPermitNumber: nullableOptionalString,
    payoutBankCode: v.optional(v.string()),
    payoutBankName: v.optional(v.string()),
    payoutAccountNumber: v.optional(v.string()),
    payoutAccountName: v.optional(v.string()),
    payoutEnabled: v.optional(v.boolean()),
    payoutUpdatedAt: v.optional(v.number()),
    referredByBankId: v.optional(v.id("banks")),
    bankReferralId: v.optional(v.id("bankReferrals")),
    referralSource: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_status", ["verificationStatus"])
    .index("by_country", ["country"])
    .index("by_category", ["category"])
    .index("by_referred_bank", ["referredByBankId"])
    .index("by_bank_referral", ["bankReferralId"])
    .index("by_businessLicenceImageUrl", ["businessLicenceImageUrl"])
    .index("by_memoOfAssociationImageUrl", ["memoOfAssociationImageUrl"])
    .index("by_tinCertificateImageUrl", ["tinCertificateImageUrl"])
    .index("by_importExportPermitImageUrl", ["importExportPermitImageUrl"]),

  banks: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    referralCodePrefix: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_referral_prefix", ["referralCodePrefix"]),

  bankReferrals: defineTable({
    bankId: v.id("banks"),
    referralCode: v.string(),
    invitedByUserId: v.id("users"),
    invitedEmail: v.optional(v.string()),
    companyName: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("generated"),
      v.literal("signed_up"),
      v.literal("business_created"),
      v.literal("verified"),
      v.literal("active")
    ),
    acceptedUserId: v.optional(v.id("users")),
    businessId: v.optional(v.id("businesses")),
    acceptedAt: v.optional(v.number()),
    convertedAt: v.optional(v.number()),
    verifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_bank", ["bankId"])
    .index("by_bank_status", ["bankId", "status"])
    .index("by_referral_code", ["referralCode"])
    .index("by_business", ["businessId"])
    .index("by_accepted_user", ["acceptedUserId"]),

  orders: defineTable({
    userId: v.string(), // buyerId for marketplace orders
    buyerId: v.optional(v.string()), // explicit buyer ID
    sellerId: v.optional(v.string()), // seller ID for marketplace orders
    paymentId: v.optional(v.id("payments")),
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
    usdPrice: v.optional(v.number()),
    kesPrice: v.optional(v.number()),
    quantity: v.number(),
    sku: v.optional(v.string()),
    lowStockThreshold: v.optional(v.number()),
    reorderQuantity: v.optional(v.number()),
    category: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    isOrderable: v.optional(v.boolean()),
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
    .index("by_seller_sku", ["sellerId", "sku"])
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

  inventoryTransactions: defineTable({
    productId: v.id("products"),
    sellerId: v.string(),
    type: v.union(
      v.literal("restock"),
      v.literal("sale"),
      v.literal("adjustment"),
      v.literal("return"),
      v.literal("correction")
    ),
    direction: v.union(v.literal("in"), v.literal("out")),
    quantity: v.number(),
    previousQuantity: v.number(),
    newQuantity: v.number(),
    reason: v.optional(v.string()),
    reference: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_product", ["productId"])
    .index("by_product_created", ["productId", "createdAt"])
    .index("by_seller", ["sellerId"])
    .index("by_seller_created", ["sellerId", "createdAt"]),

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
    subscriptionId: v.optional(v.id("subscriptions")),
    chapaTransactionRef: v.string(), // tx_ref sent to Chapa
    chapaTrxRef: v.optional(v.string()), // trx_ref returned by Chapa
    amount: v.number(),
    currency: v.string(),
    processorFeeTotal: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("refunded"),
      v.literal("partially_refunded")
    ),
    paymentType: v.union(
      v.literal("order"),
      v.literal("subscription")
    ),
    metadata: v.optional(v.string()), // JSON string for additional data
    idempotencyKey: v.optional(v.string()), // For deduplication
    checkoutUrl: v.optional(v.string()), // Chapa checkout URL for pending payments
    // Refund fields
    refundedAt: v.optional(v.number()),
    refundAmount: v.optional(v.number()),
    refundReason: v.optional(v.string()),
    refundReference: v.optional(v.string()),
    refundedByUserId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_order", ["orderId"])
    .index("by_subscription", ["subscriptionId"])
    .index("by_chapa_ref", ["chapaTransactionRef"])
    .index("by_status", ["status"])
    .index("by_idempotency", ["userId", "idempotencyKey"]),

  payouts: defineTable({
    orderId: v.id("orders"),
    sellerId: v.string(),
    paymentId: v.optional(v.id("payments")),
    amountGross: v.number(),
    platformFeeSeller: v.number(),
    processorFeeAllocated: v.number(),
    amountNet: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("queued"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("reverted")
    ),
    reference: v.string(),
    chapaReference: v.optional(v.string()),
    bankReference: v.optional(v.string()),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_seller", ["sellerId"])
    .index("by_status", ["status"])
    .index("by_reference", ["reference"])
    .index("by_chapa_reference", ["chapaReference"]),

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

  // Subscription Plans (static/configurable)
  subscriptionPlans: defineTable({
    name: v.string(), // "Starter", "Growth", "Pro", "Enterprise"
    slug: v.string(), // "starter", "growth", "pro", "enterprise"
    description: v.optional(v.string()),
    targetCustomer: v.optional(v.string()), // "Small SMBs", "Growing SMBs", etc.
    monthlyPrice: v.number(), // In cents (2900 = $29)
    annualPrice: v.number(), // In cents (27800 = $278)
    currency: v.string(), // "USD"
    features: v.string(), // JSON array of feature strings
    limits: v.string(), // JSON: { maxProducts: 10, maxOrders: 100, ... }
    isActive: v.boolean(),
    isPopular: v.optional(v.boolean()), // For "Most Popular" badge
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_active", ["isActive"])
    .index("by_sort", ["sortOrder"]),

  // Active Subscriptions
  subscriptions: defineTable({
    businessId: v.id("businesses"),
    planId: v.id("subscriptionPlans"),
    status: v.union(
      v.literal("active"),
      v.literal("past_due"),
      v.literal("cancelled"),
      v.literal("trialing"),
      v.literal("expired")
    ),
    billingCycle: v.union(v.literal("monthly"), v.literal("annual")),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    trialEndsAt: v.optional(v.number()),
    lastPaymentId: v.optional(v.id("payments")),
    cancelledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_status", ["status"])
    .index("by_plan", ["planId"])
    .index("by_period_end", ["currentPeriodEnd"]),

  // Payment Audit Logs for security tracking
  paymentAuditLogs: defineTable({
    paymentId: v.optional(v.id("payments")),
    userId: v.optional(v.string()),
    action: v.string(), // "init", "verify", "webhook", "refund", "status_update"
    status: v.string(), // "success", "failed", "pending"
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    txRef: v.optional(v.string()),
    metadata: v.optional(v.string()), // JSON string for additional context
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_payment", ["paymentId"])
    .index("by_user", ["userId"])
    .index("by_action", ["action"])
    .index("by_tx_ref", ["txRef"])
    .index("by_created", ["createdAt"]),

  // Webhook Events for duplicate detection
  // Note: txRef should be unique per webhook, but Convex doesn't support unique constraints.
  // Uniqueness is enforced via check-after-insert pattern in markWebhookProcessed mutation
  // (see convex/paymentAuditLogs.ts:76-97) which handles race conditions deterministically.
  webhookEvents: defineTable({
    txRef: v.string(), // Uniqueness enforced at application level via markWebhookProcessed
    eventType: v.string(), // "payment.success", "payment.failed"
    processedAt: v.number(),
    signature: v.optional(v.string()),
  })
    .index("by_tx_ref", ["txRef"])
    .index("by_processed", ["processedAt"]),

  chatReports: defineTable({
    channelId: v.string(),
    reporterId: v.id("users"),
    reason: v.string(),
    status: v.union(v.literal("pending"), v.literal("reviewed"), v.literal("resolved")),
    createdAt: v.number(),
  })
    .index("by_channel", ["channelId"])
    .index("by_reporter", ["reporterId"])
    .index("by_channel_reporter", ["channelId", "reporterId"])
    .index("by_status", ["status"]),

  agreementVersions: defineTable({
    type: v.union(v.literal("seller"), v.literal("buyer")),
    version: v.string(),
    contentKey: v.string(),
    isActive: v.boolean(),
    requireReacceptance: v.optional(v.boolean()),
    effectiveDate: v.number(),
    createdAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_type_active", ["type", "isActive"]),

  agreementAcceptances: defineTable({
    userId: v.id("users"),
    agreementType: v.union(v.literal("seller"), v.literal("buyer")),
    agreementVersionId: v.id("agreementVersions"),
    acceptedAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_type", ["userId", "agreementType"])
    .index("by_user_type_version", ["userId", "agreementType", "agreementVersionId"]),

  // AfCFTA Compliance - Business Products with HS Codes
  businessProducts: defineTable({
    businessId: v.id("businesses"),
    hsCode: v.string(),
    productName: v.string(),
    productNameAmharic: v.optional(v.string()),
    isCompliant: v.boolean(), // Found in Category A
    currentRate: v.optional(v.string()), // Current year's rate
    rates: v.optional(v.string()), // JSON string of all rates { "2026": "2", "2027": "1.5", ... }
    country: v.optional(v.string()), // "ethiopia" or "kenya" (EAC)
    tariffCategory: v.optional(v.string()),
    tariffScheduleStatus: v.optional(
      v.union(v.literal("matched"), v.literal("not_matched"))
    ),
    tariffSource: v.optional(v.string()),
    tariffBaseRate: v.optional(v.string()),
    tariffUnit: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_hs_code", ["hsCode"])
    .index("by_business_hs", ["businessId", "hsCode"])
    .index("by_country", ["country"]),

  // Certificate of Origin - Eligibility Calculations (MaxNOM 60% Rule)
  originCalculations: defineTable({
    businessId: v.id("businesses"),
    productId: v.optional(v.id("businessProducts")), // Link to existing product
    productName: v.string(),

    // Step 1: EXW components
    costOfMaterials: v.number(),
    laborCosts: v.number(),
    factoryOverheads: v.number(),
    profitMargin: v.number(),
    exWorksPrice: v.number(), // Calculated total

    // Step 2: VNM (Value of Non-originating Materials)
    nonOriginatingMaterials: v.number(),
    vnmDetails: v.optional(v.string()), // JSON array of individual items

    // Step 3 & 4: Results
    vnmPercentage: v.number(),
    isEligible: v.boolean(),

    currency: v.string(), // ETB, USD, etc.
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_product", ["productId"])
    .index("by_eligibility", ["businessId", "isEligible"]),
});
