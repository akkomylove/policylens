import { Policy, UserProfile, MatchedPolicy } from "@/types/policy";

/**
 * 个性化推荐引擎
 * 基于用户画像 + 政策数据，推荐用户可能感兴趣但未匹配的政策
 *
 * 推荐策略（基于内容的推荐，非真实协同过滤）：
 * 1. 适用群体与用户身份重叠
 * 2. 地域匹配（全国或用户所在省份）
 * 3. successCount 加权（模拟"同类用户申请数"）
 * 4. 排除已匹配的政策
 *
 * 说明：本推荐基于政策元数据，非真实用户行为数据。
 * 真实协同过滤需接入用户行为日志（埋点数据积累后可升级）。
 */

export interface RecommendedPolicy {
  policy: Policy;
  reason: string;
  score: number;
}

/**
 * 推荐用户可能感兴趣的政策
 * @param allPolicies 全部政策
 * @param matchedPolicies 已匹配的政策
 * @param userProfile 用户画像
 * @param limit 推荐数量上限
 */
export function recommendByUserProfile(
  allPolicies: Policy[],
  matchedPolicies: MatchedPolicy[],
  userProfile: UserProfile,
  limit = 3
): RecommendedPolicy[] {
  const matchedIds = new Set(matchedPolicies.map((p) => p.id));

  const candidates = allPolicies.filter((p) => !matchedIds.has(p.id));

  const scored: RecommendedPolicy[] = candidates.map((policy) => {
    let score = 0;
    const reasons: string[] = [];

    // 1. 适用群体与用户身份重叠
    const identityStr = userProfile.identity;
    const groupOverlap = policy.applicableGroups.filter((g) => {
      return (
        g.includes(identityStr) ||
        identityStr.includes(g) ||
        // 语义近似：应届/往届毕业生都属"高校毕业生"
        (identityStr.includes("毕业生") && g.includes("高校毕业生")) ||
        (identityStr.includes("创业") && g.includes("创业"))
      );
    }).length;

    if (groupOverlap > 0) {
      score += groupOverlap * 15;
      reasons.push(`${userProfile.identity}群体可申请`);
    }

    // 2. 地域匹配
    const regionMatch =
      policy.regions.includes("全国") ||
      policy.regions.includes(userProfile.province) ||
      policy.regions.some((r) => r.includes(userProfile.province));

    if (regionMatch) {
      score += 8;
      if (policy.regions.includes("全国")) {
        reasons.push("全国通用");
      } else {
        reasons.push(`${userProfile.province}地区政策`);
      }
    }

    // 3. 学历匹配
    if (policy.applicableGroups.some((g) => g.includes(userProfile.education))) {
      score += 5;
    }

    // 4. successCount 加权（模拟同类用户申请热度）
    if (policy.successCount && policy.successCount > 0) {
      const hotnessScore = Math.min(policy.successCount / 50, 10);
      score += hotnessScore;
      if (policy.successCount >= 200) {
        reasons.push(`${policy.successCount} 人已申请`);
      }
    }

    // 5. 补贴金额加权（有金额的政策更值得推荐）
    if (policy.subsidyAmount && /万元|元/.test(policy.subsidyAmount)) {
      score += 3;
    }

    return {
      policy,
      score: Math.round(score),
      reason: reasons.slice(0, 2).join("·") || "你可能感兴趣",
    };
  });

  return scored
    .filter((s) => s.score >= 15)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * 基于当前政策的相似政策推荐（用于详情页）
 * 找适用群体和地域重叠多的政策
 */
export function recommendSimilarPolicies(
  allPolicies: Policy[],
  currentPolicy: Policy,
  limit = 3
): RecommendedPolicy[] {
  const candidates = allPolicies.filter(
    (p) => p.id !== currentPolicy.id
  );

  const scored: RecommendedPolicy[] = candidates.map((policy) => {
    let score = 0;
    const reasons: string[] = [];

    // 适用群体重叠
    const groupOverlap = policy.applicableGroups.filter((g) =>
      currentPolicy.applicableGroups.includes(g)
    ).length;

    if (groupOverlap >= 2) {
      score += groupOverlap * 10;
      reasons.push(`同样面向${currentPolicy.applicableGroups.slice(0, 2).join("、")}等群体`);
    } else if (groupOverlap === 1) {
      score += 5;
    }

    // 地域重叠
    const regionOverlap = policy.regions.filter((r) =>
      currentPolicy.regions.includes(r)
    ).length;

    if (regionOverlap > 0) {
      score += 8;
      if (!reasons.length && !policy.regions.includes("全国")) {
        reasons.push(`${policy.regions[0]}地区政策`);
      }
    }

    // 补贴类型相似
    if (
      policy.subsidyType &&
      currentPolicy.subsidyType &&
      policy.subsidyType === currentPolicy.subsidyType
    ) {
      score += 6;
      if (!reasons.length) {
        reasons.push(`同类${policy.subsidyType.split("、")[0]}`);
      }
    }

    // successCount 加权
    if (policy.successCount && policy.successCount > 0) {
      score += Math.min(policy.successCount / 100, 5);
    }

    return {
      policy,
      score: Math.round(score),
      reason: reasons.slice(0, 2).join("·") || "相似政策",
    };
  });

  return scored
    .filter((s) => s.score >= 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
