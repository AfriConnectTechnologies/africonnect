/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agreements from "../agreements.js";
import type * as banks from "../banks.js";
import type * as businesses from "../businesses.js";
import type * as cart from "../cart.js";
import type * as chat from "../chat.js";
import type * as compliance from "../compliance.js";
import type * as creditProfiles from "../creditProfiles.js";
import type * as crons from "../crons.js";
import type * as helpers from "../helpers.js";
import type * as inventory from "../inventory.js";
import type * as lib_logger from "../lib/logger.js";
import type * as orders from "../orders.js";
import type * as originCalculations from "../originCalculations.js";
import type * as paymentAuditLogs from "../paymentAuditLogs.js";
import type * as payments from "../payments.js";
import type * as payouts from "../payouts.js";
import type * as productImages from "../productImages.js";
import type * as products from "../products.js";
import type * as stats from "../stats.js";
import type * as subscriptionPlans from "../subscriptionPlans.js";
import type * as subscriptions from "../subscriptions.js";
import type * as users from "../users.js";
import type * as verification from "../verification.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agreements: typeof agreements;
  banks: typeof banks;
  businesses: typeof businesses;
  cart: typeof cart;
  chat: typeof chat;
  compliance: typeof compliance;
  creditProfiles: typeof creditProfiles;
  crons: typeof crons;
  helpers: typeof helpers;
  inventory: typeof inventory;
  "lib/logger": typeof lib_logger;
  orders: typeof orders;
  originCalculations: typeof originCalculations;
  paymentAuditLogs: typeof paymentAuditLogs;
  payments: typeof payments;
  payouts: typeof payouts;
  productImages: typeof productImages;
  products: typeof products;
  stats: typeof stats;
  subscriptionPlans: typeof subscriptionPlans;
  subscriptions: typeof subscriptions;
  users: typeof users;
  verification: typeof verification;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
