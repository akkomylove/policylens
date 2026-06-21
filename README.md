# PolicyLens · 就业政策智能解读器

> TRAE AI 创造力大赛参赛作品 · 社会服务赛道 + 社会公益附加赛道

填写你的画像，3 分钟知道你能享受哪些就业政策补贴。AI 智能匹配 + 大白话解读 + 可视化看板。

## 功能特性

- **政策匹配**：基于身份/学历/地域/就业状态/行业的 5 维度规则匹配引擎，分层推荐（强烈/推荐/可选）
- **AI 解读**：调用智谱 GLM-4.7-Flash 模型，把晦涩政策翻译成大白话，输出 10 个结构化字段（为什么是你/为什么现在/能拿什么/申请材料/办理地点/咨询电话/申请步骤等），含降级方案和 7 天缓存
- **数据看板**：3 个 ECharts 图表（补贴金额 Top10 柱状图/5 维度匹配雷达图/补贴类型分布饼图）+ 6 张决策卡片（画像总览/申请路线图/补贴预估/即将截止/同类用户/宏观背景）
- **政策卡片**：4 大实用性功能（申请材料清单/办理地点+联系方式/申请时限倒计时/同类用户反馈），标签精简为 4 核心+折叠
- **51 条政策**：覆盖 31 个省份，含国务院、人社部及各省市政策，含申报截止日期和同类用户申请数
- **体验打磨**：返回顶部按钮、打印样式、Tab 状态 URL 持久化、表单草稿持久化、AI 解读骨架屏、错误边界兜底

## 技术栈

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4
- Zustand 状态管理（含 persist 中间件）
- ECharts 6 数据可视化
- 智谱 GLM-4.7-Flash AI 模型

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 AI API Key（重要）

本项目使用智谱 AI 的 GLM 模型进行政策解读。**未配置 API Key 时，AI 解读功能将无法使用**（政策匹配和数据看板不受影响）。

1. 前往 [智谱 AI 开放平台](https://open.bigmodel.cn/) 注册并获取 API Key
2. 复制 `.env.example` 为 `.env.local`
3. 填入你的 API Key：

```bash
GLM_API_KEY=your_api_key_here
```

### 3. 启动开发服务器

```bash
npm run dev
```

或使用一键启动脚本（Windows）：

```bash
start.bat
```

打开 [http://localhost:3000](http://localhost:3000) 查看效果。

### 4. 构建生产版本

```bash
npm run build
npm start
```

## 部署

推荐使用 [Vercel](https://vercel.com/) 部署，部署时在环境变量中配置 `GLM_API_KEY`。

## 项目结构

```
policylens/
├── public/data/
│   ├── policies.json    # 51 条结构化政策数据
│   └── stats.json       # 宏观就业统计数据
├── src/
│   ├── app/             # Next.js App Router
│   ├── components/      # React 组件
│   ├── lib/             # 工具库（AI、数据、状态、匹配引擎）
│   └── types/           # TypeScript 类型定义
└── start.bat            # Windows 一键启动脚本
```

## 许可证

MIT
