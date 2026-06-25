"use client";

import { useReportWebVitals } from "next/web-vitals";
import { track } from "@/lib/analytics";

/**
 * Web Vitals 上报器
 * 收集 LCP/CLS/INP/FCP/TTFB 指标，通过埋点上报到 /api/track
 * 仅在生产环境上报，开发环境输出到 console
 *
 * 指标说明：
 * - LCP (Largest Contentful Paint): 最大内容绘制时间，目标 < 2.5s
 * - CLS (Cumulative Layout Shift): 累积布局偏移，目标 < 0.1
 * - INP (Interaction to Next Paint): 交互到下次绘制，目标 < 200ms（替代 FID）
 * - FCP (First Contentful Paint): 首次内容绘制，目标 < 1.8s
 * - TTFB (Time to First Byte): 首字节时间，目标 < 800ms
 */
export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    const { name, value, id, rating } = metric;

    // 评分阈值（基于 Web Vitals 官方标准）
    // rating: "good" | "needs-improvement" | "poor"

    if (process.env.NODE_ENV === "development") {
      // 开发环境输出到 console，便于调试
      console.debug(`[Web Vitals] ${name}:`, value, `(${rating})`);
    }

    // 生产环境 + 客户端才上报
    if (process.env.NODE_ENV === "production") {
      track("web_vital", {
        name, // LCP / CLS / INP / FCP / TTFB
        value: Number(value.toFixed(2)),
        rating, // good / needs-improvement / poor
        metricId: id,
      });
    }
  });

  return null;
}
