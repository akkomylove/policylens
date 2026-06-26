import { MatchedPolicy, UserProfile, Policy, DifficultyLevel } from "@/types/policy";

/**
 * 匹配度评分计算器
 * 从补贴金额、匹配维度等角度细化评分
 */

/**
 * 从补贴金额描述中提取数字（万元）
 * 注意：排除"人次"、"万人次"等非金额数字
 * 支持：XX万元 / 最高XX万元 / 不超过XX万元 / XX万元/年 / XX-XX万元 / XX元/人 / 每人XX元
 */
export function extractSubsidyAmount(amountStr: string): number {
  if (!amountStr) return 0;

  let totalAmount = 0;

  // 先用占位符标记已匹配区间，避免重复累加（V6.1 修复：范围匹配也需 markRange）
  const matchedRanges: Array<[number, number]> = [];
  const markRange = (start: number, end: number) => {
    matchedRanges.push([start, end]);
  };
  const isOverlapping = (start: number, end: number) => {
    return matchedRanges.some(([s, e]) => start < e && end > s);
  };

  // 1. 先匹配"XX-XX万元/年"范围（取最大值，优先于单值匹配）
  const rangeWanYearMatches = amountStr.matchAll(/(\d+(?:\.\d+)?)\s*[-—]\s*(\d+(?:\.\d+)?)\s*万元\s*\/\s*年/g);
  for (const match of rangeWanYearMatches) {
    if (match.index !== undefined && !isOverlapping(match.index, match.index + match[0].length)) {
      totalAmount += parseFloat(match[2]);
      markRange(match.index, match.index + match[0].length);
    }
  }

  // 2. 匹配"XX-XX万元"范围（取最大值，排除"万人次"和已匹配的"/年"）
  const rangeWanMatches = amountStr.matchAll(/(\d+(?:\.\d+)?)\s*[-—]\s*(\d+(?:\.\d+)?)\s*万元(?!次|\/年)/g);
  for (const match of rangeWanMatches) {
    if (match.index !== undefined && !isOverlapping(match.index, match.index + match[0].length)) {
      totalAmount += parseFloat(match[2]);
      markRange(match.index, match.index + match[0].length);
    }
  }

  // 3. 匹配"最高XX万元" / "不超过XX万元" / "XX万元/年" / "XX万元"（排除"万人次"和范围已匹配的）

  // "最高XX万元" / "不超过XX万元"
  const maxMatches = amountStr.matchAll(/(?:最高|不超过|至多)\s*(\d+(?:\.\d+)?)\s*万元(?!次)/g);
  for (const match of maxMatches) {
    if (match.index !== undefined && !isOverlapping(match.index, match.index + match[0].length)) {
      totalAmount += parseFloat(match[1]);
      markRange(match.index, match.index + match[0].length);
    }
  }

  // "XX万元/年"（排除"万人次"）
  const wanYearMatches = amountStr.matchAll(/(\d+(?:\.\d+)?)\s*万元\s*\/\s*年/g);
  for (const match of wanYearMatches) {
    if (match.index !== undefined && !isOverlapping(match.index, match.index + match[0].length)) {
      totalAmount += parseFloat(match[1]);
      markRange(match.index, match.index + match[0].length);
    }
  }

  // "XX万元"（排除"万人次"、"/年"、范围、最高/不超过）
  const wanMatches = amountStr.matchAll(/(\d+(?:\.\d+)?)\s*万元(?!次|\/年)/g);
  for (const match of wanMatches) {
    if (match.index !== undefined && !isOverlapping(match.index, match.index + match[0].length)) {
      totalAmount += parseFloat(match[1]);
      markRange(match.index, match.index + match[0].length);
    }
  }

  // 4. 匹配"XXX-XXX元/人"范围（取最大值）
  const rangeYuanPerPersonMatches = amountStr.matchAll(/(\d+)\s*[-—]\s*(\d+)\s*元\s*\/\s*人(?!次)/g);
  for (const match of rangeYuanPerPersonMatches) {
    if (match.index !== undefined && !isOverlapping(match.index, match.index + match[0].length)) {
      totalAmount += parseFloat(match[2]) / 10000;
      markRange(match.index, match.index + match[0].length);
    }
  }

  // 5. 匹配"XXX元/人"（排除"人次"和已匹配的范围）
  const yuanPerPersonMatches = amountStr.matchAll(/(\d+(?:[,，]\d+)*)\s*元\s*\/\s*人(?!次)/g);
  for (const match of yuanPerPersonMatches) {
    if (match.index !== undefined && !isOverlapping(match.index, match.index + match[0].length)) {
      const value = parseFloat(match[1].replace(/[,，]/g, ""));
      totalAmount += value / 10000;
      markRange(match.index, match.index + match[0].length);
    }
  }

  // 6. 匹配"每人XXX元" / "每人XXX-XXX元"
  const perPersonYuanMatches = amountStr.matchAll(/每人\s*(\d+(?:[,，]\d+)*)\s*[-—]?\s*(?:(\d+(?:[,，]\d+)*)\s*)?元/g);
  for (const match of perPersonYuanMatches) {
    if (match.index !== undefined && !isOverlapping(match.index, match.index + match[0].length)) {
      // 取范围最大值或单值
      const value = match[2] ? parseFloat(match[2].replace(/[,，]/g, "")) : parseFloat(match[1].replace(/[,，]/g, ""));
      totalAmount += value / 10000;
      markRange(match.index, match.index + match[0].length);
    }
  }

  // 7. 兜底：匹配单独的"XXX元"（排除"人次"、"/人"已匹配的）
  if (totalAmount === 0) {
    const yuanMatches = amountStr.matchAll(/(\d+(?:[,，]\d+)*)\s*元(?!次|\/人)/g);
    for (const match of yuanMatches) {
      const value = parseFloat(match[1].replace(/[,，]/g, ""));
      // 只统计合理的金额（>100元才算补贴）
      if (value >= 100) {
        totalAmount += value / 10000;
      }
    }
  }

  return totalAmount;
}

/**
 * 计算匹配结果的汇总信息
 */
export function calculateSummary(
  matchedPolicies: MatchedPolicy[],
  userProfile: UserProfile
): {
  totalSubsidyEstimate: string;
  summary: string;
  categoryCount: Record<string, number>;
} {
  // 按补贴类型分类统计
  const categoryCount: Record<string, number> = {};
  let totalAmount = 0;

  for (const policy of matchedPolicies) {
    // 统计补贴类型
    const types = policy.subsidyType
      .split(/[，、,；;]/)
      .map((t) => t.trim())
      .filter(Boolean);
    for (const type of types) {
      categoryCount[type] = (categoryCount[type] || 0) + 1;
    }

    // 累计补贴金额（排除贷款类，贷款不是直接补贴）
    const isLoan =
      policy.subsidyType.includes("贷款") ||
      policy.subsidyAmount.includes("贷款");
    if (!isLoan) {
      totalAmount += extractSubsidyAmount(policy.subsidyAmount);
    }
  }

  // 格式化总金额
  let totalSubsidyEstimate: string;
  if (totalAmount >= 1) {
    totalSubsidyEstimate = `约 ${totalAmount.toFixed(1)} 万元`;
  } else if (totalAmount > 0) {
    totalSubsidyEstimate = `约 ${(totalAmount * 10000).toFixed(0)} 元`;
  } else {
    totalSubsidyEstimate = "详见各项政策";
  }

  // 生成摘要
  const topPolicies = matchedPolicies.slice(0, 3);
  const summary = `根据您的画像（${userProfile.identity}·${userProfile.education}·${userProfile.province}），为您匹配到 ${matchedPolicies.length} 条相关政策，预计可享受补贴 ${totalSubsidyEstimate}。其中匹配度最高的是「${topPolicies[0]?.title || "暂无"}」。`;

  return {
    totalSubsidyEstimate,
    summary,
    categoryCount,
  };
}

/**
 * 获取匹配等级
 */
export function getMatchLevel(score: number): {
  level: string;
  color: string;
  label: string;
} {
  if (score >= 80) {
    return { level: "high", color: "#10b981", label: "高度匹配" };
  } else if (score >= 60) {
    return { level: "medium", color: "#f59e0b", label: "中度匹配" };
  } else if (score >= 40) {
    return { level: "low", color: "#6366f1", label: "基本匹配" };
  } else {
    return { level: "minimal", color: "#9ca3af", label: "弱匹配" };
  }
}

/**
 * 评估政策申请难度
 * 维度：申请条件数量、是否需要线下办理、是否需要材料证明
 */
export function calculateDifficulty(policy: Policy): DifficultyLevel {
  const reqCount = policy.requirements.length;
  const content = policy.content || "";
  const howToApply = policy.subsidyAmount + policy.subsidyType;

  // 需要线下办理的关键词
  const offlineKeywords = ["线下", "现场", "窗口", "政务服务中心", "经办机构", "户籍地", "参保地"];
  const needOffline = offlineKeywords.some((kw) => content.includes(kw) || howToApply.includes(kw));

  // 需要材料证明的关键词
  const materialKeywords = ["营业执照", "合同", "证明", "证书", "身份证", "社保", "材料", "复印件"];
  const needMaterials = materialKeywords.some((kw) => content.includes(kw));

  // 评分：条件数量 + 线下办理 + 材料证明
  let score = reqCount;
  if (needOffline) score += 3;
  if (needMaterials) score += 2;

  if (score <= 2) return "easy";
  if (score <= 5) return "medium";
  return "hard";
}

/**
 * 获取难度标签信息
 */
export function getDifficultyInfo(difficulty: DifficultyLevel): {
  label: string;
  color: string;
  bgColor: string;
} {
  switch (difficulty) {
    case "easy":
      return { label: "易申请", color: "#10b981", bgColor: "#d1fae5" };
    case "medium":
      return { label: "中等", color: "#f59e0b", bgColor: "#fef3c7" };
    case "hard":
      return { label: "较复杂", color: "#ef4444", bgColor: "#fee2e2" };
  }
}
