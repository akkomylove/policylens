import type { Metadata } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://policylens.vercel.app";

export const metadata: Metadata = {
  title: "PolicyLens 介绍 · 就业政策智能解读器 | TRAE AI 创造力大赛",
  description:
    "PolicyLens 是一款基于 AI 的就业政策智能解读器，帮助求职者、应届毕业生、退役军人等群体 3 分钟匹配可享受的就业补贴政策。采用规则引擎 + GLM 大模型双层匹配，提供大白话解读和可视化看板。",
  keywords: [
    "就业政策",
    "政策匹配",
    "AI 解读",
    "就业补贴",
    "应届毕业生",
    "退役军人",
    "创业担保贷款",
    "TRAE AI 大赛",
  ],
  alternates: {
    canonical: `${baseUrl}/landing`,
  },
  openGraph: {
    title: "PolicyLens · 就业政策智能解读器",
    description:
      "填写你的画像，3 分钟知道你能享受哪些就业政策补贴。AI 智能匹配 + 大白话解读 + 可视化看板。",
    url: `${baseUrl}/landing`,
    siteName: "PolicyLens",
    images: [
      {
        url: `${baseUrl}/icon.svg`,
        width: 512,
        height: 512,
        alt: "PolicyLens 就业政策智能解读器",
      },
    ],
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "PolicyLens · 就业政策智能解读器",
    description:
      "填写你的画像，3 分钟知道你能享受哪些就业政策补贴。AI 智能匹配 + 大白话解读 + 可视化看板。",
    images: [`${baseUrl}/icon.svg`],
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
