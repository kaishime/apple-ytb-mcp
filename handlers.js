// handlers.js — Tool execution logic
import { NICHES_DB, savedNiches } from "./data.js";

// ── search_niches ──────────────────────────────────────────────
export function handleSearchNiches({ query = "", category = "", status = "", sort_by = "potential", limit = 5 }) {
  let results = [...NICHES_DB];

  if (query) {
    const q = query.toLowerCase();
    results = results.filter(n =>
      n.name.toLowerCase().includes(q) ||
      n.sub.toLowerCase().includes(q) ||
      n.cat.toLowerCase().includes(q)
    );
  }
  if (category) results = results.filter(n => n.cat === category);
  if (status)   results = results.filter(n => n.status === status);

  const sortMap = {
    potential:       (a, b) => b.potential - a.potential,
    rpm:             (a, b) => b.rpm - a.rpm,
    trend:           (a, b) => b.trend - a.trend,
    competition:     (a, b) => a.comp - b.comp,
  };
  results.sort(sortMap[sort_by] || sortMap.potential);
  results = results.slice(0, Math.min(limit, 20));

  if (!results.length) {
    return { found: 0, message: "Không tìm thấy ngách nào phù hợp. Thử thay đổi từ khóa hoặc bỏ bộ lọc.", niches: [] };
  }

  return {
    found: results.length,
    sorted_by: sort_by,
    niches: results.map(formatNiche)
  };
}

// ── get_niche_detail ───────────────────────────────────────────
export function handleGetNicheDetail({ id, name }) {
  let niche = null;
  if (id)   niche = NICHES_DB.find(n => n.id === id);
  if (!niche && name) niche = NICHES_DB.find(n => n.name.toLowerCase().includes(name.toLowerCase()));

  if (!niche) return { error: `Không tìm thấy ngách với id=${id} hoặc name="${name}".` };

  const score = scoreNiche(niche);
  return {
    ...formatNiche(niche),
    full_analysis: {
      overall_score: score,
      recommendation: getRecommendation(niche),
      content_ideas: getContentIdeas(niche),
      monetization_tips: getMonetizationTips(niche),
      risks: getRisks(niche)
    }
  };
}

// ── analyze_channel ────────────────────────────────────────────
export function handleAnalyzeChannel({ channel_url, channel_name, subscriber_count, niche_category }) {
  const name = channel_name || extractChannelName(channel_url) || "Kênh không xác định";
  const subNum = parseSubscribers(subscriber_count);

  // Ước tính RPM dựa trên category
  const categoryRpm = {
    "Finance": 18, "Tech & AI": 15, "Health & Fitness": 10,
    "Education": 12, "Lifestyle": 8, "Gaming": 7,
    "Food": 8, "Motivational": 11
  };
  const baseRpm = categoryRpm[niche_category] || 10;
  const rpm = (baseRpm + (Math.random() * 4 - 2)).toFixed(1);

  // Điểm tiềm năng dựa trên subscribers
  let potential = 70;
  if (subNum < 1000)    potential = 85; // very early = high potential
  else if (subNum < 10000)  potential = 78;
  else if (subNum < 100000) potential = 72;
  else if (subNum < 1000000) potential = 65;
  else potential = 55; // huge channel = less untapped potential

  // Tìm ngách tương tự
  const similarNiches = niche_category
    ? NICHES_DB.filter(n => n.cat === niche_category).slice(0, 3)
    : NICHES_DB.sort((a, b) => b.potential - a.potential).slice(0, 3);

  return {
    channel: {
      name,
      url: channel_url || null,
      subscribers: subscriber_count || "Không xác định",
      category: niche_category || "Chưa phân loại"
    },
    analysis: {
      estimated_rpm: `$${rpm}`,
      potential_score: potential,
      competition_level: potential > 80 ? "Thấp 🟢" : potential > 65 ? "Trung bình 🟡" : "Cao 🔴",
      growth_outlook: potential > 80 ? "Rất tích cực 🚀" : potential > 65 ? "Ổn định 📈" : "Cần điều chỉnh chiến lược ⚠️"
    },
    recommendation: getChannelRecommendation(name, potential, niche_category),
    similar_niches: similarNiches.map(formatNiche),
    action_plan: getActionPlan(potential, niche_category)
  };
}

// ── save_niche ─────────────────────────────────────────────────
export function handleSaveNiche({ niche_id, note = "" }) {
  const niche = NICHES_DB.find(n => n.id === niche_id);
  if (!niche) return { error: `Không tìm thấy ngách ID ${niche_id}` };

  if (savedNiches.has(niche_id)) {
    return { success: false, message: `Ngách "${niche.name}" đã có trong danh sách lưu.` };
  }

  savedNiches.set(niche_id, { ...niche, note, savedAt: new Date().toISOString() });
  return {
    success: true,
    message: `✅ Đã lưu ngách "${niche.name}" thành công!`,
    saved_count: savedNiches.size,
    niche: formatNiche(niche)
  };
}

// ── get_saved_niches ───────────────────────────────────────────
export function handleGetSavedNiches() {
  if (savedNiches.size === 0) {
    return { count: 0, message: "Chưa có ngách nào được lưu. Dùng tool save_niche để lưu.", niches: [] };
  }
  const list = [...savedNiches.values()];
  return {
    count: list.length,
    niches: list.map(n => ({ ...formatNiche(n), note: n.note, savedAt: n.savedAt }))
  };
}

// ── remove_saved_niche ─────────────────────────────────────────
export function handleRemoveSavedNiche({ niche_id }) {
  if (!savedNiches.has(niche_id)) {
    return { success: false, message: `Ngách ID ${niche_id} không có trong danh sách lưu.` };
  }
  const name = savedNiches.get(niche_id).name;
  savedNiches.delete(niche_id);
  return { success: true, message: `🗑️ Đã xóa "${name}" khỏi danh sách. Còn ${savedNiches.size} ngách.` };
}

// ── get_top_niches ─────────────────────────────────────────────
export function handleGetTopNiches({ metric = "potential", count = 5 }) {
  const sortMap = {
    potential:        (a, b) => b.potential - a.potential,
    rpm:              (a, b) => b.rpm - a.rpm,
    trend:            (a, b) => b.trend - a.trend,
    low_competition:  (a, b) => a.comp - b.comp,
  };
  const metricLabels = {
    potential: "Tiềm năng cao nhất",
    rpm: "RPM cao nhất",
    trend: "Xu hướng tăng mạnh nhất",
    low_competition: "Ít cạnh tranh nhất"
  };

  const top = [...NICHES_DB]
    .sort(sortMap[metric] || sortMap.potential)
    .slice(0, Math.min(count, 20));

  return {
    metric: metricLabels[metric] || metric,
    count: top.length,
    niches: top.map((n, i) => ({ rank: i + 1, ...formatNiche(n) }))
  };
}

// ── compare_niches ─────────────────────────────────────────────
export function handleCompareNiches({ niche_ids = [], niche_names = [] }) {
  let niches = [];

  if (niche_ids.length) {
    niches = niche_ids.map(id => NICHES_DB.find(n => n.id === id)).filter(Boolean);
  } else if (niche_names.length) {
    niches = niche_names.map(name =>
      NICHES_DB.find(n => n.name.toLowerCase().includes(name.toLowerCase()))
    ).filter(Boolean);
  }

  if (niches.length < 2) {
    return { error: "Cần ít nhất 2 ngách hợp lệ để so sánh." };
  }

  const winner = niches.reduce((best, n) => scoreNiche(n) > scoreNiche(best) ? n : best);

  return {
    compared: niches.length,
    winner: { name: winner.name, reason: `RPM $${winner.rpm}, Tiềm năng ${winner.potential}/100, Cạnh tranh ${winner.comp}/100` },
    comparison: niches.map(n => ({
      ...formatNiche(n),
      overall_score: scoreNiche(n),
      verdict: n.id === winner.id ? "🏆 Tốt nhất" : scoreNiche(n) > 70 ? "✅ Tốt" : "⚠️ Cân nhắc"
    })),
    summary: generateComparisonSummary(niches, winner)
  };
}

// ── HELPERS ────────────────────────────────────────────────────
function formatNiche(n) {
  const statusLabel = { hot:"🔥 Hot", grow:"📈 Đang tăng trưởng", new:"✨ Mới & tiềm năng", sat:"😐 Đang bão hòa" };
  return {
    id: n.id,
    name: n.name,
    description: n.sub,
    category: n.cat,
    rpm: `$${n.rpm}`,
    competition: `${n.comp}/100`,
    potential: `${n.potential}/100`,
    trend: n.trend > 0 ? `+${n.trend}%` : `${n.trend}%`,
    status: statusLabel[n.status] || n.status,
    monthly_views: n.views,
    typical_subs: n.subs
  };
}

function scoreNiche(n) {
  return Math.round((n.potential * 0.4) + (n.rpm * 1.5) + ((100 - n.comp) * 0.3) + (Math.min(n.trend, 80) * 0.2));
}

function getRecommendation(n) {
  if (n.potential >= 90) return `Ngách "${n.name}" cực kỳ tiềm năng! RPM $${n.rpm} cao, cạnh tranh ${n.comp}/100 thấp. Đây là thời điểm vàng để bắt đầu trước khi bão hòa.`;
  if (n.potential >= 75) return `Ngách "${n.name}" tốt và đang tăng trưởng ổn định. Tập trung vào chất lượng nội dung để nổi bật.`;
  if (n.potential >= 60) return `Ngách "${n.name}" đang cạnh tranh. Cần niche down (chọn sub-niche hẹp hơn) để tìm lợi thế.`;
  return `Ngách "${n.name}" đã bão hòa. Cân nhắc pivot sang ngách liên quan ít cạnh tranh hơn.`;
}

function getContentIdeas(n) {
  const ideas = {
    "Finance":        ["Top 10 cách tiết kiệm tiền mỗi tháng","Đầu tư $100 đầu tiên như thế nào","Sai lầm tài chính người trẻ hay mắc","Budget 1 tuần với X triệu đồng"],
    "Tech & AI":      ["Tôi đã dùng AI để làm X trong 30 ngày","5 AI tools miễn phí thay thế phần mềm đắt tiền","Tự động hóa công việc hàng ngày với Python","Hướng dẫn ChatGPT từ A–Z"],
    "Health & Fitness":["Workout 15 phút tại nhà không thiết bị","Chế độ ăn giảm cân đơn giản cho người bận rộn","Thử thách 30 ngày tập thể dục","Sự thật về supplement phổ biến"],
    "Education":      ["Học X trong 30 ngày — kết quả thực tế","Phương pháp học nhanh gấp 3 lần","Tài liệu học miễn phí tốt nhất","Bí quyết ghi nhớ không cần học vẹt"],
    "Lifestyle":      ["Thử sống tối giản 1 tháng","Routine buổi sáng thay đổi cuộc đời tôi","Declutter 100 đồ vật trong nhà","Work-life balance thực sự là gì"],
    "Gaming":         ["Tôi đã làm game indie trong X ngày","Devlog: từ ý tưởng đến launch","Top công cụ làm game miễn phí","Behind-the-scenes làm game solo"],
    "Food":           ["Meal prep cả tuần chỉ 2 tiếng","5 món ăn dưới 50k/người","Thử recipe viral TikTok — có ngon không?","Nấu ăn lành mạnh cho người bận"],
    "Motivational":   ["Tôi đã thay đổi thói quen xấu như thế nào","Atomic Habits — áp dụng thực tế","5 bài học từ người thành công","Câu chuyện vượt qua thất bại của tôi"]
  };
  return ideas[n.cat] || ["Hướng dẫn cơ bản cho người mới","Case study thực tế","Review & so sánh","Q&A giải đáp thắc mắc phổ biến"];
}

function getMonetizationTips(n) {
  const tips = [];
  if (n.rpm >= 15) tips.push(`RPM $${n.rpm} rất cao — tập trung AdSense, đảm bảo watch time dài`);
  if (n.rpm >= 10) tips.push("Sponsorship với brand trong ngành sẽ trả tốt");
  tips.push("Tạo digital product (course, ebook, template) liên quan");
  tips.push("Affiliate marketing với sản phẩm phù hợp ngách");
  if (n.cat === "Finance") tips.push("Hợp tác với fintech, ngân hàng, ứng dụng đầu tư");
  if (n.cat === "Tech & AI") tips.push("SaaS affiliate commission thường 20–40%");
  return tips;
}

function getRisks(n) {
  const risks = [];
  if (n.comp > 60) risks.push(`Cạnh tranh cao (${n.comp}/100) — cần USP rõ ràng để nổi bật`);
  if (n.trend < 0) risks.push("Xu hướng đang giảm — cần đổi mới nội dung liên tục");
  if (n.status === "sat") risks.push("Ngách đang bão hòa — khó tăng trưởng nhanh");
  if (n.rpm < 8) risks.push(`RPM thấp ($${n.rpm}) — cần volume views lớn để thu nhập tốt`);
  if (!risks.length) risks.push("Rủi ro thấp — đây là ngách lành mạnh để đầu tư");
  return risks;
}

function getActionPlan(potential, category) {
  const plan = ["📝 Nghiên cứu 10 kênh đối thủ trong ngách", "🎯 Chọn sub-niche cụ thể hơn để ít cạnh tranh"];
  if (potential > 75) {
    plan.push("🚀 Bắt đầu upload ngay — ngách còn nhiều cơ hội");
    plan.push("📅 Lên lịch 2–3 video/tuần trong 3 tháng đầu");
  } else {
    plan.push("⚙️ Tối ưu SEO title và thumbnail trước khi upload");
    plan.push("🔄 Thử nhiều format: Long-form, Shorts, Live");
  }
  plan.push("📊 Track analytics mỗi tuần và điều chỉnh chiến lược");
  return plan;
}

function getChannelRecommendation(name, potential, category) {
  if (potential > 80) return `Kênh "${name}" có vị trí tốt trong ngách còn nhiều tiềm năng. Tập trung tăng tần suất upload.`;
  if (potential > 65) return `Kênh "${name}" đang ổn định. Đề xuất thêm Shorts và tối ưu thumbnail để tăng CTR.`;
  return `Kênh "${name}" cần xem xét lại chiến lược. Thử pivot sang sub-niche ${category || "liên quan"} ít cạnh tranh hơn.`;
}

function generateComparisonSummary(niches, winner) {
  const sorted = [...niches].sort((a, b) => scoreNiche(b) - scoreNiche(a));
  return `Sau khi so sánh ${niches.length} ngách: "${winner.name}" là lựa chọn tốt nhất với điểm tổng ${scoreNiche(winner)}. ` +
    `Xếp hạng: ${sorted.map((n, i) => `${i+1}. ${n.name}`).join(", ")}.`;
}

function extractChannelName(url) {
  if (!url) return null;
  const match = url.match(/@([^/]+)/);
  return match ? match[1] : null;
}

function parseSubscribers(str) {
  if (!str) return 0;
  const s = str.toUpperCase().replace(",", ".");
  if (s.includes("M")) return parseFloat(s) * 1000000;
  if (s.includes("K")) return parseFloat(s) * 1000;
  return parseInt(s) || 0;
}
