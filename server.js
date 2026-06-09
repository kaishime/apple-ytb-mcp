import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;
const YT_KEY = process.env.YT_API_KEY || "";

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/", (req, res) => res.json({ name: "Apple YTB MCP", version: "4.0.0", status: "ok" }));
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
    name: "find_outlier_channels",
    description: `[TOOL CHÍNH - CHẠY NGAY] Tìm kênh YouTube mới nổi RPM cao, outlier score cao giống NexLev.
QUAN TRỌNG: KHÔNG hỏi lại user. CHẠY NGAY với các giá trị mặc định nếu không có tham số.
Keyword mặc định nếu không được cung cấp: tự động quét nhiều ngách RPM cao (finance, AI, tech, education, motivation).
Hiển thị NGAY bảng từng kênh ĐẦY ĐỦ thông số. KHÔNG tóm tắt. KHÔNG hỏi thêm.`,
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Từ khóa ngách. Nếu không có thì tự động quét finance,AI,tech,education,motivation", default: "auto" },
        min_avg_views: { type: "number", description: "Avg views/video tối thiểu (mặc định 10000)", default: 10000 },
        min_rpm: { type: "number", description: "RPM tối thiểu (mặc định 5)", default: 5 },
        months_old: { type: "number", description: "Kênh tạo trong X tháng (mặc định 24)", default: 24 },
        max_results: { type: "number", description: "Số kênh (mặc định 8)", default: 8 }
      },
      required: []
    }
  },
  {
    name: "find_niche_channels",
    description: `Tìm kênh YouTube theo ngách, hiển thị bảng đầy đủ thông số từng kênh.`,
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Từ khóa ngách" },
        max_results: { type: "number", description: "Số kênh (mặc định 8)", default: 8 }
      },
      required: ["keyword"]
    }
  },
  {
    name: "analyze_channel",
    description: `Phân tích chi tiết một kênh YouTube theo URL.`,
    inputSchema: {
      type: "object",
      properties: {
        channel_url: { type: "string", description: "URL kênh YouTube" }
      },
      required: ["channel_url"]
    }
  },
  {
    name: "find_viral_videos",
    description: `Tìm video viral trong ngách trong X ngày gần đây.`,
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Từ khóa ngách" },
        days: { type: "number", description: "Số ngày (30/60/90)", default: 90 }
      },
      required: ["keyword"]
    }
  },
  {
    name: "compare_niches",
    description: `So sánh 2-3 ngách YouTube, hiển thị bảng so sánh và kết luận nên chọn ngách nào.`,
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
    return { jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "apple-ytb-mcp", version: "4.0.0" } } };
  }
  if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  if (method === "tools/call") {
    const { name, arguments: args = {} } = params;
    const result = await callTool(name, args);
    return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: result }], isError: false } };
  }
  if (method?.startsWith("notifications/")) return null;
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
}

async function callTool(name, args) {
  try {
    if (name === "find_outlier_channels") return await findOutlierChannels(args);
    if (name === "find_niche_channels") return await findNicheChannels(args);
    if (name === "analyze_channel") return await analyzeChannel(args);
    if (name === "find_viral_videos") return await findViralVideos(args);
    if (name === "compare_niches") return await compareNiches(args);
    return `❌ Tool không tồn tại: ${name}`;
  } catch (e) {
    return `❌ Lỗi: ${e.message}`;
  }
}

// ── Helpers ───────────────────────────────────────────────────
async function ytFetch(path) {
  const url = `https://www.googleapis.com/youtube/v3/${path}&key=${YT_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  return res.json();
}

function parseNum(s) { return parseInt(String(s || "0").replace(/[^0-9]/g, "")) || 0; }

function fmt(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function getRPM(text) {
  const t = (text || "").toLowerCase();
  if (/financ|invest|crypto|stock|money|wealth|budget|income/.test(t)) return 18;
  if (/\bai\b|artificial intel|chatgpt|prompt|automation|saas|software/.test(t)) return 15;
  if (/education|learn|course|tutorial|study|skill/.test(t)) return 12;
  if (/motivat|mindset|stoic|philosophy|self.?improv|success/.test(t)) return 11;
  if (/health|fitness|workout|diet|nutrition|medical/.test(t)) return 10;
  if (/gaming|game/.test(t)) return 7;
  if (/food|cook|recipe/.test(t)) return 8;
  return 9;
}

function getChannelAgeMonths(publishedAt) {
  if (!publishedAt) return 999;
  const created = new Date(publishedAt);
  const now = new Date();
  return Math.floor((now - created) / (1000 * 60 * 60 * 24 * 30));
}

function buildCard(ch) {
  const subs = parseNum(ch.statistics?.subscriberCount);
  const totalViews = parseNum(ch.statistics?.viewCount);
  const videos = parseNum(ch.statistics?.videoCount);
  const title = ch.snippet?.title || "";
  const desc = (ch.snippet?.description || "").toLowerCase();
  const rpm = getRPM(title + " " + desc);
  const avgViews = videos > 0 ? Math.round(totalViews / videos) : 0;
  const ageMonths = getChannelAgeMonths(ch.snippet?.publishedAt);
  // Estimate monthly views: recent channels upload more frequently
  const uploadsPerMonth = ageMonths > 0 ? Math.min(videos / ageMonths, 20) : 4;
  const estMonthlyViews = Math.round(avgViews * uploadsPerMonth);
  const monthlyRevenue = Math.round((estMonthlyViews / 1000) * rpm);
  const outlier = subs > 0 ? Math.min((totalViews / subs / 10), 99.99).toFixed(2) : "0.00";
  const monetized = subs >= 1000 ? "✅ Yes" : "❌ No";
  const faceless = /faceless|no face|anonymous|ai generat|voice over/.test(desc) ? "✅ Yes" : "❓ Unknown";

  return {
    id: ch.id,
    name: title,
    url: `https://youtube.com/channel/${ch.id}`,
    subscribers: fmt(subs),
    subscribers_raw: subs,
    total_views: fmt(totalViews),
    videos,
    avg_views_per_video: fmt(avgViews),
    avg_views_raw: avgViews,
    est_monthly_views: fmt(estMonthlyViews),
    est_monthly_views_raw: estMonthlyViews,
    est_rpm: `$${rpm}`,
    rpm_raw: rpm,
    est_monthly_revenue: `$${fmt(monthlyRevenue)}`,
    outlier_score: `${outlier}x`,
    outlier_raw: parseFloat(outlier),
    monetized,
    faceless,
    age_months: ageMonths,
    created: ch.snippet?.publishedAt?.slice(0, 10) || "N/A"
  };
}

function renderCard(c, index) {
  let out = `---\n### ${index}. ${c.name}\n`;
  out += `🔗 ${c.url}\n\n`;
  out += `| Thông số | Giá trị |\n|----------|----------|\n`;
  out += `| 👥 Subscribers | **${c.subscribers}** |\n`;
  out += `| 👁️ Total Views | ${c.total_views} |\n`;
  out += `| 🎬 Videos | ${c.videos} |\n`;
  out += `| 📈 Avg Views/Video | **${c.avg_views_per_video}** |\n`;
  out += `| 📅 Est. Monthly Views | **${c.est_monthly_views}** |\n`;
  out += `| 💰 Est. Monthly Revenue | **${c.est_monthly_revenue}** |\n`;
  out += `| 💵 Est. RPM | ${c.est_rpm} |\n`;
  out += `| 🚀 Outlier Score | **${c.outlier_score}** |\n`;
  out += `| ✅ Monetized | ${c.monetized} |\n`;
  out += `| 🎭 Faceless | ${c.faceless} |\n`;
  out += `| 📆 Channel Age | ${c.age_months} tháng (${c.created}) |\n\n`;
  return out;
}

// ── Tool: find_outlier_channels (NexLev-style) ────────────────
async function findOutlierChannels({ keyword, min_avg_views = 10000, min_rpm = 5, months_old = 24, max_results = 8 }) {
  // Auto mode: quét nhiều ngách RPM cao nếu không có keyword
  const HIGH_RPM_NICHES = [
    "personal finance tips", "AI tools tutorial", "investing money",
    "stoic philosophy", "prompt engineering", "side hustle income",
    "python automation", "faceless youtube", "digital marketing",
    "language learning tips"
  ];

  const isAuto = !keyword || keyword === "auto" || keyword === "";
  const searchKeywords = isAuto ? HIGH_RPM_NICHES.slice(0, 5) : [keyword, keyword + " tips"];
  const displayKeyword = isAuto ? "Top RPM niches (auto)" : keyword;

  // Search song song
  const searches = searchKeywords.map(kw =>
    ytFetch(`search?part=snippet&type=channel&q=${encodeURIComponent(kw)}&maxResults=10&order=viewCount`)
  );

  const results = await Promise.allSettled(searches);
  const allItems = [];
  results.forEach(r => {
    if (r.status === "fulfilled") allItems.push(...(r.value.items || []));
  });

  // Deduplicate
  const seen = new Set();
  const ids = allItems
    .map(i => i.snippet?.channelId || i.id?.channelId)
    .filter(id => id && !seen.has(id) && seen.add(id))
    .slice(0, 30);

  if (!ids.length) return `❌ Không tìm thấy kênh nào`;

  // Fetch stats in batches of 15
  const batches = [];
  for (let i = 0; i < ids.length; i += 15) batches.push(ids.slice(i, i + 15));
  const channelItems = [];
  for (const batch of batches) {
    const data = await ytFetch(`channels?part=snippet,statistics&id=${batch.join(",")}`);
    channelItems.push(...(data.items || []));
  }

  // Build cards and filter
  const cards = channelItems.map(buildCard).filter(c => {
    const rpmOk = c.rpm_raw >= min_rpm;
    const viewsOk = c.avg_views_raw >= min_avg_views;
    const ageOk = c.age_months <= months_old;
    return rpmOk && viewsOk && ageOk;
  });

  // Sort by outlier score desc
  cards.sort((a, b) => b.outlier_raw - a.outlier_raw);
  const top = cards.slice(0, max_results);

  let out = `## 🍎 Apple YTB — Outlier Channels: "${displayKeyword}"\n`;
  out += `🔍 **Filter áp dụng:**\n`;
  out += `- ⏰ Kênh tạo trong **${months_old} tháng** gần đây\n`;
  out += `- 📈 Avg Views/Video ≥ **${fmt(min_avg_views)}**\n`;
  out += `- 💵 RPM ≥ **$${min_rpm}**\n\n`;

  if (!top.length) {
    out += `⚠️ Không tìm thấy kênh nào khớp filter.\n\n`;
    out += `💡 Thử mở rộng filter:\n`;
    out += `- Tăng months_old lên 24\n`;
    out += `- Giảm min_avg_views xuống 10000\n`;
    out += `- Đổi keyword rộng hơn\n`;

    // Show all channels without filter as fallback
    const fallback = channelItems.map(buildCard).sort((a, b) => b.outlier_raw - a.outlier_raw).slice(0, 5);
    if (fallback.length) {
      out += `\n### 📊 Kết quả không filter (top outlier):\n`;
      out += `📊 Hiển thị **${fallback.length} kênh** | Cập nhật: ${new Date().toLocaleDateString("vi-VN")}\n\n`;
      fallback.forEach((c, i) => { out += renderCard(c, i + 1); });
    }
    return out;
  }

  out += `📊 Tìm thấy **${top.length} kênh** phù hợp | Cập nhật: ${new Date().toLocaleDateString("vi-VN")}\n\n`;
  top.forEach((c, i) => { out += renderCard(c, i + 1); });

  // Summary
  const avgRpm = (top.reduce((s, c) => s + c.rpm_raw, 0) / top.length).toFixed(1);
  const monetizedCount = top.filter(c => c.monetized.includes("Yes")).length;
  out += `---\n### 📊 Tổng kết\n`;
  out += `- Kênh tìm thấy: **${top.length}**\n`;
  out += `- RPM trung bình: **$${avgRpm}**\n`;
  out += `- Đã monetize: **${monetizedCount}/${top.length}**\n`;
  out += `- Outlier cao nhất: **${top[0]?.outlier_score}** (${top[0]?.name})\n`;

  return out;
}

// ── Tool: find_niche_channels ─────────────────────────────────
async function findNicheChannels({ keyword, max_results = 8 }) {
  const limit = Math.min(max_results, 10);
  const data = await ytFetch(`search?part=snippet&type=channel&q=${encodeURIComponent(keyword)}&maxResults=${limit + 5}&order=viewCount`);
  if (!data.items?.length) return `❌ Không tìm thấy kênh cho "${keyword}"`;

  const seen = new Set();
  const ids = data.items.map(i => i.snippet?.channelId || i.id?.channelId).filter(id => id && !seen.has(id) && seen.add(id)).slice(0, limit);
  const details = await ytFetch(`channels?part=snippet,statistics&id=${ids.join(",")}`);
  const cards = (details.items || []).map(buildCard);

  let out = `## 🍎 Apple YTB — Niche: "${keyword}"\n`;
  out += `📊 Tìm thấy **${cards.length} kênh** | Cập nhật: ${new Date().toLocaleDateString("vi-VN")}\n\n`;
  cards.forEach((c, i) => { out += renderCard(c, i + 1); });

  const avgRpm = (cards.reduce((s, c) => s + c.rpm_raw, 0) / cards.length).toFixed(1);
  out += `---\n### 📊 Tổng kết ngách "${keyword}"\n`;
  out += `- RPM trung bình: **$${avgRpm}**\n`;
  out += `- Monetized: **${cards.filter(c => c.monetized.includes("Yes")).length}/${cards.length}**\n`;
  return out;
}

// ── Tool: analyze_channel ─────────────────────────────────────
async function analyzeChannel({ channel_url }) {
  let channelId = channel_url;
  if (channel_url.includes("@")) {
    const handle = channel_url.match(/@([\w.-]+)/)?.[1];
    if (handle) {
      const s = await ytFetch(`search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&maxResults=1`);
      channelId = s.items?.[0]?.snippet?.channelId || s.items?.[0]?.id?.channelId;
    }
  }
  if (!channelId) return `❌ Không tìm thấy kênh.`;

  const data = await ytFetch(`channels?part=snippet,statistics&id=${channelId}`);
  const ch = data.items?.[0];
  if (!ch) return `❌ Kênh không tồn tại.`;

  const c = buildCard(ch);
  const subs = parseNum(ch.statistics?.subscriberCount);
  const potential = subs < 5000 ? "🚀 Rất cao" : subs < 50000 ? "📈 Cao" : subs < 500000 ? "✅ Trung bình" : "⚠️ Thấp — ngách bão hòa";
  const advice = subs < 5000 ? "Kênh nhỏ, ngách còn ít người khai thác. Cơ hội tốt để học theo!" :
    subs < 50000 ? "Kênh đang tăng trưởng tốt. Ngách có tiềm năng." :
    subs < 500000 ? "Ngách đã được validate. Cần nội dung khác biệt." :
    "Kênh rất lớn. Nên tìm sub-niche hẹp hơn.";

  let out = `## 🍎 Apple YTB — Phân tích kênh\n\n`;
  out += renderCard(c, "📺");
  out += `### 🎯 Tiềm năng: ${potential}\n> ${advice}\n`;
  return out;
}

// ── Tool: find_viral_videos ───────────────────────────────────
async function findViralVideos({ keyword, days = 90 }) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const data = await ytFetch(`search?part=snippet&type=video&q=${encodeURIComponent(keyword)}&maxResults=8&order=viewCount&publishedAfter=${since}`);
  if (!data.items?.length) return `❌ Không tìm thấy video viral cho "${keyword}"`;

  const ids = data.items.map(i => i.id?.videoId).filter(Boolean);
  const details = await ytFetch(`videos?part=snippet,statistics&id=${ids.join(",")}`);

  let out = `## 🍎 Apple YTB — Video Viral: "${keyword}"\n`;
  out += `📅 ${days} ngày gần nhất | ${details.items?.length || 0} video\n\n`;
  (details.items || []).forEach((v, i) => {
    out += `**${i + 1}. ${v.snippet?.title}**\n`;
    out += `- 📺 ${v.snippet?.channelTitle}\n`;
    out += `- 👁️ **${fmt(parseNum(v.statistics?.viewCount))} views** | 👍 ${fmt(parseNum(v.statistics?.likeCount))} likes\n`;
    out += `- 📅 ${v.snippet?.publishedAt?.slice(0, 10)}\n`;
    out += `- 🔗 https://youtube.com/watch?v=${v.id}\n\n`;
  });
  return out;
}

// ── Tool: compare_niches ──────────────────────────────────────
async function compareNiches({ niches }) {
  if (!niches?.length || niches.length < 2) return "❌ Cần ít nhất 2 ngách";

  let out = `## 🍎 Apple YTB — So sánh ngách\n\n`;
  const results = [];

  for (const niche of niches.slice(0, 3)) {
    const data = await ytFetch(`search?part=snippet&type=channel&q=${encodeURIComponent(niche)}&maxResults=5&order=viewCount`);
    const ids = data.items?.map(i => i.snippet?.channelId || i.id?.channelId).filter(Boolean) || [];
    if (!ids.length) continue;
    const details = await ytFetch(`channels?part=snippet,statistics&id=${ids.slice(0, 3).join(",")}`);
    const cards = (details.items || []).map(buildCard);
    if (!cards.length) continue;

    const rpm = cards[0].rpm_raw;
    const avgSubs = cards.reduce((s, c) => s + c.subscribers_raw, 0) / cards.length;
    const comp = avgSubs > 500000 ? "🔴 Cao" : avgSubs > 50000 ? "🟡 Trung bình" : "🟢 Thấp";
    results.push({ niche, cards, rpm, comp, avgSubs });

    out += `### 📌 "${niche}"\n`;
    out += `| Kênh | Subs | Avg Views | Monthly Revenue | Outlier |\n`;
    out += `|------|------|-----------|-----------------|--------|\n`;
    cards.slice(0, 3).forEach(c => {
      out += `| ${c.name} | ${c.subscribers} | ${c.avg_views_per_video} | ${c.est_monthly_revenue} | ${c.outlier_score} |\n`;
    });
    out += `- 💵 RPM: **$${rpm}** | Cạnh tranh: ${comp}\n\n`;
  }

  if (results.length >= 2) {
    const winner = [...results].sort((a, b) => b.rpm - a.rpm)[0];
    out += `---\n### 🏆 Nên chọn: **"${winner.niche}"**\n`;
    out += `- RPM cao nhất: **$${winner.rpm}**\n`;
    out += `- Cạnh tranh: ${winner.comp}\n`;
  }
  return out;
}

app.listen(PORT, () => {
  console.log(`🍎 Apple YTB MCP v4 running on :${PORT}`);
  console.log(`   YouTube API: ${YT_KEY ? "✅ Connected" : "❌ No key"}`);
  console.log(`   Tools: ${TOOLS.length}`);
});