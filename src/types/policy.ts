// 政策数据类型定义

export interface Policy {
  id: string;
  title: string;
  publishDate: string; // YYYY-MM-DD
  agency: string;
  content: string;
  summary: string;
  applicableGroups: string[];
  subsidyType: string;
  subsidyAmount: string;
  requirements: string[];
  regions: string[];
  sourceUrl: string;
  // 可选：申报截止日期（YYYY-MM-DD）
  deadline?: string;
  // 可选：政策时效状态（由 deadline 计算得出）
  effectiveStatus?: "active" | "expiring" | "expired";
  // V3 新增：同类用户成功申请数（模拟数据）
  successCount?: number;
}

// 用户画像类型
export type IdentityType =
  | "应届毕业生"
  | "往届毕业生"
  | "退役军人"
  | "返乡创业者"
  | "灵活就业人员"
  | "在职人员"
  | "失业人员"
  | "农民工";

export type EducationLevel = "高中及以下" | "大专" | "本科" | "硕士" | "博士";

export type EmploymentStatus = "求职中" | "已就业" | "创业中" | "待业";

export type IndustryIntent =
  | "制造业"
  | "互联网"
  | "农业"
  | "服务业"
  | "金融业"
  | "教育"
  | "医疗"
  | "不限";

export interface UserProfile {
  identity: IdentityType;
  education: EducationLevel;
  province: string;
  city: string;
  employmentStatus: EmploymentStatus;
  industryIntent?: IndustryIntent;
}

// 匹配结果类型
export type DifficultyLevel = "easy" | "medium" | "hard";

// 推荐优先级（分层推荐）
export type MatchPriority = "strong" | "normal" | "optional";

// 单维度匹配明细
export interface MatchBreakdownItem {
  score: number; // 该维度得分
  hit: boolean; // 是否命中
  reason: string; // 具体命中说明
}

// 5 维度匹配明细
export interface MatchBreakdown {
  identity: MatchBreakdownItem;
  region: MatchBreakdownItem;
  education: MatchBreakdownItem;
  status: MatchBreakdownItem;
  industry: MatchBreakdownItem;
}

export interface MatchedPolicy extends Policy {
  matchScore: number; // 0-100
  matchReasons: string[]; // 匹配原因
  matchBreakdown?: MatchBreakdown; // 结构化匹配明细（V2 新增）
  priority?: MatchPriority; // 推荐优先级（V2 新增）
  estimatedSubsidy?: string; // 预估补贴
  difficulty?: DifficultyLevel; // 申请难度
}

export interface MatchResult {
  userProfile: UserProfile;
  matchedPolicies: MatchedPolicy[];
  totalSubsidyEstimate: string;
  summary: string;
}

// AI 解读结果类型
export interface PolicyInterpretation {
  policyId: string;
  whyYou?: string; // 为什么推荐你（V2 新增，基于匹配明细）
  whyNow?: string; // 为什么现在申请（V2 新增，基于时效和优先级）
  plainLanguage: string; // 大白话解读
  whatYouGet: string; // 你能享受什么
  requirements: string[]; // 申请条件
  howToApply: string[]; // 申请步骤（V4 改为数组，旧缓存可能是 string，渲染时兼容）
  estimatedAmount: string; // 预计金额
  // V3 新增：实用性增强字段
  requiredDocuments?: string[]; // 申请材料清单
  applyLocation?: string; // 办理地点
  contactPhone?: string; // 咨询电话
}

// 统计数据类型
export interface StatsData {
  dataSource: string;
  updateTime: string;
  indicators: Array<{
    name: string;
    unit: string;
    yearly: Array<{ year: number; value: number }>;
    description: string;
  }>;
  summary: {
    latestUnemploymentRate: number;
    latestNewJobs: number;
    latestTotalEmployment: number;
    trend: string;
  };
}
