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
import type * as lib_store_access from "../lib/store_access.js";
import type * as menu from "../menu.js";
import type * as menu_photos from "../menu_photos.js";
import type * as orders from "../orders.js";
import type * as publicMenu from "../publicMenu.js";
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
  "lib/store_access": typeof lib_store_access;
  menu: typeof menu;
  menu_photos: typeof menu_photos;
  orders: typeof orders;
  publicMenu: typeof publicMenu;
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
