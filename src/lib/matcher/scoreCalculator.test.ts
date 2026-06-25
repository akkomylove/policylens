import { describe, it, expect } from "vitest";
import {
  extractSubsidyAmount,
  calculateDifficulty,
  calculateSummary,
  getMatchLevel,
} from "./scoreCalculator";
import type { Policy, MatchedPolicy, UserProfile } from "@/types/policy";

describe("extractSubsidyAmount", () => {
  it("返回 0 当输入为空字符串", () => {
    expect(extractSubsidyAmount("")).toBe(0);
  });

  it("匹配简单 XX万元", () => {
    expect(extractSubsidyAmount("3万元")).toBe(3);
  });

  it("匹配 最高XX万元", () => {
    expect(extractSubsidyAmount("最高5万元")).toBe(5);
  });

  it("匹配 不超过XX万元", () => {
    expect(extractSubsidyAmount("不超过10万元")).toBe(10);
  });

  it("匹配 至多XX万元", () => {
    expect(extractSubsidyAmount("至多8万元")).toBe(8);
  });

  it("匹配 XX万元/年", () => {
    expect(extractSubsidyAmount("2万元/年")).toBe(2);
  });

  it("匹配 XX-XX万元 范围（取最大值）", () => {
    expect(extractSubsidyAmount("3-5万元")).toBe(5);
  });

  it("匹配 XX-XX万元/年 范围（取最大值）", () => {
    expect(extractSubsidyAmount("2-4万元/年")).toBe(4);
  });

  it("排除 万人次（不计入金额）", () => {
    expect(extractSubsidyAmount("惠及3万人次，补贴5万元")).toBe(5);
  });

  it("匹配 XXX元/人", () => {
    expect(extractSubsidyAmount("2000元/人")).toBeCloseTo(0.2, 5);
  });

  it("匹配 XXX-XXX元/人 范围（取最大值）", () => {
    expect(extractSubsidyAmount("1000-3000元/人")).toBeCloseTo(0.3, 5);
  });

  it("匹配 每人XXX元", () => {
    expect(extractSubsidyAmount("每人1500元")).toBeCloseTo(0.15, 5);
  });

  it("匹配 每人XXX-XXX元 范围（取最大值）", () => {
    expect(extractSubsidyAmount("每人2000-5000元")).toBeCloseTo(0.5, 5);
  });

  it("支持千位分隔符（逗号）", () => {
    expect(extractSubsidyAmount("2,000元/人")).toBeCloseTo(0.2, 5);
  });

  it("支持中文逗号千位分隔符", () => {
    expect(extractSubsidyAmount("2，000元/人")).toBeCloseTo(0.2, 5);
  });

  it("兜底匹配 单独 XXX元（>=100 才算补贴）", () => {
    expect(extractSubsidyAmount("补贴500元")).toBeCloseTo(0.05, 5);
  });

  it("兜底过滤 <100 元的数字（非补贴金额）", () => {
    expect(extractSubsidyAmount("工本费30元")).toBe(0);
  });

  it("多金额累加", () => {
    const result = extractSubsidyAmount("最高3万元，另补贴2000元/人");
    // 3万元 + 0.2万元
    expect(result).toBeCloseTo(3.2, 5);
  });

  it("返回 0 当字符串中无任何金额模式", () => {
    expect(extractSubsidyAmount("详见政策原文")).toBe(0);
  });
});

describe("calculateDifficulty", () => {
  const basePolicy: Policy = {
    id: "p1",
    title: "测试政策",
    publishDate: "2024-01-01",
    agency: "测试机构",
    content: "政策内容",
    summary: "测试摘要",
    applicableGroups: ["应届毕业生"],
    subsidyType: "就业补贴",
    subsidyAmount: "3万元",
    requirements: [],
    regions: ["全国"],
    sourceUrl: "",
  };

  it("无 requirements 且无材料关键词 -> easy", () => {
    expect(calculateDifficulty(basePolicy)).toBe("easy");
  });

  it("2 个 requirements 且无线下/材料 -> easy（score<=2）", () => {
    expect(calculateDifficulty({ ...basePolicy, requirements: ["a", "b"] })).toBe("easy");
  });

  it("3 个 requirements 且无线下/材料 -> medium（3<=score<=5）", () => {
    expect(calculateDifficulty({ ...basePolicy, requirements: ["a", "b", "c"] })).toBe("medium");
  });

  it("含线下办理关键词 -> 至少 medium", () => {
    const policy: Policy = {
      ...basePolicy,
      content: "请到户籍地政务服务中心办理",
    };
    expect(calculateDifficulty(policy)).toBe("medium");
  });

  it("含材料证明关键词 -> 至少 medium（材料+线下 OR 材料+多 requirements）", () => {
    // 单独材料关键词加 2 分，需配合其他条件才能达到 medium（3-5 分）
    const policy: Policy = {
      ...basePolicy,
      content: "请到户籍地政务服务中心办理，需提供营业执照复印件",
    };
    // score = 0 (reqCount) + 3 (offline) + 2 (materials) = 5 -> medium
    expect(calculateDifficulty(policy)).toBe("medium");
  });

  it("线下 + 材料 + 多 requirements -> hard（score>5）", () => {
    const policy: Policy = {
      ...basePolicy,
      content: "到窗口办理，需提供营业执照、合同、证明、证书、身份证",
      requirements: ["a", "b", "c"],
    };
    expect(calculateDifficulty(policy)).toBe("hard");
  });
});

describe("calculateSummary", () => {
  const basePolicy: Policy = {
    id: "p1",
    title: "测试政策一",
    publishDate: "2024-01-01",
    agency: "测试机构",
    content: "",
    summary: "",
    applicableGroups: ["应届毕业生"],
    subsidyType: "就业补贴",
    subsidyAmount: "3万元",
    requirements: [],
    regions: ["全国"],
    sourceUrl: "",
  };

  const matched: MatchedPolicy = {
    ...basePolicy,
    matchScore: 80,
    matchReasons: [],
    estimatedSubsidy: "3万元",
  };

  const user: UserProfile = {
    identity: "应届毕业生",
    education: "本科",
    province: "北京",
    city: "北京",
    employmentStatus: "求职中",
  };

  it("统计补贴类型数量", () => {
    const result = calculateSummary([matched], user);
    expect(result.categoryCount["就业补贴"]).toBe(1);
  });

  it("累计补贴金额（>=1万元显示万元单位）", () => {
    const result = calculateSummary([matched], user);
    expect(result.totalSubsidyEstimate).toBe("约 3.0 万元");
  });

  it("排除贷款类金额", () => {
    const loanPolicy: MatchedPolicy = {
      ...matched,
      subsidyType: "创业担保贷款",
      subsidyAmount: "最高30万元贷款",
    };
    const result = calculateSummary([loanPolicy], user);
    expect(result.totalSubsidyEstimate).toBe("详见各项政策");
  });

  it("摘要中包含匹配数量和用户画像", () => {
    const result = calculateSummary([matched], user);
    expect(result.summary).toContain("1 条");
    expect(result.summary).toContain("应届毕业生");
    expect(result.summary).toContain("测试政策一");
  });
});

describe("getMatchLevel", () => {
  it("score>=80 -> 高度匹配", () => {
    expect(getMatchLevel(80).level).toBe("high");
    expect(getMatchLevel(80).label).toBe("高度匹配");
  });

  it("60<=score<80 -> 中度匹配", () => {
    expect(getMatchLevel(60).level).toBe("medium");
  });

  it("40<=score<60 -> 基本匹配", () => {
    expect(getMatchLevel(40).level).toBe("low");
  });

  it("score<40 -> 弱匹配", () => {
    expect(getMatchLevel(30).level).toBe("minimal");
  });
});
