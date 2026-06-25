import { NextRequest, NextResponse } from "next/server";
import { Policy, UserProfile, MatchBreakdown, MatchPriority } from "@/types/policy";
import { interpretPolicy } from "@/lib/ai";
import { checkRateLimit, getClientIP } from "@/lib/rateLimit";
import { dedupeRequest } from "@/lib/requestDedup";

/**
 * AI 解读 API Route V2
 * 接收政策信息、用户画像、匹配明细，调用 ai.ts 的 interpretPolicy 返回解读结果
 *
 * 安全增强（V6.1）：
 * - IP 限流：每分钟 10 次
 * - 输入校验：字段类型/长度/合理性
 * - 请求去重：同 policyId 并发请求合并
 */

// 限流配置
const RATE_LIMIT_MAX = 10; // 每分钟最大请求数
const RATE_LIMIT_WINDOW = 60_000; // 1 分钟

// 输入长度上限（防止 prompt 注入和成本失控）
const MAX_CONTENT_LENGTH = 5000;
const MAX_TITLE_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 500;

/**
 * 校验 policy 对象
 */
function validatePolicy(policy: unknown): { valid: boolean; error?: string } {
  if (!policy || typeof policy !== "object") {
    return { valid: false, error: "policy 必须是对象" };
  }
  const p = policy as Record<string, unknown>;
  if (!p.id || typeof p.id !== "string" || p.id.length > 100) {
    return { valid: false, error: "policy.id 无效" };
  }
  if (!p.title || typeof p.title !== "string" || p.title.length > MAX_TITLE_LENGTH) {
    return { valid: false, error: "policy.title 无效" };
  }
  if (!p.content || typeof p.content !== "string" || p.content.length > MAX_CONTENT_LENGTH) {
    return { valid: false, error: `policy.content 无效或超过 ${MAX_CONTENT_LENGTH} 字符` };
  }
  if (p.summary && (typeof p.summary !== "string" || p.summary.length > MAX_SUMMARY_LENGTH)) {
    return { valid: false, error: "policy.summary 无效" };
  }
  return { valid: true };
}

/**
 * 校验 userProfile 对象
 */
function validateUserProfile(userProfile: unknown): { valid: boolean; error?: string } {
  if (!userProfile || typeof userProfile !== "object") {
    return { valid: false, error: "userProfile 必须是对象" };
  }
  const u = userProfile as Record<string, unknown>;
  if (!u.identity || typeof u.identity !== "string") {
    return { valid: false, error: "userProfile.identity 无效" };
  }
  if (!u.education || typeof u.education !== "string") {
    return { valid: false, error: "userProfile.education 无效" };
  }
  if (!u.province || typeof u.province !== "string") {
    return { valid: false, error: "userProfile.province 无效" };
  }
  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    // 1. 限流检查
    const clientIP = getClientIP(request);
    const rateLimitKey = `interpret:${clientIP}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

    if (rateLimit.limited) {
      const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: `请求过于频繁，请 ${retryAfter} 秒后重试` },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rateLimit.resetAt),
          },
        }
      );
    }

    // 2. 解析请求体
    const body = await request.json();
    const {
      policy,
      userProfile,
      matchBreakdown,
      priority,
    }: {
      policy: Policy;
      userProfile: UserProfile;
      matchBreakdown?: MatchBreakdown;
      priority?: MatchPriority;
    } = body;

    // 3. 基础存在性检查
    if (!policy || !userProfile) {
      return NextResponse.json(
        { error: "缺少必要参数：policy 和 userProfile" },
        { status: 400 }
      );
    }

    // 4. 字段校验
    const policyValidation = validatePolicy(policy);
    if (!policyValidation.valid) {
      return NextResponse.json(
        { error: policyValidation.error },
        { status: 400 }
      );
    }

    const userProfileValidation = validateUserProfile(userProfile);
    if (!userProfileValidation.valid) {
      return NextResponse.json(
        { error: userProfileValidation.error },
        { status: 400 }
      );
    }

    // 5. 请求去重（同 policyId 并发请求合并）
    const dedupeKey = `interpret:${policy.id}`;
    const result = await dedupeRequest(dedupeKey, () =>
      interpretPolicy(policy, userProfile, matchBreakdown, priority)
    );

    // 6. 返回结果（附限流头）
    const response = NextResponse.json(result);
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    response.headers.set("X-RateLimit-Reset", String(rateLimit.resetAt));
    return response;
  } catch (error) {
    console.error("AI 解读 API 错误:", error);
    return NextResponse.json(
      { error: "AI 解读服务暂时不可用，请稍后重试" },
      { status: 500 }
    );
  }
}
