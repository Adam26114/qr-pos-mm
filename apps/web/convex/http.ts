import { httpRouter } from "convex/server"
import { authComponent, createAuth } from "./auth"

import { upload, preflight } from "./menu_photos"
import { ingest } from "./payments"

const http = httpRouter()
authComponent.registerRoutes(http, createAuth)
http.route({ path: "/menu-photo", method: "POST", handler: upload })
http.route({ path: "/menu-photo", method: "OPTIONS", handler: preflight })
http.route({ path: "/order-payment-events", method: "POST", handler: ingest })
export default http
