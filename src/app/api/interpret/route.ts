import { NextRequest, NextResponse } from "next/server";
import { Policy, UserProfile, MatchBreakdown, MatchPriority } from "@/types/policy";
import { interpretPolicy } from "@/lib/ai";

/**
 * AI 解读 API Route V2
 * 接收政策信息、用户画像、匹配明细，调用 ai.ts 的 interpretPolicy 返回解读结果
 * V2 合并：移除重复的 prompt 构建 + GLM 调用 + 降级逻辑，统一调用 ai.ts
 */
export async function POST(request: NextRequest) {
  try {
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

    if (!policy || !userProfile) {
      return NextResponse.json(
        { error: "缺少必要参数：policy 和 userProfile" },
        { status: 400 }
      );
    }

    const result = await interpretPolicy(policy, userProfile, matchBreakdown, priority);
    return NextResponse.json(result);
  } catch (error) {
    console.error("AI 解读 API 错误:", error);
    return NextResponse.json(
      { error: "AI 解读服务暂时不可用，请稍后重试" },
      { status: 500 }
    );
  }
}
