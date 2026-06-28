import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer } from "./server.js";
import { config } from "./config.js";
import { fetchAuthenticatedImage, isAllowedImagePath } from "./juno.js";

const app = express();
app.use(express.json());

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.post("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Authenticated profile-image proxy. `search_university` rewrites ERP image
// URLs to `<publicUrl>/img/<erp-image-path>` so the AI can render them; this
// route fetches the image through the logged-in employee session.
app.get("/img/{*path}", async (req, res) => {
  // Reconstruct the ERP-relative path + query (e.g. getStudentProfileImageById.json?id=123).
  const relPath = req.originalUrl.replace(/^\/img\//, "");
  if (!isAllowedImagePath(relPath)) {
    res.status(400).send("Unsupported image path");
    return;
  }
  try {
    const { buffer, contentType } = await fetchAuthenticatedImage(relPath);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(buffer);
  } catch (err) {
    console.error("[img] failed:", (err as Error).message);
    res.status(502).send("Failed to fetch image");
  }
});

app.get("/health", (_, res) => res.send("ok"));

app.listen(config.port, () => {
  console.error(`Juno ERP MCP running on http://localhost:${config.port}/mcp`);
});
