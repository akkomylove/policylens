import {
  AtomicCondition,
  ConditionResult,
  ConditionEvaluation,
  UserProfile,
  Policy,
} from "@/types/policy";

/**
 * V5 政策要素颗粒化匹配引擎
 * 把政策条件拆为原子条件，逐条评估并生成"差几条"提示
 */

// 学历等级映射（用于比较）
const EDUCATION_LEVELS: Record<string, number> = {
  高中及以下: 1,
  大专: 2,
  本科: 3,
  硕士: 4,
  博士: 5,
};

// 语义别名映射（处理"自主创业"vs"个体经营"等近义词）
const SEMANTIC_ALIASES: Record<string, Record<string, string[]>> = {
  identity: {
    应届毕业生: ["应届", "毕业年度", "高校毕业生", "毕业生"],
    往届毕业生: ["往届", "离校", "未就业高校毕业生"],
    退役军人: ["退伍", "转业", "军人"],
    返乡创业者: ["返乡", "返乡入乡", "创业", "自主创业"],
    创业者: ["创业", "自主创业", "个体经营", "初创企业"],
    灵活就业人员: ["灵活就业", "新就业形态"],
    在职人员: ["企业职工", "职工", "参保人员", "在职"],
    企业职工: ["企业职工", "职工", "参保人员", "在职"],
    失业人员: ["失业", "就业困难人员", "登记失业"],
    就业困难人员: ["就业困难", "登记失业", "失业"],
    农民工: ["农村劳动力", "进城务工"],
    残疾人: ["残疾", "残疾人"],
    返乡入乡人员: ["返乡", "入乡", "返乡入乡"],
  },
  status: {
    求职中: ["吸纳就业", "就业补贴", "见习", "求职"],
    已就业: ["技能提升", "培训补贴", "在职", "职工"],
    创业中: ["创业担保贷款", "创业补贴", "创业扶持", "自主创业"],
    待业: ["失业保险", "就业援助", "再就业", "就业困难"],
    灵活就业: ["灵活就业", "新就业形态", "平台经济"],
    退休: ["退休", "离退休"],
  },
};

/**
 * 语义归一化：判断用户值是否匹配条件值（考虑别名）
 */
function semanticMatch(
  userValue: string,
  conditionValue: string,
  category: string
): boolean {
  // 精确匹配
  if (userValue === conditionValue) return true;
  // 包含关系
  if (userValue.includes(conditionValue) || conditionValue.includes(userValue))
    return true;
  // 语义别名匹配
  const aliases = SEMANTIC_ALIASES[category];
  if (aliases) {
    for (const [canonical, synonyms] of Object.entries(aliases)) {
      const userIsCanonical =
        userValue === canonical ||
        synonyms.some((s) => userValue.includes(s));
      const conditionIsCanonical =
        conditionValue === canonical ||
        synonyms.some((s) => conditionValue.includes(s));
      if (userIsCanonical && conditionIsCanonical) return true;
    }
  }
  return false;
}

/**
 * 获取用户画像字段值
 */
function getUserFieldValue(
  userField: string,
  userProfile: UserProfile
): string | number | undefined {
  switch (userField) {
    case "identity":
      return userProfile.identity;
    case "education":
      return userProfile.education;
    case "province":
      return userProfile.province;
    case "city":
      return userProfile.city;
    case "employmentStatus":
      return userProfile.employmentStatus;
    case "industryIntent":
      return userProfile.industryIntent;
    case "age":
      return userProfile.age;
    case "graduationYear":
      return userProfile.graduationYear;
    case "socialSecurityMonths":
      return userProfile.socialSecurityMonths;
    default:
      return undefined;
  }
}

/**
 * 评估单个原子条件
 */
function evaluateCondition(
  condition: AtomicCondition,
  userProfile: UserProfile
): ConditionResult {
  // V5.1 修复：毕业年份条件的特殊处理
  // 如果政策要求"毕业2年内的应届毕业生"，而用户身份已是"应届毕业生"，
  // 则自动通过（"应届"本身即意味着毕业2年内），避免误判为差条件
  if (
    condition.category === "graduationYear" &&
    condition.userField === "graduationYear"
  ) {
    // 用户身份是应届毕业生，自动满足"毕业N年内"条件
    if (userProfile.identity === "应届毕业生") {
      return {
        condition,
        passed: true,
        actualValue: "应届毕业生（默认满足）",
        gap: undefined,
      };
    }
    // 用户身份是往届毕业生，根据实际毕业年份判断（如果填了的话）
    if (userProfile.identity === "往届毕业生") {
      const gradYear = userProfile.graduationYear;
      if (gradYear === undefined || gradYear === null) {
        // 往届毕业生未填年份，提示需要填写
        return {
          condition,
          passed: false,
          actualValue: undefined,
          gap: condition.required
            ? `需要${condition.label}（请在画像中填写毕业年份）`
            : `可选：${condition.label}（建议填写毕业年份以精确判断）`,
        };
      }
      // 根据条件 operator 判断
      const threshold = Number(condition.value);
      let passed = false;
      switch (condition.operator) {
        case "gte": passed = gradYear >= threshold; break;
        case "gt": passed = gradYear > threshold; break;
        case "lte": passed = gradYear <= threshold; break;
        case "lt": passed = gradYear < threshold; break;
        case "eq": passed = gradYear === threshold; break;
        default: passed = gradYear >= threshold;
      }
      return {
        condition,
        passed,
        actualValue: `${gradYear}年毕业`,
        gap: passed
          ? undefined
          : condition.required
            ? `不符合：${condition.label}（毕业年份${gradYear}）`
            : `可选未满足：${condition.label}（毕业年份${gradYear}）`,
      };
    }
    // 其他身份（非应届/往届），此条件不适用
    return {
      condition,
      passed: false,
      actualValue: undefined,
      gap: `可选未满足：${condition.label}（非毕业生身份）`,
    };
  }

  const userValue = condition.userField
    ? getUserFieldValue(condition.userField, userProfile)
    : undefined;

  // 用户未提供该字段值
  if (userValue === undefined || userValue === null) {
    return {
      condition,
      passed: false,
      actualValue: undefined,
      gap: condition.required
        ? `需要${condition.label}（未提供）`
        : `可选：${condition.label}（未提供）`,
    };
  }

  let passed = false;
  const actualValue = userValue;

  switch (condition.operator) {
    case "eq":
      passed =
        typeof condition.value === "string"
          ? semanticMatch(
              String(userValue),
              condition.value,
              condition.category
            )
          : Number(userValue) === Number(condition.value);
      break;
    case "in":
      if (Array.isArray(condition.value)) {
        passed = condition.value.some(
          (v) =>
            typeof v === "string"
              ? semanticMatch(String(userValue), v, condition.category)
              : Number(userValue) === Number(v)
        );
      }
      break;
    case "lt":
      passed = Number(userValue) < Number(condition.value);
      break;
    case "lte":
      passed = Number(userValue) <= Number(condition.value);
      break;
    case "gt":
      passed = Number(userValue) > Number(condition.value);
      break;
    case "gte":
      passed = Number(userValue) >= Number(condition.value);
      break;
    case "contains":
      passed = String(userValue).includes(String(condition.value));
      break;
    case "range":
      // value 格式：[min, max]
      if (Array.isArray(condition.value) && condition.value.length === 2) {
        const [min, max] = condition.value.map(Number);
        passed =
          Number(userValue) >= min && Number(userValue) <= max;
      }
      break;
  }

  // 学历特殊处理：比较等级
  if (condition.category === "education" && condition.operator === "in") {
    const userLevel = EDUCATION_LEVELS[String(userValue)] || 0;
    const requiredLevels = (condition.value as string[]).map(
      (v) => EDUCATION_LEVELS[v] || 0
    );
    const minRequired = Math.min(...requiredLevels);
    passed = userLevel >= minRequired;
  }

  return {
    condition,
    passed,
    actualValue,
    gap: passed
      ? undefined
      : condition.required
        ? `不符合：${condition.label}（当前：${actualValue}）`
        : `可选未满足：${condition.label}`,
  };
}

/**
 * 批量评估原子条件
 */
export function evaluateAtomicConditions(
  conditions: AtomicCondition[] | undefined,
  userProfile: UserProfile
): ConditionEvaluation | null {
  if (!conditions || conditions.length === 0) return null;

  const results = conditions.map((c) => evaluateCondition(c, userProfile));
  const satisfiedCount = results.filter((r) => r.passed).length;
  const requiredResults = results.filter((r) => r.condition.required);
  const requiredSatisfiedCount = requiredResults.filter(
    (r) => r.passed
  ).length;
  const totalRequired = requiredResults.length;
  const allRequiredMet = requiredSatisfiedCount === totalRequired;

  // 生成 gapText
  const failedRequired = results.filter(
    (r) => !r.passed && r.condition.required
  );
  const failedOptional = results.filter(
    (r) => !r.passed && !r.condition.required
  );

  let gapText = "";
  if (failedRequired.length === 0 && failedOptional.length === 0) {
    gapText = "全部条件符合";
  } else if (failedRequired.length > 0) {
    const labels = failedRequired.map((r) => r.condition.label).slice(0, 3);
    gapText = `不符合核心条件：${labels.join("、")}${
      failedRequired.length > 3 ? ` 等 ${failedRequired.length} 项` : ""
    }`;
  } else {
    const labels = failedOptional.map((r) => r.condition.label).slice(0, 3);
    gapText = `还差 ${failedOptional.length} 个可选条件：${labels.join("、")}${
      failedOptional.length > 3 ? ` 等` : ""
    }`;
  }

  return {
    results,
    satisfiedCount,
    requiredSatisfiedCount,
    totalRequired,
    totalConditions: conditions.length,
    gapText,
    allRequiredMet,
  };
}

/**
 * 基于原子条件评估调整匹配分数
 * - allRequiredMet 为 false 时，降权（减分）
 * - 满足比例越高，加分越多
 */
export function adjustScoreByConditions(
  baseScore: number,
  evaluation: ConditionEvaluation | null
): number {
  if (!evaluation) return baseScore;

  // 核心条件未满足，大幅降分
  if (!evaluation.allRequiredMet) {
    const missingRequired = evaluation.totalRequired - evaluation.requiredSatisfiedCount;
    return Math.max(0, baseScore - missingRequired * 15);
  }

  // 核心条件全满足，按满足比例加分
  const optionalTotal = evaluation.totalConditions - evaluation.totalRequired;
  if (optionalTotal > 0) {
    const optionalSatisfied =
      evaluation.satisfiedCount - evaluation.requiredSatisfiedCount;
    const ratio = optionalSatisfied / optionalTotal;
    return Math.min(100, baseScore + Math.round(ratio * 10));
  }

  return baseScore;
}

/**
 * 基于原子条件评估调整优先级
 * - allRequiredMet 为 false 时，优先级降为 optional
 * - allRequiredMet 为 true 且满足比例高时，保持或提升优先级
 */
export function adjustPriorityByConditions(
  basePriority: "strong" | "normal" | "optional",
  evaluation: ConditionEvaluation | null
): "strong" | "normal" | "optional" {
  if (!evaluation) return basePriority;

  if (!evaluation.allRequiredMet) {
    return "optional";
  }

  // 核心条件全满足，满足比例 >= 80% 提升为 strong
  const ratio =
    evaluation.totalConditions > 0
      ? evaluation.satisfiedCount / evaluation.totalConditions
      : 1;
  if (ratio >= 0.8 && basePriority !== "optional") {
    return "strong";
  }

  return basePriority;
}

/**
 * 为政策自动生成原子条件（当政策数据未提供 atomicConditions 时）
 * 基于政策的 applicableGroups、requirements、content 推断
 */
export function generateAtomicConditions(policy: Policy): AtomicCondition[] {
  const conditions: AtomicCondition[] = [];

  // 1. 身份条件（基于 applicableGroups）
  if (policy.applicableGroups.length > 0) {
    conditions.push({
      id: `${policy.id}_identity`,
      category: "identity",
      label: `身份为：${policy.applicableGroups.slice(0, 3).join("或")}`,
      operator: "in",
      value: policy.applicableGroups.slice(0, 5),
      required: true,
      userField: "identity",
    });
  }

  // 2. 地域条件（基于 regions）
  if (policy.regions.length > 0 && !policy.regions.includes("全国")) {
    conditions.push({
      id: `${policy.id}_region`,
      category: "region",
      label: `所在地区：${policy.regions.slice(0, 2).join("或")}`,
      operator: "in",
      value: policy.regions,
      required: true,
      userField: "province",
    });
  }

  // 3. 学历条件（从 requirements 和 content 中推断）
  const educationPatterns: Array<{
    pattern: RegExp;
    level: string;
    label: string;
  }> = [
    { pattern: /博士/, level: "博士", label: "博士" },
    { pattern: /硕士|研究生/, level: "硕士", label: "硕士及以上" },
    { pattern: /本科及以上|高校毕业/, level: "本科", label: "本科及以上" },
    { pattern: /大专及以上|高职/, level: "大专", label: "大专及以上" },
  ];
  for (const { pattern, level, label } of educationPatterns) {
    const inRequirements = policy.requirements.some((r) => pattern.test(r));
    const inContent = pattern.test(policy.content);
    if (inRequirements || inContent) {
      conditions.push({
        id: `${policy.id}_education`,
        category: "education",
        label,
        operator: "in",
        value: [level, "硕士", "博士"].filter(
          (v) => EDUCATION_LEVELS[v] >= EDUCATION_LEVELS[level]
        ),
        required: false,
        userField: "education",
      });
      break;
    }
  }

  // 4. 年龄条件（从 content 中推断）
  const ageMatch = policy.content.match(/(\d+)岁(?:以下|以内|以下)/);
  if (ageMatch) {
    const ageLimit = parseInt(ageMatch[1]);
    conditions.push({
      id: `${policy.id}_age`,
      category: "age",
      label: `年龄<${ageLimit}岁`,
      operator: "lt",
      value: ageLimit,
      required: false,
      userField: "age",
    });
  }

  // 5. 社保条件（从 content 中推断）
  const socialSecurityMatch = policy.content.match(
    /社保.*?(\d+)(?:个)?月|参保.*?(\d+)(?:个)?月/
  );
  if (socialSecurityMatch) {
    const months = parseInt(socialSecurityMatch[1] || socialSecurityMatch[2]);
    conditions.push({
      id: `${policy.id}_social_security`,
      category: "socialSecurity",
      label: `社保满${months}个月`,
      operator: "gte",
      value: months,
      required: false,
      userField: "socialSecurityMonths",
    });
  }

  // 6. 毕业年份条件（应届毕业生政策）
  if (
    policy.applicableGroups.some((g) =>
      ["应届", "毕业年度", "高校毕业生"].some((k) => g.includes(k))
    )
  ) {
    conditions.push({
      id: `${policy.id}_graduation_year`,
      category: "graduationYear",
      label: "毕业2年内的应届毕业生",
      operator: "gte",
      value: new Date().getFullYear() - 2,
      required: false,
      userField: "graduationYear",
    });
  }

  return conditions;
}
