import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rateLimit";

/**
 * 数据埋点接收 API
 * 接收前端 sendBeacon 上报的事件，存入内存数组
 *
 * 限流：每分钟 60 次（埋点场景放宽）
 * 隐私：不存储 IP，仅存储 sessionId（页面级匿名标识）
 */

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW = 60_000;

// 内存事件存储（大赛场景足够；生产环境需换持久化存储）
const MAX_EVENTS = 5000;
const EVENTS: Array<{
  name: string;
  props?: Record<string, unknown>;
  ts: number;
  sessionId: string;
  sessionDuration: number;
  path: string;
  referrer: string;
}> = [];

export async function POST(request: NextRequest) {
  // 限流
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(
    `track:${clientIP}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW
  );
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "请求过于频繁" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    const body = await request.json();
    const { name, props, ts, sessionId, sessionDuration, path, referrer } = body;

    // 基础校验
    if (!name || typeof name !== "string" || name.length > 100) {
      return NextResponse.json({ error: "事件名无效" }, { status: 400 });
    }

    // 入库（不存储 IP）
    EVENTS.push({
      name,
      props: props || {},
      ts: ts || Date.now(),
      sessionId: sessionId || "unknown",
      sessionDuration: sessionDuration || 0,
      path: path || "/",
      referrer: referrer || "",
    });

    // 容量上限：FIFO 淘汰
    if (EVENTS.length > MAX_EVENTS) {
      EVENTS.splice(0, EVENTS.length - MAX_EVENTS);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }
}

/**
 * 查询统计（GET /api/track）
 * 返回事件总数、按事件名分组、按路径分组
 */
export async function GET() {
  const byName: Record<string, number> = {};
  const byPath: Record<string, number> = {};
  const uniqueSessions = new Set<string>();

  for (const event of EVENTS) {
    byName[event.name] = (byName[event.name] || 0) + 1;
    byPath[event.path] = (byPath[event.path] || 0) + 1;
    uniqueSessions.add(event.sessionId);
  }

  return NextResponse.json({
    total: EVENTS.length,
    uniqueSessions: uniqueSessions.size,
    byName,
    byPath,
    oldestTs: EVENTS[0]?.ts,
    newestTs: EVENTS[EVENTS.length - 1]?.ts,
  });
}
