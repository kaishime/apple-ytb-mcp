// server.js — Apple YTB MCP Server (SSE transport)
import express from "express";
import cors from "cors";
import { TOOLS } from "./tools.js";
import {
  handleSearchNiches,
  handleGetNicheDetail,
  handleAnalyzeChannel,
  handleSaveNiche,
  handleGetSavedNiches,
  handleRemoveSavedNiche,
  handleGetTopNiches,
  handleCompareNiches
} from "./handlers.js";

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────
app.use(cors({ origin: "*", methods: ["GET","POST","OPTIONS"], allowedHeaders: "*" }));
app.use(express.json());

// ── SSE client registry ────────────────────────────────────────
const sseClients = new Map();
let clientIdCounter = 0;

// ── Health check ───────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    name: "Apple YTB MCP Server",
    version: "1.0.0",
    description: "YouTube Niche Finder — powered by Apple YTB",
    tools: TOOLS.length,
    status: "running",
    endpoints: {
      sse:      "GET  /sse",
      message:  "POST /message?sessionId=<id>",
      health:   "GET  /health"
    }
  });
});

app.get("/health", (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// ── SSE endpoint (MCP transport) ──────────────────────────────
app.get("/sse", (req, res) => {
  const clientId = String(++clientIdCounter);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  sseClients.set(clientId, res);

  // Send endpoint event — tells client where to POST messages
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  sendSSE(res, "endpoint", `${baseUrl}/message?sessionId=${clientId}`);

  // Keep-alive ping every 25s
  const ping = setInterval(() => {
    if (res.writableEnded) { clearInterval(ping); return; }
    res.write(": ping\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(ping);
    sseClients.delete(clientId);
  });
});

// ── Message endpoint (JSON-RPC over SSE) ──────────────────────
app.post("/message", async (req, res) => {
  const { sessionId } = req.query;
  const sseRes = sseClients.get(sessionId);

  if (!sseRes) {
    return res.status(404).json({ error: "Session not found" });
  }

  res.status(202).json({ ok: true });

  const msg = req.body;

  try {
    const response = await handleRPC(msg);
    sendSSE(sseRes, "message", JSON.stringify(response));
  } catch (err) {
    const errResponse = {
      jsonrpc: "2.0",
      id: msg?.id ?? null,
      error: { code: -32603, message: err.message }
    };
    sendSSE(sseRes, "message", JSON.stringify(errResponse));
  }
});

// ── JSON-RPC handler ──────────────────────────────────────────
async function handleRPC(msg) {
  const { method, params, id } = msg;

  // initialize
  if (method === "initialize") {
    return {
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "apple-ytb-mcp", version: "1.0.0" }
      }
    };
  }

  // tools/list
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }

  // tools/call
  if (method === "tools/call") {
    const { name, arguments: args = {} } = params;
    const result = await executeTool(name, args);
    return {
      jsonrpc: "2.0", id,
      result: {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !!result.error
      }
    };
  }

  // notifications (no response needed)
  if (method?.startsWith("notifications/")) return null;

  return {
    jsonrpc: "2.0", id,
    error: { code: -32601, message: `Method not found: ${method}` }
  };
}

// ── Tool dispatcher ───────────────────────────────────────────
async function executeTool(name, args) {
  const dispatch = {
    search_niches:       () => handleSearchNiches(args),
    get_niche_detail:    () => handleGetNicheDetail(args),
    analyze_channel:     () => handleAnalyzeChannel(args),
    save_niche:          () => handleSaveNiche(args),
    get_saved_niches:    () => handleGetSavedNiches(),
    remove_saved_niche:  () => handleRemoveSavedNiche(args),
    get_top_niches:      () => handleGetTopNiches(args),
    compare_niches:      () => handleCompareNiches(args),
  };

  if (!dispatch[name]) return { error: `Unknown tool: ${name}` };
  return dispatch[name]();
}

// ── SSE helper ────────────────────────────────────────────────
function sendSSE(res, event, data) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${data}\n\n`);
}

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🍎 Apple YTB MCP Server running on port ${PORT}`);
  console.log(`   SSE endpoint : http://localhost:${PORT}/sse`);
  console.log(`   Health check : http://localhost:${PORT}/health`);
  console.log(`   Tools loaded : ${TOOLS.length}\n`);
});
