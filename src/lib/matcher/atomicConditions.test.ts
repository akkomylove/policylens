import { describe, it, expect } from "vitest";
import {
  evaluateAtomicConditions,
  adjustScoreByConditions,
  adjustPriorityByConditions,
  generateAtomicConditions,
} from "./atomicConditions";
import type { Policy, UserProfile, AtomicCondition } from "@/types/policy";

const baseUser: UserProfile = {
  identity: "应届毕业生",
  education: "本科",
  province: "北京",
  city: "北京",
  employmentStatus: "求职中",
};

describe("evaluateAtomicConditions", () => {
  it("返回 null 当 conditions 为 undefined", () => {
    expect(evaluateAtomicConditions(undefined, baseUser)).toBeNull();
  });

  it("返回 null 当 conditions 为空数组", () => {
    expect(evaluateAtomicConditions([], baseUser)).toBeNull();
  });

  it("统计 satisfiedCount / requiredSatisfiedCount / totalRequired", () => {
    const conditions: AtomicCondition[] = [
      { id: "c1", category: "identity", label: "应届", operator: "eq", value: "应届毕业生", required: true, userField: "identity" },
      { id: "c2", category: "education", label: "本科", operator: "in", value: ["本科", "硕士", "博士"], required: false, userField: "education" },
    ];
    const result = evaluateAtomicConditions(conditions, baseUser);
    expect(result).not.toBeNull();
    expect(result!.totalConditions).toBe(2);
    expect(result!.totalRequired).toBe(1);
    expect(result!.satisfiedCount).toBe(2);
    expect(result!.requiredSatisfiedCount).toBe(1);
    expect(result!.allRequiredMet).toBe(true);
  });

  it("allRequiredMet=false 当核心条件未满足", () => {
    const conditions: AtomicCondition[] = [
      { id: "c1", category: "identity", label: "在职人员", operator: "eq", value: "在职人员", required: true, userField: "identity" },
    ];
    const result = evaluateAtomicConditions(conditions, baseUser);
    expect(result!.allRequiredMet).toBe(false);
    expect(result!.requiredSatisfiedCount).toBe(0);
  });

  it("gapText='全部条件符合' 当所有条件通过", () => {
    const conditions: AtomicCondition[] = [
      { id: "c1", category: "identity", label: "应届", operator: "eq", value: "应届毕业生", required: true, userField: "identity" },
    ];
    const result = evaluateAtomicConditions(conditions, baseUser);
    expect(result!.gapText).toBe("全部条件符合");
  });

  it("gapText 提示未满足核心条件", () => {
    const conditions: AtomicCondition[] = [
      { id: "c1", category: "identity", label: "在职人员", operator: "eq", value: "在职人员", required: true, userField: "identity" },
    ];
    const result = evaluateAtomicConditions(conditions, baseUser);
    expect(result!.gapText).toContain("不符合核心条件");
    expect(result!.gapText).toContain("在职人员");
  });

  it("gapText 提示未满足可选条件", () => {
    const conditions: AtomicCondition[] = [
      { id: "c1", category: "age", label: "年龄<35岁", operator: "lt", value: 35, required: false, userField: "age" },
    ];
    const result = evaluateAtomicConditions(conditions, baseUser);
    // 用户未提供 age，应未通过
    expect(result!.gapText).toContain("还差");
    expect(result!.gapText).toContain("年龄<35岁");
  });
});

describe("evaluateAtomicConditions - 操作符覆盖", () => {
  it("operator=eq 字符串语义匹配（含别名）", () => {
    // 用户填"应届毕业生"，条件值"高校毕业生"——别名匹配
    const conditions: AtomicCondition[] = [
      { id: "c1", category: "identity", label: "高校毕业生", operator: "eq", value: "高校毕业生", required: true, userField: "identity" },
    ];
    const result = evaluateAtomicConditions(conditions, baseUser);
    expect(result!.satisfiedCount).toBe(1);
  });

  it("operator=eq 数字相等", () => {
    const user: UserProfile = { ...baseUser, age: 30 };
    const conditions: AtomicCondition[] = [
      { id: "c1", category: "age", label: "30岁", operator: "eq", value: 30, required: true, userField: "age" },
    ];
    const result = evaluateAtomicConditions(conditions, user);
    expect(result!.satisfiedCount).toBe(1);
  });

  it("operator=lt 严格小于", () => {
    const user: UserProfile = { ...baseUser, age: 30 };
    expect(
      evaluateAtomicConditions(
        [{ id: "c1", category: "age", label: "<35", operator: "lt", value: 35, required: true, userField: "age" }],
        user
      )!.satisfiedCount
    ).toBe(1);
    expect(
      evaluateAtomicConditions(
        [{ id: "c1", category: "age", label: "<30", operator: "lt", value: 30, required: true, userField: "age" }],
        user
      )!.satisfiedCount
    ).toBe(0);
  });

  it("operator=lte 小于等于", () => {
    const user: UserProfile = { ...baseUser, age: 30 };
    expect(
      evaluateAtomicConditions(
        [{ id: "c1", category: "age", label: "<=30", operator: "lte", value: 30, required: true, userField: "age" }],
        user
      )!.satisfiedCount
    ).toBe(1);
  });

  it("operator=gt 严格大于", () => {
    const user: UserProfile = { ...baseUser, age: 30 };
    expect(
      evaluateAtomicConditions(
        [{ id: "c1", category: "age", label: ">25", operator: "gt", value: 25, required: true, userField: "age" }],
        user
      )!.satisfiedCount
    ).toBe(1);
  });

  it("operator=gte 大于等于", () => {
    const user: UserProfile = { ...baseUser, age: 30 };
    expect(
      evaluateAtomicConditions(
        [{ id: "c1", category: "age", label: ">=30", operator: "gte", value: 30, required: true, userField: "age" }],
        user
      )!.satisfiedCount
    ).toBe(1);
  });

  it("operator=in 数组中任一匹配", () => {
    const conditions: AtomicCondition[] = [
      { id: "c1", category: "education", label: "本科及以上", operator: "in", value: ["本科", "硕士", "博士"], required: true, userField: "education" },
    ];
    expect(evaluateAtomicConditions(conditions, baseUser)!.satisfiedCount).toBe(1);
  });

  it("operator=contains 字符串包含", () => {
    const user: UserProfile = { ...baseUser, province: "广东省深圳市" };
    const conditions: AtomicCondition[] = [
      { id: "c1", category: "region", label: "深圳", operator: "contains", value: "深圳", required: true, userField: "province" },
    ];
    expect(evaluateAtomicConditions(conditions, user)!.satisfiedCount).toBe(1);
  });

  it("operator=range 闭区间", () => {
    const user: UserProfile = { ...baseUser, age: 30 };
    const conditions: AtomicCondition[] = [
      { id: "c1", category: "age", label: "18-35", operator: "range", value: [18, 35], required: true, userField: "age" },
    ];
    expect(evaluateAtomicConditions(conditions, user)!.satisfiedCount).toBe(1);
    const young: UserProfile = { ...baseUser, age: 17 };
    expect(evaluateAtomicConditions(conditions, young)!.satisfiedCount).toBe(0);
  });

  it("学历 operator=in 比较等级（用户学历 >= 最低要求）", () => {
    const conditions: AtomicCondition[] = [
      { id: "c1", category: "education", label: "本科及以上", operator: "in", value: ["本科", "硕士", "博士"], required: true, userField: "education" },
    ];
    // 用户本科
    expect(evaluateAtomicConditions(conditions, baseUser)!.satisfiedCount).toBe(1);
    // 用户大专——不满足本科及以上
    const collegeUser: UserProfile = { ...baseUser, education: "大专" };
    expect(evaluateAtomicConditions(conditions, collegeUser)!.satisfiedCount).toBe(0);
  });

  it("用户字段缺失 -> 返回 gap 提示", () => {
    const conditions: AtomicCondition[] = [
      { id: "c1", category: "age", label: "年龄<35岁", operator: "lt", value: 35, required: true, userField: "age" },
    ];
    const result = evaluateAtomicConditions(conditions, baseUser);
    expect(result!.results[0].passed).toBe(false);
    expect(result!.results[0].gap).toContain("未提供");
  });
});

describe("evaluateAtomicConditions - 毕业年份特殊逻辑（V5.1 修复）", () => {
  it("应届毕业生身份 -> 毕业年份条件自动通过", () => {
    const conditions: AtomicCondition[] = [
      {
        id: "c1",
        category: "graduationYear",
        label: "毕业2年内",
        operator: "gte",
        value: new Date().getFullYear() - 2,
        required: false,
        userField: "graduationYear",
      },
    ];
    const result = evaluateAtomicConditions(conditions, baseUser);
    expect(result!.results[0].passed).toBe(true);
    expect(result!.results[0].actualValue).toContain("应届毕业生");
  });

  it("往届毕业生 + 已填毕业年份 + 满足条件 -> 通过", () => {
    const user: UserProfile = {
      ...baseUser,
      identity: "往届毕业生",
      graduationYear: new Date().getFullYear() - 1,
    };
    const conditions: AtomicCondition[] = [
      {
        id: "c1",
        category: "graduationYear",
        label: "毕业2年内",
        operator: "gte",
        value: new Date().getFullYear() - 2,
        required: false,
        userField: "graduationYear",
      },
    ];
    const result = evaluateAtomicConditions(conditions, user);
    expect(result!.results[0].passed).toBe(true);
  });

  it("往届毕业生 + 未填毕业年份 -> 不通过且提示填写", () => {
    const user: UserProfile = { ...baseUser, identity: "往届毕业生" };
    const conditions: AtomicCondition[] = [
      {
        id: "c1",
        category: "graduationYear",
        label: "毕业2年内",
        operator: "gte",
        value: new Date().getFullYear() - 2,
        required: true,
        userField: "graduationYear",
      },
    ];
    const result = evaluateAtomicConditions(conditions, user);
    expect(result!.results[0].passed).toBe(false);
    expect(result!.results[0].gap).toContain("填写毕业年份");
  });

  it("非应届/往届身份 -> 毕业年份条件不适用", () => {
    const user: UserProfile = { ...baseUser, identity: "在职人员" };
    const conditions: AtomicCondition[] = [
      {
        id: "c1",
        category: "graduationYear",
        label: "毕业2年内",
        operator: "gte",
        value: new Date().getFullYear() - 2,
        required: false,
        userField: "graduationYear",
      },
    ];
    const result = evaluateAtomicConditions(conditions, user);
    expect(result!.results[0].passed).toBe(false);
    expect(result!.results[0].gap).toContain("非毕业生身份");
  });
});

describe("adjustScoreByConditions", () => {
  it("evaluation=null 时返回原分数", () => {
    expect(adjustScoreByConditions(70, null)).toBe(70);
  });

  it("核心条件未满足时降分（每个未满足项 -15）", () => {
    const evaluation = {
      results: [],
      satisfiedCount: 1,
      requiredSatisfiedCount: 1,
      totalRequired: 3,
      totalConditions: 3,
      gapText: "",
      allRequiredMet: false,
    };
    // 缺 2 个核心条件 -> -30
    expect(adjustScoreByConditions(80, evaluation)).toBe(50);
  });

  it("核心条件全满足 + 满足可选条件 -> 加分", () => {
    const evaluation = {
      results: [],
      satisfiedCount: 4,
      requiredSatisfiedCount: 2,
      totalRequired: 2,
      totalConditions: 4,
      gapText: "",
      allRequiredMet: true,
    };
    // 可选 2 个全满足 -> ratio=1 -> +10
    expect(adjustScoreByConditions(70, evaluation)).toBe(80);
  });

  it("加分上限 100", () => {
    const evaluation = {
      results: [],
      satisfiedCount: 4,
      requiredSatisfiedCount: 2,
      totalRequired: 2,
      totalConditions: 4,
      gapText: "",
      allRequiredMet: true,
    };
    expect(adjustScoreByConditions(95, evaluation)).toBe(100);
  });

  it("降分下限 0", () => {
    const evaluation = {
      results: [],
      satisfiedCount: 0,
      requiredSatisfiedCount: 0,
      totalRequired: 5,
      totalConditions: 5,
      gapText: "",
      allRequiredMet: false,
    };
    expect(adjustScoreByConditions(10, evaluation)).toBe(0);
  });
});

describe("adjustPriorityByConditions", () => {
  it("evaluation=null 时返回原优先级", () => {
    expect(adjustPriorityByConditions("strong", null)).toBe("strong");
  });

  it("核心条件未满足 -> 降为 optional", () => {
    const evaluation = {
      results: [],
      satisfiedCount: 0,
      requiredSatisfiedCount: 0,
      totalRequired: 2,
      totalConditions: 2,
      gapText: "",
      allRequiredMet: false,
    };
    expect(adjustPriorityByConditions("strong", evaluation)).toBe("optional");
  });

  it("核心条件全满足 + 满足比例>=80% -> 提升为 strong", () => {
    const evaluation = {
      results: [],
      satisfiedCount: 4,
      requiredSatisfiedCount: 2,
      totalRequired: 2,
      totalConditions: 4,
      gapText: "",
      allRequiredMet: true,
    };
    expect(adjustPriorityByConditions("normal", evaluation)).toBe("strong");
  });

  it("核心条件全满足 + 比例<80% -> 保持原优先级", () => {
    const evaluation = {
      results: [],
      satisfiedCount: 2,
      requiredSatisfiedCount: 2,
      totalRequired: 2,
      totalConditions: 4,
      gapText: "",
      allRequiredMet: true,
    };
    // 比例 2/4 = 50%
    expect(adjustPriorityByConditions("normal", evaluation)).toBe("normal");
  });
});

describe("generateAtomicConditions", () => {
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

  it("为 applicableGroups 生成身份条件（required=true）", () => {
    const conditions = generateAtomicConditions(basePolicy);
    const identityCondition = conditions.find((c) => c.category === "identity");
    expect(identityCondition).toBeDefined();
    expect(identityCondition!.required).toBe(true);
  });

  it("全国性政策不生成地域条件", () => {
    const conditions = generateAtomicConditions(basePolicy);
    expect(conditions.find((c) => c.category === "region")).toBeUndefined();
  });

  it("非全国政策生成地域条件", () => {
    const policy: Policy = { ...basePolicy, regions: ["北京"] };
    const conditions = generateAtomicConditions(policy);
    expect(conditions.find((c) => c.category === "region")).toBeDefined();
  });

  it("从 content 中识别学历门槛", () => {
    const policy: Policy = { ...basePolicy, content: "要求本科及以上学历" };
    const conditions = generateAtomicConditions(policy);
    const edu = conditions.find((c) => c.category === "education");
    expect(edu).toBeDefined();
    expect(edu!.label).toContain("本科及以上");
  });

  it("从 content 中识别年龄条件", () => {
    const policy: Policy = { ...basePolicy, content: "年龄35岁以下" };
    const conditions = generateAtomicConditions(policy);
    const age = conditions.find((c) => c.category === "age");
    expect(age).toBeDefined();
    expect(age!.value).toBe(35);
  });

  it("从 content 中识别社保条件", () => {
    const policy: Policy = { ...basePolicy, content: "社保满6个月" };
    const conditions = generateAtomicConditions(policy);
    const ss = conditions.find((c) => c.category === "socialSecurity");
    expect(ss).toBeDefined();
    expect(ss!.value).toBe(6);
  });

  it("应届生政策生成毕业年份条件", () => {
    const conditions = generateAtomicConditions(basePolicy);
    const grad = conditions.find((c) => c.category === "graduationYear");
    expect(grad).toBeDefined();
    expect(grad!.required).toBe(false);
  });
});
