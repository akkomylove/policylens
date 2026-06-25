import type { Metadata } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://policylens.vercel.app";

export const metadata: Metadata = {
  title: "匹配报告 · PolicyLens",
  description:
    "查看你的就业政策匹配报告，包含匹配明细、补贴预估、申请难度、AI 大白话解读和可视化看板。支持一键分享你的匹配结果。",
  keywords: [
    "政策匹配报告",
    "补贴预估",
    "AI 解读",
    "可视化看板",
    "PolicyLens",
  ],
  alternates: {
    canonical: `${baseUrl}/report`,
  },
  openGraph: {
    title: "我的就业政策匹配报告 · PolicyLens",
    description:
      "AI 智能匹配 + 大白话解读 + 可视化看板，3 分钟知道你能享受哪些就业政策补贴。",
    url: `${baseUrl}/report`,
    siteName: "PolicyLens",
    images: [
      {
        url: `${baseUrl}/icon.svg`,
        width: 512,
        height: 512,
        alt: "PolicyLens 匹配报告",
      },
    ],
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "我的就业政策匹配报告 · PolicyLens",
    description:
      "AI 智能匹配 + 大白话解读 + 可视化看板，3 分钟知道你能享受哪些就业政策补贴。",
    images: [`${baseUrl}/icon.svg`],
  },
};

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
