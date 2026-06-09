import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;
const YT_KEY = process.env.YT_API_KEY || "";

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/", (req, res) => res.json({ name: "Apple YTB MCP", version: "3.0.0", status: "ok" }));
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

const TOOLS = [
  {
    name: "find_niche_channels",
    description: `Tìm và hiển thị NGAY các kênh YouTube thật trong một ngách. 
QUAN TRỌNG: Luôn hiển thị kết quả dạng bảng với đầy đủ thông số cho TỪNG KÊNH:
- Tên kênh + URL
- Subscribers  
- Total Views
- Videos
- Avg Views/Video
- Est. Monthly Revenue
- Est. RPM
- Outlier Score
- Monetized (Yes/No)
- Faceless (Yes/No)
KHÔNG hỏi lại, KHÔNG giải thích. Hiển thị thẳng bảng kênh.`,
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Từ khóa ngách YouTube (ví dụ: personal finance, AI tools, stoicism)" },
        max_results: { type: "number", description: "Số kênh cần tìm (mặc định 8)", default: 8 }
      },
      required: ["keyword"]
    }
  },
  {
    name: "analyze_channel",
    description: `Phân tích chi tiết một kênh YouTube. Hiển thị NGAY đầy đủ thông số:
- Subscribers, Total Views, Videos
- Est. Monthly Revenue, Est. RPM
- Outlier Score, Monetized, Faceless
- Điểm tiềm năng + lời khuyên
- Top 5 video gần nhất`,
    inputSchema: {
      type: "object",
      properties: {
        channel_url: { type: "string", description: "URL kênh YouTube (https://youtube.com/@name)" }
      },
      required: ["channel_url"]
    }
  },
  {
    name: "find_viral_videos",
    description: `Tìm video viral trong ngách. Hiển thị NGAY bảng video với:
- Title, Channel, Views, Likes, Published date, URL`,
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Từ khóa ngách" },
        days: { type: "number", description: "Số ngày gần đây (30/60/90)", default: 90 }
      },
      required: ["keyword"]
    }
  },
  {
    name: "compare_niches",
    description: `So sánh 2-3 ngách. Hiển thị NGAY bảng so sánh với top kênh của mỗi ngách, RPM, cạnh tranh, kết luận nên chọn ngách nào.`,
    inputSchema: {
      type: "object",
      properties: {
        niches: { type: "array", items: { type: "string" }, description: "2-3 ngách cần so sánh" }
      },
      required: ["niches"]
    }
  }
];

async function handleRPC(msg) {
  if (!msg) return null;
  const { method, params = {}, id } = msg;
  if (method === "initialize") {
    return { jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "apple-ytb-mcp", version: "3.0.0" } } };
  }
  if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  if (method === "tools/call") {
    const { name, arguments: args = {} } = params;
    const result = await callTool(name, args);
    return {
      jsonrpc: "2.0", id,
      result: { content: [{ type: "text", text: result }], isError: false }
    };
  }
  if (method?.startsWith("notifications/")) return null;
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
}

async function callTool(name, args) {
  try {
    if (name === "find_niche_channels") return await findNicheChannels(args);
    if (name === "analyze_channel") return await analyzeChannel(args);
    if (name === "find_viral_videos") return await findViralVideos(args);
    if (name === "compare_niches") return await compareNiches(args);
    return `❌ Tool không tồn tại: ${name}`;
  } catch (e) {
    return `❌ Lỗi: ${e.message}`;
  }
}

// ── YouTube helpers ───────────────────────────────────────────
async function ytFetch(path) {
  const url = `https://www.googleapis.com/youtube/v3/${path}&key=${YT_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube API ${res.status}: ${err.slice(0,100)}`);
  }
  return res.json();
}

function parseNum(s) { return parseInt(String(s || "0").replace(/,/g,"")) || 0; }

function fmt(n) {
  if (n >= 1000000) return (n/1000000).toFixed(2) + "M";
  if (n >= 1000) return (n/1000).toFixed(1) + "K";
  return String(n);
}

function getRPM(text) {
  const t = (text||"").toLowerCase();
  if (/financ|invest|crypto|stock|money|wealth|budget/.test(t)) return 18;
  if (/ai\b|artificial intel|chatgpt|prompt|automation|tech|software/.test(t)) return 15;
  if (/education|learn|course|tutorial|study/.test(t)) return 12;
  if (/health|fitness|workout|diet|nutrition/.test(t)) return 10;
  if (/motivat|mindset|stoic|philosophy|self.?improv/.test(t)) return 11;
  if (/gaming|game/.test(t)) return 7;
  if (/food|cook|recipe/.test(t)) return 8;
  if (/travel|lifestyle/.test(t)) return 8;
  return 9;
}

function buildChannelCard(ch) {
  const subs = parseNum(ch.statistics?.subscriberCount);
  const totalViews = parseNum(ch.statistics?.viewCount);
  const videos = parseNum(ch.statistics?.videoCount);
  const title = ch.snippet?.title || "";
  const desc = (ch.snippet?.description || "").toLowerCase();
  const rpm = getRPM(title + " " + desc);
  const avgViews = videos > 0 ? Math.round(totalViews / videos) : 0;
  const estMonthlyViews = avgViews * Math.min(videos, 4);
  const monthlyRevenue = Math.round((estMonthlyViews / 1000) * rpm);
  const outlier = subs > 0 ? Math.min((totalViews / subs / 10), 9.99).toFixed(2) : "N/A";
  const monetized = subs >= 1000 ? "✅ Yes" : "❌ No";
  const faceless = /faceless|no face|anonymous|ai generat/.test(desc) ? "✅ Yes" : "❓ Unknown";
  const channelUrl = `https://youtube.com/channel/${ch.id}`;

  return {
    name: title,
    url: channelUrl,
    subscribers: fmt(subs),
    total_views: fmt(totalViews),
    videos: videos,
    avg_views_per_video: fmt(avgViews),
    est_monthly_views: fmt(estMonthlyViews),
    est_rpm: `$${rpm}`,
    est_monthly_revenue: `$${fmt(monthlyRevenue)}`,
    outlier_score: `${outlier}x`,
    monetized,
    faceless,
    published: ch.snippet?.publishedAt?.slice(0,10) || "N/A"
  };
}

function formatChannelTable(channels, keyword) {
  if (!channels.length) return `❌ Không tìm thấy kênh nào cho ngách "${keyword}"`;

  let out = `## 🍎 Apple YTB — Niche: "${keyword}"\n`;
  out += `📊 Tìm thấy **${channels.length} kênh** | Cập nhật: ${new Date().toLocaleDateString("vi-VN")}\n\n`;

  channels.forEach((c, i) => {
    out += `---\n`;
    out += `### ${i+1}. ${c.name}\n`;
    out += `🔗 ${c.url}\n\n`;
    out += `| Thông số | Giá trị |\n`;
    out += `|----------|----------|\n`;
    out += `| 👥 Subscribers | **${c.subscribers}** |\n`;
    out += `| 👁️ Total Views | ${c.total_views} |\n`;
    out += `| 🎬 Videos | ${c.videos} |\n`;
    out += `| 📈 Avg Views/Video | **${c.avg_views_per_video}** |\n`;
    out += `| 📅 Est. Monthly Views | ${c.est_monthly_views} |\n`;
    out += `| 💰 Est. Monthly Revenue | **${c.est_monthly_revenue}** |\n`;
    out += `| 💵 Est. RPM | ${c.est_rpm} |\n`;
    out += `| 🚀 Outlier Score | **${c.outlier_score}** |\n`;
    out += `| ✅ Monetized | ${c.monetized} |\n`;
    out += `| 🎭 Faceless | ${c.faceless} |\n`;
    out += `| 📆 Channel Created | ${c.published} |\n\n`;
  });

  const avgRpm = channels.reduce((s,c) => s + parseFloat(c.est_rpm.replace("$","")), 0) / channels.length;
  out += `---\n### 📊 Tổng kết ngách "${keyword}"\n`;
  out += `- **RPM trung bình:** $${avgRpm.toFixed(1)}\n`;
  out += `- **Kênh monetized:** ${channels.filter(c=>c.monetized.includes("Yes")).length}/${channels.length}\n`;
  out += `- **Outlier score cao nhất:** ${channels.sort((a,b)=>parseFloat(b.outlier_score)-parseFloat(a.outlier_score))[0]?.outlier_score}\n`;

  return out;
}

// ── Tool implementations ──────────────────────────────────────
async function findNicheChannels({ keyword, max_results = 8 }) {
  const limit = Math.min(max_results, 10);
  const data = await ytFetch(`search?part=snippet&type=channel&q=${encodeURIComponent(keyword)}&maxResults=${limit+5}&order=viewCount`);
  if (!data.items?.length) return `❌ Không tìm thấy kênh cho ngách "${keyword}"`;

  const ids = [...new Set(data.items.map(i => i.snippet?.channelId || i.id?.channelId).filter(Boolean))].slice(0, limit);
  const details = await ytFetch(`channels?part=snippet,statistics&id=${ids.join(",")}`);
  const channels = (details.items || []).map(buildChannelCard);

  return formatChannelTable(channels, keyword);
}

async function analyzeChannel({ channel_url }) {
  let channelId = channel_url;

  if (channel_url.includes("youtube.com") || channel_url.includes("@")) {
    const handleMatch = channel_url.match(/@([\w.-]+)/);
    if (handleMatch) {
      const s = await ytFetch(`search?part=snippet&type=channel&q=${encodeURIComponent(handleMatch[1])}&maxResults=1`);
      channelId = s.items?.[0]?.snippet?.channelId || s.items?.[0]?.id?.channelId;
    }
  }

  if (!channelId) return `❌ Không tìm thấy kênh. Thử nhập URL đúng định dạng: https://youtube.com/@tenkênh`;

  const data = await ytFetch(`channels?part=snippet,statistics&id=${channelId}`);
  const ch = data.items?.[0];
  if (!ch) return `❌ Kênh không tồn tại.`;

  const c = buildChannelCard(ch);
  const subs = parseNum(ch.statistics?.subscriberCount);

  let potential = subs < 5000 ? "🚀 Rất cao" : subs < 50000 ? "📈 Cao" : subs < 500000 ? "✅ Trung bình" : "⚠️ Thấp";
  let advice = subs < 5000 ? "Kênh nhỏ, ngách còn ít người khai thác. Cơ hội tốt!" :
               subs < 50000 ? "Kênh đang tăng trưởng. Ngách có tiềm năng." :
               subs < 500000 ? "Ngách đã được validate nhưng cạnh tranh." :
               "Kênh lớn. Cần tìm sub-niche hẹp hơn.";

  let out = `## 🍎 Apple YTB — Phân tích kênh\n\n`;
  out += `### ${c.name}\n🔗 ${c.url}\n\n`;
  out += `| Thông số | Giá trị |\n|----------|----------|\n`;
  out += `| 👥 Subscribers | **${c.subscribers}** |\n`;
  out += `| 👁️ Total Views | ${c.total_views} |\n`;
  out += `| 🎬 Videos | ${c.videos} |\n`;
  out += `| 📈 Avg Views/Video | **${c.avg_views_per_video}** |\n`;
  out += `| 💰 Est. Monthly Revenue | **${c.est_monthly_revenue}** |\n`;
  out += `| 💵 Est. RPM | ${c.est_rpm} |\n`;
  out += `| 🚀 Outlier Score | **${c.outlier_score}** |\n`;
  out += `| ✅ Monetized | ${c.monetized} |\n`;
  out += `| 🎭 Faceless | ${c.faceless} |\n`;
  out += `| 📆 Created | ${c.published} |\n\n`;
  out += `### 🎯 Đánh giá tiềm năng: ${potential}\n`;
  out += `> ${advice}\n`;

  return out;
}

async function findViralVideos({ keyword, days = 90 }) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const data = await ytFetch(`search?part=snippet&type=video&q=${encodeURIComponent(keyword)}&maxResults=8&order=viewCount&publishedAfter=${since}`);
  if (!data.items?.length) return `❌ Không tìm thấy video viral cho "${keyword}"`;

  const ids = data.items.map(i => i.id?.videoId).filter(Boolean);
  const details = await ytFetch(`videos?part=snippet,statistics&id=${ids.join(",")}`);

  let out = `## 🍎 Apple YTB — Video Viral: "${keyword}"\n`;
  out += `📅 ${days} ngày gần nhất | ${details.items?.length || 0} video\n\n`;

  (details.items || []).forEach((v, i) => {
    const views = fmt(parseNum(v.statistics?.viewCount));
    const likes = fmt(parseNum(v.statistics?.likeCount));
    out += `**${i+1}. ${v.snippet?.title}**\n`;
    out += `- 📺 Kênh: ${v.snippet?.channelTitle}\n`;
    out += `- 👁️ Views: **${views}** | 👍 Likes: ${likes}\n`;
    out += `- 📅 Đăng: ${v.snippet?.publishedAt?.slice(0,10)}\n`;
    out += `- 🔗 https://youtube.com/watch?v=${v.id}\n\n`;
  });

  return out;
}

async function compareNiches({ niches }) {
  if (!niches?.length || niches.length < 2) return "❌ Cần ít nhất 2 ngách để so sánh";

  let out = `## 🍎 Apple YTB — So sánh ngách\n\n`;
  const results = [];

  for (const niche of niches.slice(0, 3)) {
    const data = await ytFetch(`search?part=snippet&type=channel&q=${encodeURIComponent(niche)}&maxResults=5&order=viewCount`);
    const ids = data.items?.map(i => i.snippet?.channelId || i.id?.channelId).filter(Boolean) || [];
    if (!ids.length) continue;

    const details = await ytFetch(`channels?part=snippet,statistics&id=${ids.slice(0,3).join(",")}`);
    const channels = (details.items || []).map(buildChannelCard);
    if (!channels.length) continue;

    const avgSubs = channels.reduce((s,c) => s + parseNum(c.subscribers.replace(/[KM]/,"")), 0) / channels.length;
    const rpm = parseFloat(channels[0].est_rpm.replace("$",""));
    const comp = avgSubs > 100 ? "🔴 Cao" : avgSubs > 20 ? "🟡 TB" : "🟢 Thấp";

    results.push({ niche, channels, rpm, comp });

    out += `### 📌 Ngách: "${niche}"\n`;
    out += `| Kênh | Subscribers | Avg Views/Video | Monthly Revenue | Outlier |\n`;
    out += `|------|-------------|-----------------|-----------------|--------|\n`;
    channels.slice(0,3).forEach(c => {
      out += `| ${c.name} | ${c.subscribers} | ${c.avg_views_per_video} | ${c.est_monthly_revenue} | ${c.outlier_score} |\n`;
    });
    out += `- 💵 RPM ước tính: **$${rpm}** | Cạnh tranh: ${comp}\n\n`;
  }

  if (results.length >= 2) {
    const winner = results.sort((a,b) => b.rpm - a.rpm)[0];
    out += `---\n### 🏆 Kết luận: Nên chọn ngách **"${winner.niche}"**\n`;
    out += `- RPM cao nhất: $${winner.rpm}\n`;
    out += `- Cạnh tranh: ${winner.comp}\n`;
  }

  return out;
}

app.listen(PORT, () => {
  console.log(`🍎 Apple YTB MCP v3 running on :${PORT}`);
  console.log(`   YouTube API: ${YT_KEY ? "✅ Connected" : "❌ No key"}`);
  console.log(`   Tools: ${TOOLS.length}`);
});