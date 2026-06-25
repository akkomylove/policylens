import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/PWA/RegisterSW";
import WebVitalsReporter from "@/components/WebVitalsReporter";
import SkipLink from "@/components/SkipLink";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://policylens.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "PolicyLens · 就业政策智能解读器",
    template: "%s · PolicyLens",
  },
  description:
    "填写你的画像，3 分钟知道你能享受哪些就业政策补贴。AI 智能匹配 + 大白话解读 + 可视化看板。",
  keywords: [
    "就业政策",
    "政策匹配",
    "AI 解读",
    "就业补贴",
    "应届毕业生",
    "退役军人",
    "创业担保贷款",
    "PolicyLens",
    "TRAE AI 大赛",
  ],
  manifest: "/manifest.webmanifest",
  applicationName: "PolicyLens",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PolicyLens",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/icon.svg",
  },
  formatDetection: {
    telephone: false,
  },
  alternates: {
    canonical: `${baseUrl}/`,
  },
  openGraph: {
    title: "PolicyLens · 就业政策智能解读器",
    description:
      "填写你的画像，3 分钟知道你能享受哪些就业政策补贴。AI 智能匹配 + 大白话解读 + 可视化看板。",
    url: baseUrl,
    siteName: "PolicyLens",
    images: [
      {
        url: "/icon.svg",
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
    images: ["/icon.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// JSON-LD 结构化数据：WebApplication + Organization
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${baseUrl}/#webapp`,
      name: "PolicyLens",
      alternateName: "就业政策智能解读器",
      url: baseUrl,
      description:
        "填写你的画像，3 分钟知道你能享受哪些就业政策补贴。AI 智能匹配 + 大白话解读 + 可视化看板。",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "zh-CN",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "CNY",
      },
      featureList: [
        "5 维度用户画像",
        "规则引擎匹配",
        "AI 大白话解读",
        "补贴金额预估",
        "申请难度评估",
        "可视化看板",
        "PWA 离线可用",
      ],
    },
    {
      "@type": "Organization",
      "@id": `${baseUrl}/#org`,
      name: "PolicyLens Team",
      url: baseUrl,
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        <SkipLink />
        {children}
        <RegisterSW />
        <WebVitalsReporter />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
