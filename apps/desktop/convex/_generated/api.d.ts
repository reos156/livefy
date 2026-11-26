/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as catalog from "../catalog.js";
import type * as catalogSeed from "../catalogSeed.js";
import type * as dashboard from "../dashboard.js";
import type * as http from "../http.js";
import type * as lib_requireUser from "../lib/requireUser.js";
import type * as migrations from "../migrations.js";
import type * as session from "../session.js";
import type * as shops from "../shops.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  catalog: typeof catalog;
  catalogSeed: typeof catalogSeed;
  dashboard: typeof dashboard;
  http: typeof http;
  "lib/requireUser": typeof lib_requireUser;
  migrations: typeof migrations;
  session: typeof session;
  shops: typeof shops;
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
