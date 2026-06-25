import type { MetadataRoute } from "next";
import { getAllPolicies } from "@/lib/data.server";

/**
 * sitemap.xml 生成器
 * 列出所有公开可索引的页面
 * - 静态页面：首页 / 介绍页 / 报告页
 * - 动态页面：每条政策一个详情页（SSG）
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://policylens.vercel.app";
  const now = new Date();

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/landing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/report`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  // 每条政策一个详情页
  const policyUrls: MetadataRoute.Sitemap = getAllPolicies().map((p) => ({
    url: `${baseUrl}/policy/${p.id}`,
    lastModified: new Date(p.publishDate),
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));

  return [...staticUrls, ...policyUrls];
}
