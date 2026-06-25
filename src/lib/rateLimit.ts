// ============ 简易内存限流（基于 IP） ============
// 适用于单实例部署；多实例需改用 Redis。大赛场景足够。

import type { NextRequest } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_MAP = new Map<string, RateLimitEntry>();

const CLEANUP_THRESHOLD = 1000;
let cleanupCounter = 0;

export function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60_000
): { limited: boolean; remaining: number; resetAt: number } {
  if (++cleanupCounter > CLEANUP_THRESHOLD) {
    const now = Date.now();
    for (const [k, v] of RATE_LIMIT_MAP) {
      if (v.resetAt < now) RATE_LIMIT_MAP.delete(k);
    }
    cleanupCounter = 0;
  }

  const now = Date.now();
  const entry = RATE_LIMIT_MAP.get(key);

  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowMs;
    RATE_LIMIT_MAP.set(key, { count: 1, resetAt });
    return { limited: false, remaining: maxRequests - 1, resetAt };
  }

  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);

  if (entry.count > maxRequests) {
    return { limited: true, remaining: 0, resetAt: entry.resetAt };
  }

  return { limited: false, remaining, resetAt: entry.resetAt };
}

export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP.trim();
  return "unknown";
}
