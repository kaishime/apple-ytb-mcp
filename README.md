# 🍎 Apple YTB — MCP Server

YouTube Niche Finder MCP Server — kết nối với ChatGPT và Claude.

## 🚀 Deploy lên Render.com (Miễn phí)

### Bước 1: Đẩy code lên GitHub
```bash
git init
git add .
git commit -m "Apple YTB MCP Server"
git remote add origin https://github.com/YOUR_USERNAME/apple-ytb-mcp.git
git push -u origin main
```

### Bước 2: Deploy trên Render
1. Vào https://render.com → **New** → **Web Service**
2. Connect GitHub repo vừa tạo
3. Cấu hình:
   - **Name**: `apple-ytb-mcp`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Nhấn **Create Web Service**
5. Đợi ~2 phút → lấy URL dạng: `https://apple-ytb-mcp.onrender.com`

### Bước 3: Kết nối vào ChatGPT
1. Vào ChatGPT → **Khám phá GPTs** → **Tạo GPT**
2. Tab **Configure** → **Actions** → **Create new action**
3. Hoặc vào **Cài đặt** → **Kết nối ứng dụng**:
   - **Tên**: Apple YTB
   - **URL máy chủ MCP**: `https://apple-ytb-mcp.onrender.com/sse`
   - **Xác thực**: None (hoặc API Key nếu muốn bảo mật)

### Bước 4: Kết nối vào Claude (claude.ai)
1. Vào https://claude.ai → Settings → **Integrations**
2. Thêm MCP server:
   - **URL**: `https://apple-ytb-mcp.onrender.com/sse`

---

## 🛠️ Chạy local (Test)

```bash
npm install
npm start
# Server chạy tại http://localhost:3000
```

Dùng ngrok để expose ra ngoài:
```bash
npx ngrok http 3000
# Lấy URL ngrok → dán vào ChatGPT/Claude
```

---

## 🔧 8 Tools có sẵn

| Tool | Mô tả |
|------|-------|
| `search_niches` | Tìm & lọc ngách YouTube |
| `get_niche_detail` | Chi tiết + phân tích đầy đủ 1 ngách |
| `analyze_channel` | Phân tích kênh YouTube bất kỳ |
| `save_niche` | Lưu ngách yêu thích |
| `get_saved_niches` | Xem danh sách đã lưu |
| `remove_saved_niche` | Xóa ngách khỏi danh sách |
| `get_top_niches` | Top ngách theo RPM/tiềm năng/xu hướng |
| `compare_niches` | So sánh 2–4 ngách với nhau |

---

## 💬 Ví dụ câu hỏi cho AI

Sau khi kết nối, bạn có thể hỏi ChatGPT/Claude:

- *"Tìm ngách YouTube ít cạnh tranh nhất cho tôi"*
- *"Top 5 ngách có RPM cao nhất"*
- *"So sánh ngách Finance vs Tech & AI"*
- *"Phân tích kênh @mkbhd có tiềm năng không"*
- *"Ngách nào đang hot nhất 2026?"*
- *"Lưu ngách Prompt Engineering cho tôi"*

---

## 📁 Cấu trúc file

```
apple-ytb-mcp/
├── server.js       # MCP server chính (SSE endpoint)
├── tools.js        # Định nghĩa 8 tools
├── handlers.js     # Logic xử lý từng tool
├── data.js         # Database 20 ngách
├── render.yaml     # Config deploy Render
├── vercel.json     # Config deploy Vercel
└── package.json
```
