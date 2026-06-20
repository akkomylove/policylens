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
export interface MatchedPolicy extends Policy {
  matchScore: number; // 0-100
  matchReasons: string[]; // 匹配原因
  estimatedSubsidy?: string; // 预估补贴
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
  plainLanguage: string; // 大白话解读
  whatYouGet: string; // 你能享受什么
  requirements: string[]; // 申请条件
  howToApply: string; // 申请路径
  estimatedAmount: string; // 预计金额
}

// 统计数据类型
export interface StatsData {
  indicators: Array<{
    name: string;
    value: string;
    unit: string;
    year: string;
    trend?: string;
  }>;
}
