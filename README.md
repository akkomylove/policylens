# PolicyLens · 就业政策智能解读器

> TRAE AI 创造力大赛参赛作品 · 社会服务赛道 + 社会公益附加赛道  
> 填写你的画像，3 分钟知道你能享受哪些就业政策补贴。

<!-- 这里放项目截图或演示GIF -->

## 核心能力

| 能力 | 说明 |
|------|------|
| **智能匹配** | 基于身份/学历/地域/就业状态/行业的 5 维度规则引擎，覆盖 31 省 58 条真实政策 |
| **AI 解读** | 智谱 GLM-4.7-Flash 模型将晦涩政策翻译为 10 个结构化字段（申请材料/办理地点/步骤等） |
| **数据看板** | ECharts 可视化（补贴金额 Top10 / 匹配雷达图 / 类型分布饼图）+ 6 张决策卡片 |
| **行动闭环** | 官方申报入口直达 + 4 步申请进度跟踪 + 资格窗口期倒计时预警 |
| **精准匹配** | 原子条件(AtomicCondition)拆解 + 语义近似映射 + "还差 N 个条件"进度提示 |

## 技术亮点

- **匹配引擎**：10 类原子条件（身份/年龄/学历/地域/状态/行业/社保/毕业年份等），94 个 Vitest 单元测试覆盖核心逻辑
- **性能优化**：Dashboard `next/dynamic` 懒加载（ECharts ~400KB 按需加载），KPI 卡片 `React.memo` 避免重复渲染
- **可发现性**：SSG 预渲染 58 个 `/policy/[id]` 详情页；动态 sitemap + OG/Twitter Card + JSON-LD 结构化数据
- **可靠性**：Service Worker 三层缓存策略（PWA 离线可用）；IP 限流 + 输入校验 + 并发请求去重
- **报告导出**：html2canvas-pro + jsPDF 支持 PNG 图片分享 / A4 PDF 打印

## 技术栈

- **框架**：Next.js 16 + React 19 + TypeScript
- **样式**：Tailwind CSS 4
- **状态**：Zustand（含 persist 中间件）
- **可视化**：ECharts 6
- **AI**：智谱 GLM-4.7-Flash
- **图标/动画**：lucide-react + framer-motion
- **测试**：Vitest（94 用例）
- **PWA**：Service Worker + Web App Manifest
- **导出**：html2canvas-pro + jsPDF

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/akkomylove/policylens.git
cd policylens

# 2. 安装依赖
npm install

# 3. 配置 AI API Key
cp .env.example .env.local
# 填入你的智谱 API Key：GLM_API_KEY=your_api_key_here

# 4. 启动开发服务器
npm run dev
# 打开 http://localhost:3000
```

> 未配置 API Key 时，AI 解读功能不可用，政策匹配和数据看板不受影响。

## 构建生产版本

```bash
npm run build
npm start
```

## 部署

推荐使用 [Vercel](https://vercel.com) 部署，环境变量中配置 `GLM_API_KEY`。

## 项目结构

```text
policylens/
├── public/
│   ├── data/
│   │   ├── policies.json       # 58 条结构化政策数据
│   │   └── stats.json          # 宏观就业统计数据
│   ├── manifest.webmanifest    # PWA 清单
│   ├── sw.js                   # Service Worker
│   └── icon.svg
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/           # AI 智能追问 SSE 接口
│   │   │   ├── interpret/      # AI 解读 API（限流/校验/去重）
│   │   │   └── track/          # 数据埋点 API
│   │   ├── landing/            # 介绍页
│   │   ├── policy/[id]/        # 政策详情 SSG 页
│   │   ├── report/             # 匹配报告页
│   │   ├── robots.ts           # robots.txt
│   │   ├── sitemap.ts          # sitemap.xml
│   │   └── layout.tsx          # 根布局（OG/JSON-LD/PWA 注册）
│   ├── components/
│   │   ├── Dashboard/          # 数据看板（懒加载）
│   │   ├── PolicyChat/         # AI 智能追问
│   │   ├── ProfileForm/        # 用户画像表单
│   │   ├── RecommendationSection/ # 个性化推荐
│   │   ├── Report/             # 匹配报告
│   │   ├── ReportExportMenu/   # PDF/图片导出
│   │   ├── SkipLink/           # 无障碍跳过链接
│   │   └── WebVitalsReporter/  # Web Vitals 监控
│   ├── lib/
│   │   ├── matcher/            # 匹配引擎（含单元测试）
│   │   ├── ai.ts               # AI 调用（含 7 天缓存）
│   │   ├── analytics.ts        # 埋点客户端
│   │   ├── data.server.ts      # 服务端数据加载（SSG）
│   │   ├── exportReport.ts     # 报告导出工具
│   │   ├── rateLimit.ts        # IP 限流
│   │   ├── recommender.ts      # 个性化推荐引擎
│   │   ├── requestDedup.ts     # 请求去重
│   │   └── store.ts            # Zustand 状态管理
│   └── types/                  # TypeScript 类型定义
├── vitest.config.ts            # Vitest 配置
└── start.bat                   # Windows 一键启动
```

## 许可证

[MIT](LICENSE)
