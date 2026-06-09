// tools.js — MCP tool definitions
export const TOOLS = [
  {
    name: "search_niches",
    description: "Tìm kiếm và lọc ngách YouTube tiềm năng. Có thể lọc theo danh mục, trạng thái, sắp xếp theo RPM/tiềm năng/xu hướng/cạnh tranh.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Từ khóa tìm kiếm ngách (tên, danh mục, mô tả)"
        },
        category: {
          type: "string",
          description: "Lọc theo danh mục",
          enum: ["Finance","Tech & AI","Health & Fitness","Education","Lifestyle","Gaming","Food","Motivational",""]
        },
        status: {
          type: "string",
          description: "Lọc theo trạng thái ngách",
          enum: ["hot","grow","new","sat",""]
        },
        sort_by: {
          type: "string",
          description: "Sắp xếp kết quả theo tiêu chí",
          enum: ["potential","rpm","trend","competition"],
          default: "potential"
        },
        limit: {
          type: "number",
          description: "Số lượng kết quả trả về (mặc định 5, tối đa 20)",
          default: 5
        }
      },
      required: []
    }
  },
  {
    name: "get_niche_detail",
    description: "Lấy thông tin chi tiết đầy đủ của một ngách YouTube theo ID hoặc tên.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "ID của ngách (1–20)"
        },
        name: {
          type: "string",
          description: "Tên ngách để tìm kiếm chính xác"
        }
      },
      required: []
    }
  },
  {
    name: "analyze_channel",
    description: "Phân tích một kênh YouTube dựa trên URL hoặc tên kênh. Trả về ước tính RPM, điểm tiềm năng, mức cạnh tranh và lời khuyên chiến lược.",
    inputSchema: {
      type: "object",
      properties: {
        channel_url: {
          type: "string",
          description: "URL kênh YouTube (ví dụ: https://youtube.com/@channelname)"
        },
        channel_name: {
          type: "string",
          description: "Tên kênh YouTube"
        },
        subscriber_count: {
          type: "string",
          description: "Số subscriber hiện tại (ví dụ: '50K', '1.2M')"
        },
        niche_category: {
          type: "string",
          description: "Danh mục ngách của kênh"
        }
      },
      required: []
    }
  },
  {
    name: "save_niche",
    description: "Lưu một ngách YouTube vào danh sách yêu thích để theo dõi sau.",
    inputSchema: {
      type: "object",
      properties: {
        niche_id: {
          type: "number",
          description: "ID của ngách cần lưu"
        },
        note: {
          type: "string",
          description: "Ghi chú cá nhân về ngách này (tùy chọn)"
        }
      },
      required: ["niche_id"]
    }
  },
  {
    name: "get_saved_niches",
    description: "Lấy danh sách các ngách YouTube đã lưu.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "remove_saved_niche",
    description: "Xóa một ngách khỏi danh sách đã lưu.",
    inputSchema: {
      type: "object",
      properties: {
        niche_id: {
          type: "number",
          description: "ID của ngách cần xóa khỏi danh sách"
        }
      },
      required: ["niche_id"]
    }
  },
  {
    name: "get_top_niches",
    description: "Lấy top ngách YouTube tốt nhất theo tiêu chí cụ thể. Hữu ích khi hỏi 'top ngách RPM cao nhất', 'ngách ít cạnh tranh nhất', v.v.",
    inputSchema: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          description: "Tiêu chí xếp hạng",
          enum: ["rpm","potential","trend","low_competition"],
          default: "potential"
        },
        count: {
          type: "number",
          description: "Số lượng top cần lấy (mặc định 5)",
          default: 5
        }
      },
      required: []
    }
  },
  {
    name: "compare_niches",
    description: "So sánh chi tiết 2–4 ngách YouTube với nhau về RPM, tiềm năng, cạnh tranh và xu hướng.",
    inputSchema: {
      type: "object",
      properties: {
        niche_ids: {
          type: "array",
          items: { type: "number" },
          description: "Danh sách ID các ngách cần so sánh (2–4 ngách)"
        },
        niche_names: {
          type: "array",
          items: { type: "string" },
          description: "Hoặc dùng tên ngách để so sánh"
        }
      },
      required: []
    }
  }
];
