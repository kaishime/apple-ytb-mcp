import express from "express";
import cors from "cors";
import { TOOLS } from "./tools.js";
import {
  handleSearchNiches, handleGetNicheDetail, handleAnalyzeChannel,
  handleSaveNiche, handleGetSavedNiches, handleRemoveSavedNiche,
  handleGetTopNiches, handleCompareNiches
} from "./handlers.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/", (req, res) => res.json({ name: "Apple YTB MCP", version: "1.0.0", status: "ok" }));
app.get("/health", (req, res) => res.json({ ok: true }));

app.options("/mcp", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.status(204).end();
});

app.get("/mcp", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();
  const ping = setInterval(() => {
    if (res.writableEnded) { clearInterval(ping); return; }
    res.write(": ping\n\n");
  }, 20000);
  req.on("close", () => clearInterval(ping));
});

app.post("/mcp", async (req, res) => {
  const msg = req.body;
  const wantsSSE = req.headers.accept?.includes("text/event-stream");
  try {
    const result = await handleRPC(msg);
    if (wantsSSE) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (result) res.write(`data: ${JSON.stringify(result)}\n\n`);
      res.end();
    } else {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (result) res.json(result);
      else res.status(204).end();
    }
  } catch (err) {
    res.status(200).json({
      jsonrpc: "2.0",
      id: msg?.id ?? null,
      error: { code: -32603, message: String(err.message) }
    });
  }
});

async function handleRPC(msg) {
  if (!msg) return null;
  const { method, params = {}, id } = msg;

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
  if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }
  if (method === "tools/call") {
    const { name, arguments: args = {} } = params;
    const result = callTool(name, args);
    return {
      jsonrpc: "2.0", id,
      result: {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !!result?.error
      }
    };
  }
  if (method?.startsWith("notifications/")) return null;
  return {
    jsonrpc: "2.0", id,
    error: { code: -32601, message: `Method not found: ${method}` }
  };
}

function callTool(name, args) {
  const map = {
    search_niches:      () => handleSearchNiches(args),
    get_niche_detail:   () => handleGetNicheDetail(args),
    analyze_channel:    () => handleAnalyzeChannel(args),
    save_niche:         () => handleSaveNiche(args),
    get_saved_niches:   () => handleGetSavedNiches(),
    remove_saved_niche: () => handleRemoveSavedNiche(args),
    get_top_niches:     () => handleGetTopNiches(args),
    compare_niches:     () => handleCompareNiches(args),
  };
  return map[name] ? map[name]() : { error: `Unknown tool: ${name}` };
}

app.listen(PORT, () => {
  console.log(`Apple YTB MCP running on :${PORT}`);
  console.log(`POST/GET /mcp ready`);
  console.log(`Tools: ${TOOLS.length}`);
});