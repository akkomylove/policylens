import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PolicyLens · 就业政策智能解读器",
  description:
    "填写你的画像，3 分钟知道你能享受哪些就业政策补贴。AI 智能匹配 + 大白话解读 + 可视化看板。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        {children}
      </body>
    </html>
  );
}
