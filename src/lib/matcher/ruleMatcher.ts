import { Policy, UserProfile, MatchedPolicy, MatchPriority, MatchBreakdown } from "@/types/policy";
import { calculateDifficulty } from "./scoreCalculator";

/**
 * 规则匹配引擎 V2
 * 基于用户画像匹配政策，新增分层推荐（priority）和结构化匹配明细（matchBreakdown）
 */

// 身份关键词映射（处理数据中不同表述）
const IDENTITY_KEYWORDS: Record<string, string[]> = {
  应届毕业生: ["应届毕业生", "应届", "毕业年度", "高校毕业生", "毕业生"],
  往届毕业生: ["往届毕业生", "往届", "离校", "未就业高校毕业生"],
  退役军人: ["退役军人", "退伍", "转业", "军人"],
  返乡创业者: ["返乡创业者", "返乡", "创业", "自主创业"],
  灵活就业人员: ["灵活就业人员", "灵活就业", "新就业形态"],
  在职人员: ["在职人员", "企业职工", "职工", "参保人员"],
  失业人员: ["失业人员", "失业", "就业困难人员", "登记失业"],
  农民工: ["农民工", "农村劳动力", "进城务工"],
};

// 学历等级映射
const EDUCATION_LEVELS: Record<string, number> = {
  高中及以下: 1,
  大专: 2,
  本科: 3,
  硕士: 4,
  博士: 5,
};

// 学历门槛识别规则（从政策正文中提取学历要求）
const EDUCATION_THRESHOLDS: Array<{ pattern: RegExp; level: number; label: string }> = [
  { pattern: /博士(?:研究生|及以上)?/, level: 5, label: "博士" },
  { pattern: /硕士(?:研究生|及以上)?|研究生及以上/, level: 4, label: "硕士及以上" },
  { pattern: /本科及以上|高校毕业/, level: 3, label: "本科及以上" },
  { pattern: /大专及以上|高职(?:及以上)?|高专/, level: 2, label: "大专及以上" },
  { pattern: /高中及以上|中职|技校|中专/, level: 1, label: "高中及以上" },
];

// 就业状态匹配规则（不同状态匹配不同政策类型）
const EMPLOYMENT_STATUS_RULES: Record<string, string[]> = {
  求职中: ["吸纳就业", "就业补贴", "见习", "社保补贴", "求职", "高校毕业生"],
  已就业: ["技能提升", "培训补贴", "社保补贴", "在职", "职工"],
  创业中: ["创业担保贷款", "创业补贴", "创业扶持", "创业", "自主创业"],
  待业: ["失业保险", "就业援助", "再就业", "见习", "就业困难"],
};

// 行业意向关键词映射（处理语义近似匹配）
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  互联网: ["互联网", "数字经济", "软件", "信息技术", "数字化", "电商", "平台经济"],
  制造业: ["制造业", "工业", "智能制造", "产业工人", "工厂", "生产"],
  农业: ["农业", "农村", "农民", "乡村振兴", "种养殖", "农产品", "返乡"],
  服务业: ["服务业", "商贸", "餐饮", "物流", "零售", "家政", "旅游"],
  金融业: ["金融", "银行", "保险", "证券", "投资", "融资"],
  教育: ["教育", "教师", "培训", "学校", "教学", "职业教育"],
  医疗: ["医疗", "卫生", "医院", "护士", "医生", "护理", "健康"],
  不限: [],
};

/**
 * 检查用户身份是否匹配政策的适用人群
 */
function matchIdentity(
  userIdentity: string,
  applicableGroups: string[]
): { matched: boolean; reason: string } {
  const keywords = IDENTITY_KEYWORDS[userIdentity] || [userIdentity];
  const hit = applicableGroups.some((group) =>
    keywords.some((keyword) => group.includes(keyword) || keyword.includes(group))
  );

  if (hit) {
    return {
      matched: true,
      reason: `您是「${userIdentity}」，政策适用人群包含此类型`,
    };
  }
  return {
    matched: false,
    reason: `政策适用人群为「${applicableGroups.slice(0, 3).join("、")}」等，与您的身份（${userIdentity}）不直接匹配`,
  };
}

/**
 * 检查用户地域是否匹配政策适用地区
 */
function matchRegion(
  userProvince: string,
  regions: string[]
): { matched: boolean; reason: string } {
  // 全国性政策直接匹配
  if (regions.includes("全国") || regions.length === 0) {
    return { matched: true, reason: "全国性政策，所有地区适用" };
  }
  // 精确匹配省份
  const hit = regions.some(
    (region) =>
      region.includes(userProvince) ||
      userProvince.includes(region) ||
      region.includes(userProvince.replace(/省|市|自治区|特别行政区|壮族|回族|维吾尔/g, ""))
  );

  if (hit) {
    return { matched: true, reason: `政策适用于${regions.join("、")}，您所在地区（${userProvince}）符合` };
  }
  return {
    matched: false,
    reason: `政策仅适用于${regions.join("、")}，您所在地区（${userProvince}）不在范围内`,
  };
}

/**
 * 检查学历是否满足要求（从政策内容中推断）
 */
function matchEducation(
  userEducation: string,
  policy: Policy
): { matched: boolean; reason: string } {
  const userLevel = EDUCATION_LEVELS[userEducation] || 3;

  // 遍历学历门槛规则，找到政策要求的最高学历门槛
  let requiredLevel = 0;
  let requiredLabel = "";
  for (const threshold of EDUCATION_THRESHOLDS) {
    // 仅在政策 requirements 或 content 明确出现该门槛时才认定
    const inRequirements = policy.requirements.some((r) => threshold.pattern.test(r));
    const inContent = threshold.pattern.test(policy.content);
    if (inRequirements || inContent) {
      if (threshold.level > requiredLevel) {
        requiredLevel = threshold.level;
        requiredLabel = threshold.label;
      }
    }
  }

  // 无学历门槛，默认匹配
  if (requiredLevel === 0) {
    return { matched: true, reason: "政策未设学历门槛，所有学历可申请" };
  }

  // 用户学历低于门槛，不匹配
  if (userLevel < requiredLevel) {
    return {
      matched: false,
      reason: `政策要求${requiredLabel}，您的学历（${userEducation}）不满足`,
    };
  }

  return {
    matched: true,
    reason: `政策要求${requiredLabel}，您的学历（${userEducation}）符合`,
  };
}

/**
 * 检查就业状态匹配
 */
function matchEmploymentStatus(
  status: string,
  policy: Policy
): { matched: boolean; reason: string } {
  const rules = EMPLOYMENT_STATUS_RULES[status] || [];

  // 通用政策（不限就业状态）直接通过：
  // 判定依据——政策正文和补贴类型中未出现任何状态关键词
  const allStatusKeywords = [
    "吸纳就业", "就业补贴", "见习", "社保补贴", "求职",
    "技能提升", "培训补贴", "在职", "职工",
    "创业担保贷款", "创业补贴", "创业扶持", "创业", "自主创业",
    "失业保险", "就业援助", "再就业", "就业困难", "失业",
  ];
  const policyText = policy.content + policy.subsidyType + policy.subsidyAmount;
  const hasStatusKeyword = allStatusKeywords.some((kw) => policyText.includes(kw));

  // 未出现任何状态关键词，视为通用政策
  if (!hasStatusKeyword) {
    return { matched: true, reason: "政策未限定就业状态，通用型政策" };
  }

  // 出现状态关键词，则需匹配用户状态对应的规则
  const hit = rules.some((keyword) => policyText.includes(keyword));

  if (hit) {
    return {
      matched: true,
      reason: `政策与您「${status}」的就业状态匹配`,
    };
  }
  return {
    matched: false,
    reason: `政策与您「${status}」的就业状态关联度较低`,
  };
}

/**
 * 检查行业意向匹配（基于关键词映射表，处理语义近似）
 */
function matchIndustryIntent(
  intent: string,
  policy: Policy
): { matched: boolean; score: number; reason: string } {
  if (intent === "不限") {
    return { matched: true, score: 5, reason: "未指定行业意向，给基础分" };
  }

  const keywords = INDUSTRY_KEYWORDS[intent] || [intent];
  const policyText = policy.content + policy.summary + policy.subsidyType;
  const hit = keywords.some((kw) => policyText.includes(kw));

  if (hit) {
    return {
      matched: true,
      score: 10,
      reason: `政策涉及您关注的「${intent}」行业`,
    };
  }
  return {
    matched: false,
    score: 0,
    reason: `政策与您关注的「${intent}」行业无直接关联`,
  };
}

/**
 * 计算推荐优先级
 * - strong: 身份+地域都匹配，且至少 1 个其他维度匹配
 * - normal: 身份+地域都匹配
 * - optional: 仅身份或仅地域匹配
 */
function calculatePriority(
  identityHit: boolean,
  regionHit: boolean,
  otherDimsHitCount: number
): MatchPriority {
  const baseHit = (identityHit ? 1 : 0) + (regionHit ? 1 : 0);
  if (baseHit === 2 && otherDimsHitCount >= 1) return "strong";
  if (baseHit === 2) return "normal";
  return "optional";
}

/**
 * 单条政策匹配
 */
export function matchPolicy(policy: Policy, userProfile: UserProfile): MatchedPolicy | null {
  let score = 0;

  // 1. 身份匹配（权重 40%）
  const identityResult = matchIdentity(userProfile.identity, policy.applicableGroups);
  if (identityResult.matched) {
    score += 40;
  }

  // 2. 地域匹配（权重 25%）
  const regionResult = matchRegion(userProfile.province, policy.regions);
  if (regionResult.matched) {
    score += 25;
  }

  // 3. 学历匹配（权重 15%）
  const educationResult = matchEducation(userProfile.education, policy);
  if (educationResult.matched) {
    score += 15;
  }

  // 4. 就业状态匹配（权重 10%）
  const statusResult = matchEmploymentStatus(userProfile.employmentStatus, policy);
  if (statusResult.matched) {
    score += 10;
  }

  // 5. 行业意向加分（权重 10%）
  const industryResult = matchIndustryIntent(
    userProfile.industryIntent || "不限",
    policy
  );
  score += industryResult.score;

  // 至少身份或地域匹配才保留
  if (!identityResult.matched && !regionResult.matched) {
    return null;
  }

  // 最低匹配分数阈值
  if (score < 30) {
    return null;
  }

  // 构建匹配原因数组（保留原有 matchReasons 字段，向后兼容）
  const matchReasons: string[] = [];
  if (identityResult.matched) matchReasons.push(identityResult.reason);
  if (regionResult.matched) matchReasons.push(regionResult.reason);
  if (educationResult.matched) matchReasons.push(educationResult.reason);
  if (statusResult.matched) matchReasons.push(statusResult.reason);
  if (industryResult.matched && userProfile.industryIntent && userProfile.industryIntent !== "不限") {
    matchReasons.push(industryResult.reason);
  }

  // 构建结构化匹配明细
  const matchBreakdown: MatchBreakdown = {
    identity: { score: identityResult.matched ? 40 : 0, hit: identityResult.matched, reason: identityResult.reason },
    region: { score: regionResult.matched ? 25 : 0, hit: regionResult.matched, reason: regionResult.reason },
    education: { score: educationResult.matched ? 15 : 0, hit: educationResult.matched, reason: educationResult.reason },
    status: { score: statusResult.matched ? 10 : 0, hit: statusResult.matched, reason: statusResult.reason },
    industry: { score: industryResult.score, hit: industryResult.matched, reason: industryResult.reason },
  };

  // 计算推荐优先级
  const otherDimsHitCount =
    (educationResult.matched ? 1 : 0) +
    (statusResult.matched ? 1 : 0) +
    (industryResult.matched ? 1 : 0);
  const priority = calculatePriority(
    identityResult.matched,
    regionResult.matched,
    otherDimsHitCount
  );

  return {
    ...policy,
    matchScore: Math.min(score, 100),
    matchReasons,
    matchBreakdown,
    priority,
    estimatedSubsidy: policy.subsidyAmount || "详见政策原文",
    difficulty: calculateDifficulty(policy),
  };
}

/**
 * 批量匹配政策
 */
export function matchAllPolicies(
  policies: Policy[],
  userProfile: UserProfile
): MatchedPolicy[] {
  const results = policies
    .map((policy) => matchPolicy(policy, userProfile))
    .filter((result): result is MatchedPolicy => result !== null)
    .sort((a, b) => {
      // 优先级高的排前（strong > normal > optional）
      const priorityOrder: Record<MatchPriority, number> = { strong: 0, normal: 1, optional: 2 };
      const pa = a.priority ? priorityOrder[a.priority] : 2;
      const pb = b.priority ? priorityOrder[b.priority] : 2;
      if (pa !== pb) return pa - pb;
      // 同优先级按匹配分排序
      return b.matchScore - a.matchScore;
    });

  return results;
}
