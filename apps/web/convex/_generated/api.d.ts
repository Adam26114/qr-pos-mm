/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as email from "../email.js";
import type * as guestOrders from "../guestOrders.js";
import type * as http from "../http.js";
import type * as lib_order_lines from "../lib/order_lines.js";
import type * as lib_order_money from "../lib/order_money.js";
import type * as lib_order_values from "../lib/order_values.js";
import type * as lib_payment_access from "../lib/payment_access.js";
import type * as lib_payment_adapter from "../lib/payment_adapter.js";
import type * as lib_payment_config from "../lib/payment_config.js";
import type * as lib_payment_protocol from "../lib/payment_protocol.js";
import type * as lib_report_period from "../lib/report_period.js";
import type * as lib_reporting from "../lib/reporting.js";
import type * as lib_store_access from "../lib/store_access.js";
import type * as menu from "../menu.js";
import type * as menu_photos from "../menu_photos.js";
import type * as orders from "../orders.js";
import type * as payments from "../payments.js";
import type * as publicMenu from "../publicMenu.js";
import type * as reports from "../reports.js";
import type * as simulator from "../simulator.js";
import type * as staff from "../staff.js";
import type * as stores from "../stores.js";
import type * as tables from "../tables.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  email: typeof email;
  guestOrders: typeof guestOrders;
  http: typeof http;
  "lib/order_lines": typeof lib_order_lines;
  "lib/order_money": typeof lib_order_money;
  "lib/order_values": typeof lib_order_values;
  "lib/payment_access": typeof lib_payment_access;
  "lib/payment_adapter": typeof lib_payment_adapter;
  "lib/payment_config": typeof lib_payment_config;
  "lib/payment_protocol": typeof lib_payment_protocol;
  "lib/report_period": typeof lib_report_period;
  "lib/reporting": typeof lib_reporting;
  "lib/store_access": typeof lib_store_access;
  menu: typeof menu;
  menu_photos: typeof menu_photos;
  orders: typeof orders;
  payments: typeof payments;
  publicMenu: typeof publicMenu;
  reports: typeof reports;
  simulator: typeof simulator;
  staff: typeof staff;
  stores: typeof stores;
  tables: typeof tables;
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

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
