import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;
const YT_KEY = process.env.YT_API_KEY || "";

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/", (req, res) => res.json({ name: "Apple YTB MCP", version: "2.0.0", status: "ok" }));
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
    res.status(200).json({ jsonrpc: "2.0", id: msg?.id ?? null, error: { code: -32603, message: String(err.message) } });
  }
});

// ── TOOLS definition ──────────────────────────────────────────
const TOOLS = [
  {
    name: "search_youtube_niches",
    description: "Tìm kiếm kênh YouTube thật theo từ khóa ngách. Trả về danh sách kênh với subscriber, view, revenue ước tính, RPM, outlier score.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Từ khóa ngách cần tìm (tiếng Anh hoặc tiếng Việt)" },
        max_results: { type: "number", description: "Số kênh trả về (mặc định 5, tối đa 10)", default: 5 }
      },
      required: ["keyword"]
    }
  },
  {
    name: "analyze_channel",
    description: "Phân tích chi tiết một kênh YouTube theo URL hoặc channel ID. Trả về sub, view, video count, revenue ước tính, RPM, điểm tiềm năng.",
    inputSchema: {
      type: "object",
      properties: {
        channel_input: { type: "string", description: "URL kênh (https://youtube.com/@name) hoặc channel ID" }
      },
      required: ["channel_input"]
    }
  },
  {
    name: "get_top_niches",
    description: "Lấy danh sách top ngách YouTube tiềm năng nhất hiện tại dựa trên dữ liệu thật.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Danh mục: finance, tech, health, education, lifestyle, gaming, food, motivation", default: "" },
        count: { type: "number", description: "Số ngách cần lấy (mặc định 5)", default: 5 }
      },
      required: []
    }
  },
  {
    name: "search_viral_videos",
    description: "Tìm video viral trong một ngách cụ thể. Trả về title, view, like, channel info.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Từ khóa ngách cần tìm video viral" },
        max_results: { type: "number", description: "Số video trả về (mặc định 5)", default: 5 }
      },
      required: ["keyword"]
    }
  },
  {
    name: "compare_niches",
    description: "So sánh 2-3 ngách YouTube với nhau về tiềm năng, RPM, cạnh tranh.",
    inputSchema: {
      type: "object",
      properties: {
        niches: { type: "array", items: { type: "string" }, description: "Danh sách 2-3 từ khóa ngách cần so sánh" }
      },
      required: ["niches"]
    }
  }
];

// ── JSON-RPC handler ──────────────────────────────────────────
async function handleRPC(msg) {
  if (!msg) return null;
  const { method, params = {}, id } = msg;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "apple-ytb-mcp", version: "2.0.0" }
      }
    };
  }
  if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  if (method === "tools/call") {
    const { name, arguments: args = {} } = params;
    const result = await callTool(name, args);
    return {
      jsonrpc: "2.0", id,
      result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: !!result?.error }
    };
  }
  if (method?.startsWith("notifications/")) return null;
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
}

// ── Tool executor ─────────────────────────────────────────────
async function callTool(name, args) {
  try {
    if (name === "search_youtube_niches") return await searchNiches(args);
    if (name === "analyze_channel") return await analyzeChannel(args);
    if (name === "get_top_niches") return await getTopNiches(args);
    if (name === "search_viral_videos") return await searchViralVideos(args);
    if (name === "compare_niches") return await compareNiches(args);
    return { error: `Unknown tool: ${name}` };
  } catch (e) {
    return { error: e.message };
  }
}

// ── YouTube API helpers ───────────────────────────────────────
async function ytFetch(path) {
  const url = `https://www.googleapis.com/youtube/v3/${path}&key=${YT_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
  return res.json();
}

function estimateRPM(category) {
  const rpmMap = {
    finance: 18, investing: 20, crypto: 16, tech: 14, ai: 17,
    education: 11, health: 10, fitness: 9, lifestyle: 8,
    gaming: 7, food: 8, cooking: 8, motivation: 11,
    travel: 7, beauty: 6, default: 9
  };
  const key = Object.keys(rpmMap).find(k => category?.toLowerCase().includes(k));
  return rpmMap[key] || rpmMap.default;
}

function parseCount(str) {
  if (!str) return 0;
  str = String(str).replace(/,/g, "");
  return parseInt(str) || 0;
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function calcOutlierScore(views, subs) {
  if (!subs || subs === 0) return 1.0;
  const ratio = views / subs;
  return Math.min(parseFloat((ratio / 10).toFixed(2)), 9.99);
}

function calcMonthlyRevenue(monthlyViews, rpm) {
  return Math.round((monthlyViews / 1000) * rpm);
}

function enrichChannel(ch) {
  const subs = parseCount(ch.statistics?.subscriberCount);
  const totalViews = parseCount(ch.statistics?.videoCount > 0
    ? ch.statistics?.viewCount : ch.statistics?.viewCount);
  const videoCount = parseCount(ch.statistics?.videoCount);
  const desc = (ch.snippet?.description || "").toLowerCase();
  const title = (ch.snippet?.title || "").toLowerCase();
  const rpm = estimateRPM(desc + " " + title);
  const avgViewsPerVideo = videoCount > 0 ? Math.round(totalViews / videoCount) : 0;
  const estMonthlyViews = avgViewsPerVideo * Math.min(videoCount, 4);
  const monthlyRevenue = calcMonthlyRevenue(estMonthlyViews, rpm);
  const outlierScore = calcOutlierScore(totalViews, subs);

  return {
    channel_id: ch.id,
    name: ch.snippet?.title,
    description: ch.snippet?.description?.slice(0, 120) + "...",
    url: `https://youtube.com/channel/${ch.id}`,
    subscribers: formatNum(subs),
    total_views: formatNum(parseCount(ch.statistics?.viewCount)),
    video_count: videoCount,
    avg_views_per_video: formatNum(avgViewsPerVideo),
    estimated_monthly_views: formatNum(estMonthlyViews),
    estimated_rpm: `$${rpm}`,
    estimated_monthly_revenue: `$${formatNum(monthlyRevenue)}`,
    outlier_score: `${outlierScore}x`,
    monetized: subs >= 1000 ? "✅ Likely monetized" : "⏳ Not yet monetized",
    faceless: desc.includes("no face") || desc.includes("faceless") || desc.includes("anonymous") ? "✅ Faceless" : "❓ Unknown",
    published_at: ch.snippet?.publishedAt?.slice(0, 10)
  };
}

// ── Tool implementations ──────────────────────────────────────
async function searchNiches({ keyword, max_results = 5 }) {
  const limit = Math.min(max_results, 10);
  const data = await ytFetch(`search?part=snippet&type=channel&q=${encodeURIComponent(keyword)}&maxResults=${limit * 2}&order=viewCount`);

  if (!data.items?.length) return { found: 0, keyword, channels: [] };

  const ids = data.items.map(i => i.snippet?.channelId || i.id?.channelId).filter(Boolean).slice(0, limit);
  const details = await ytFetch(`channels?part=snippet,statistics&id=${ids.join(",")}`);

  const channels = (details.items || []).map(enrichChannel);

  return {
    keyword,
    found: channels.length,
    summary: `Tìm thấy ${channels.length} kênh trong ngách "${keyword}"`,
    channels
  };
}

async function analyzeChannel({ channel_input }) {
  let channelId = channel_input;

  // Nếu là URL → extract handle hoặc ID
  if (channel_input.includes("youtube.com")) {
    const handleMatch = channel_input.match(/@([\w-]+)/);
    if (handleMatch) {
      const search = await ytFetch(`search?part=snippet&type=channel&q=${encodeURIComponent(handleMatch[1])}&maxResults=1`);
      channelId = search.items?.[0]?.snippet?.channelId || search.items?.[0]?.id?.channelId;
    }
  }

  if (!channelId) return { error: "Không tìm thấy kênh. Thử nhập tên kênh thay vì URL." };

  const data = await ytFetch(`channels?part=snippet,statistics,brandingSettings&id=${channelId}`);
  const ch = data.items?.[0];
  if (!ch) return { error: "Kênh không tồn tại hoặc không tìm thấy." };

  const enriched = enrichChannel(ch);
  const subs = parseCount(ch.statistics?.subscriberCount);
  const rpm = estimateRPM(ch.snippet?.description + ch.snippet?.title);

  // Đánh giá tiềm năng
  let potential, advice;
  if (subs < 5000) { potential = "🚀 Rất cao — kênh nhỏ, còn nhiều tiềm năng"; advice = "Kênh đang ở giai đoạn đầu. Nếu nội dung tốt, đây là thời điểm tốt nhất để học theo!"; }
  else if (subs < 50000) { potential = "📈 Cao — đang tăng trưởng tốt"; advice = "Kênh đang trong giai đoạn tăng trưởng. Ngách này còn nhiều cơ hội."; }
  else if (subs < 500000) { potential = "✅ Trung bình — ngách đã được validate"; advice = "Ngách đã được chứng minh. Cần nội dung differentiated để cạnh tranh."; }
  else { potential = "⚠️ Thấp — ngách bão hòa"; advice = "Kênh lớn. Ngách cạnh tranh cao, cần tìm sub-niche hẹp hơn."; }

  return {
    ...enriched,
    potential,
    advice,
    content_ideas: [
      `Top 10 ${ch.snippet?.title} tips for beginners`,
      `I tried ${ch.snippet?.title} for 30 days — results`,
      `The truth about ${ch.snippet?.title} nobody tells you`,
      `How to start ${ch.snippet?.title} with $0`
    ]
  };
}

async function getTopNiches({ category = "", count = 5 }) {
  const queries = category
    ? [category]
    : ["personal finance tips", "ai tools tutorial", "stoic philosophy", "faceless youtube", "prompt engineering"];

  const results = [];
  for (const q of queries.slice(0, count)) {
    try {
      const data = await ytFetch(`search?part=snippet&type=channel&q=${encodeURIComponent(q)}&maxResults=3&order=viewCount`);
      const ids = data.items?.map(i => i.snippet?.channelId || i.id?.channelId).filter(Boolean) || [];
      if (ids.length) {
        const details = await ytFetch(`channels?part=snippet,statistics&id=${ids[0]}`);
        const ch = details.items?.[0];
        if (ch) {
          const enriched = enrichChannel(ch);
          results.push({ niche: q, top_channel: enriched });
        }
      }
    } catch (e) { /* skip failed */ }
  }

  return {
    count: results.length,
    category: category || "Tất cả",
    niches: results
  };
}

async function searchViralVideos({ keyword, max_results = 5 }) {
  const data = await ytFetch(`search?part=snippet&type=video&q=${encodeURIComponent(keyword)}&maxResults=${max_results}&order=viewCount&publishedAfter=${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()}`);

  if (!data.items?.length) return { found: 0, videos: [] };

  const ids = data.items.map(i => i.id?.videoId).filter(Boolean);
  const details = await ytFetch(`videos?part=snippet,statistics&id=${ids.join(",")}`);

  const videos = (details.items || []).map(v => ({
    title: v.snippet?.title,
    channel: v.snippet?.channelTitle,
    views: formatNum(parseCount(v.statistics?.viewCount)),
    likes: formatNum(parseCount(v.statistics?.likeCount)),
    published: v.snippet?.publishedAt?.slice(0, 10),
    url: `https://youtube.com/watch?v=${v.id}`,
    thumbnail: v.snippet?.thumbnails?.medium?.url
  }));

  return {
    keyword,
    found: videos.length,
    period: "90 ngày gần nhất",
    videos
  };
}

async function compareNiches({ niches }) {
  if (!niches?.length || niches.length < 2) return { error: "Cần ít nhất 2 ngách để so sánh" };

  const results = [];
  for (const niche of niches.slice(0, 3)) {
    try {
      const data = await ytFetch(`search?part=snippet&type=channel&q=${encodeURIComponent(niche)}&maxResults=5&order=viewCount`);
      const ids = data.items?.map(i => i.snippet?.channelId || i.id?.channelId).filter(Boolean) || [];
      if (ids.length) {
        const details = await ytFetch(`channels?part=snippet,statistics&id=${ids.slice(0, 3).join(",")}`);
        const channels = (details.items || []).map(enrichChannel);
        const avgRpm = parseFloat(channels[0]?.estimated_rpm?.replace("$", "") || "9");
        const avgSubs = channels.reduce((s, c) => s + parseCount(c.subscribers), 0) / channels.length;
        results.push({
          niche,
          sample_channels: channels.length,
          avg_rpm: `$${avgRpm}`,
          competition: avgSubs > 100000 ? "🔴 Cao" : avgSubs > 20000 ? "🟡 Trung bình" : "🟢 Thấp",
          recommendation: avgSubs < 20000 ? "✅ Nên làm" : avgSubs < 100000 ? "⚡ Cân nhắc" : "⚠️ Khó cạnh tranh",
          top_channel: channels[0]
        });
      }
    } catch (e) { /* skip */ }
  }

  const winner = results.sort((a, b) => {
    const aRpm = parseFloat(a.avg_rpm.replace("$", ""));
    const bRpm = parseFloat(b.avg_rpm.replace("$", ""));
    return bRpm - aRpm;
  })[0];

  return {
    compared: results.length,
    winner: winner?.niche,
    reason: `RPM cao nhất ($${winner?.avg_rpm}), cạnh tranh ${winner?.competition}`,
    details: results
  };
}

app.listen(PORT, () => {
  console.log(`🍎 Apple YTB MCP v2 running on :${PORT}`);
  console.log(`   YouTube API: ${YT_KEY ? "✅ Connected" : "❌ No key"}`);
  console.log(`   Tools: ${TOOLS.length}`);
});