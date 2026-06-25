import type { MetadataRoute } from "next";

/**
 * robots.txt 生成器
 * 允许所有爬虫索引公开页面，禁止索引 API 路由
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://policylens.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/landing", "/report"],
        disallow: ["/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
