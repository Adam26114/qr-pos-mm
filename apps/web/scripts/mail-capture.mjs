import { createServer } from "node:http"

// Loopback-only replacement for external mail delivery, never an app route.
const messages = []
createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json")
  try {
    if (request.method === "POST" && request.url === "/emails") {
      let body = ""
      for await (const chunk of request) {
        body += chunk
        if (body.length > 64_000) {
          response.writeHead(413).end()
          return
        }
      }
      messages.push(JSON.parse(body))
      if (messages.length > 1_000) messages.shift()
      response.end(JSON.stringify({ id: crypto.randomUUID() }))
    } else if (request.method === "GET" && request.url === "/messages") {
      response.end(JSON.stringify(messages))
    } else if (request.method === "GET" && request.url === "/health") {
      response.end(JSON.stringify({ ready: true }))
    } else {
      response.writeHead(404).end()
    }
  } catch {
    response.writeHead(400).end(JSON.stringify({ error: "Invalid request" }))
  }
}).listen(4010, "127.0.0.1")
