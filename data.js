// data.js — Niche database
export const NICHES_DB = [
  { id:1,  name:"Personal Finance Tips",      sub:"Tiết kiệm & đầu tư cá nhân",       cat:"Finance",        rpm:18.4, comp:52, potential:91, status:"hot",  trend:34,  views:"2.1M/tháng",  subs:"50K–500K" },
  { id:2,  name:"AI Tools for Beginners",     sub:"Hướng dẫn dùng AI thực tế",        cat:"Tech & AI",      rpm:14.2, comp:38, potential:88, status:"grow", trend:61,  views:"1.8M/tháng",  subs:"10K–200K" },
  { id:3,  name:"Budget Meal Prep",           sub:"Nấu ăn tiết kiệm theo tuần",       cat:"Food",           rpm:8.7,  comp:41, potential:79, status:"grow", trend:28,  views:"3.4M/tháng",  subs:"20K–300K" },
  { id:4,  name:"Stoic Philosophy",           sub:"Triết học ứng dụng cuộc sống",     cat:"Motivational",   rpm:11.3, comp:29, potential:83, status:"grow", trend:44,  views:"900K/tháng",  subs:"10K–150K" },
  { id:5,  name:"Side Hustle Ideas 2026",     sub:"Kiếm thêm thu nhập online",        cat:"Finance",        rpm:16.8, comp:67, potential:74, status:"hot",  trend:19,  views:"4.2M/tháng",  subs:"100K–1M"  },
  { id:6,  name:"Home Gym Workouts",          sub:"Tập gym tại nhà không thiết bị",   cat:"Health & Fitness",rpm:9.1, comp:55, potential:70, status:"sat",  trend:8,   views:"5.1M/tháng",  subs:"200K–2M"  },
  { id:7,  name:"Minimalist Lifestyle",       sub:"Sống tối giản & bền vững",         cat:"Lifestyle",      rpm:7.4,  comp:33, potential:77, status:"grow", trend:37,  views:"1.2M/tháng",  subs:"15K–200K" },
  { id:8,  name:"Prompt Engineering",        sub:"Kỹ thuật viết prompt cho AI",      cat:"Tech & AI",      rpm:19.6, comp:22, potential:95, status:"new",  trend:89,  views:"600K/tháng",  subs:"5K–80K"   },
  { id:9,  name:"History Mysteries",         sub:"Bí ẩn lịch sử chưa giải đáp",     cat:"Education",      rpm:10.2, comp:44, potential:81, status:"grow", trend:31,  views:"2.8M/tháng",  subs:"30K–400K" },
  { id:10, name:"Indie Game Dev",            sub:"Làm game độc lập Unity/Godot",     cat:"Gaming",         rpm:8.9,  comp:37, potential:72, status:"new",  trend:52,  views:"1.1M/tháng",  subs:"5K–100K"  },
  { id:11, name:"Mental Health Daily",       sub:"Sức khỏe tâm thần & mindfulness",  cat:"Health & Fitness",rpm:12.5,comp:48, potential:85, status:"grow", trend:26,  views:"1.9M/tháng",  subs:"20K–250K" },
  { id:12, name:"Crypto & Web3 Basics",      sub:"Blockchain cho người mới bắt đầu", cat:"Finance",        rpm:22.1, comp:71, potential:68, status:"sat",  trend:-5,  views:"3.0M/tháng",  subs:"100K–800K"},
  { id:13, name:"Python Automation",         sub:"Tự động hóa công việc bằng Python",cat:"Tech & AI",      rpm:17.3, comp:45, potential:87, status:"grow", trend:41,  views:"2.3M/tháng",  subs:"40K–500K" },
  { id:14, name:"Solo Travel Hacks",         sub:"Du lịch một mình tiết kiệm",       cat:"Lifestyle",      rpm:6.8,  comp:60, potential:65, status:"sat",  trend:11,  views:"4.7M/tháng",  subs:"150K–1M"  },
  { id:15, name:"Language Learning AI",      sub:"Học ngoại ngữ với trợ lý AI",      cat:"Education",      rpm:13.7, comp:19, potential:93, status:"new",  trend:78,  views:"500K/tháng",  subs:"3K–60K"   },
  { id:16, name:"Digital Nomad Life",        sub:"Làm việc từ xa toàn thế giới",     cat:"Lifestyle",      rpm:9.8,  comp:50, potential:76, status:"grow", trend:22,  views:"1.5M/tháng",  subs:"20K–300K" },
  { id:17, name:"No-Code App Builder",       sub:"Tạo app không cần lập trình",      cat:"Tech & AI",      rpm:15.1, comp:28, potential:90, status:"new",  trend:67,  views:"400K/tháng",  subs:"5K–70K"   },
  { id:18, name:"Kids Science Experiments",  sub:"Khoa học vui cho trẻ em tại nhà",  cat:"Education",      rpm:7.9,  comp:35, potential:80, status:"grow", trend:33,  views:"6.2M/tháng",  subs:"50K–600K" },
  { id:19, name:"Faceless YouTube Strategy", sub:"Xây kênh ẩn danh kiếm tiền",       cat:"Motivational",   rpm:20.4, comp:25, potential:94, status:"new",  trend:92,  views:"300K/tháng",  subs:"2K–50K"   },
  { id:20, name:"Vintage Fashion Styling",   sub:"Phối đồ vintage & thrift shop",    cat:"Lifestyle",      rpm:5.6,  comp:42, potential:69, status:"grow", trend:15,  views:"2.9M/tháng",  subs:"30K–400K" },
];

// In-memory saved list (resets on server restart — dùng DB thật cho production)
export const savedNiches = new Map();
