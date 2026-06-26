import { Policy, UserProfile } from "@/types/policy";

/**
 * 政策时效性计算工具
 */

const ONE_DAY = 24 * 60 * 60 * 1000;

/**
 * 根据截止日期计算政策时效状态
 * - active: 距截止日期 > 30 天
 * - expiring: 距截止日期 0-30 天
 * - expired: 已过期
 */
export function calculateEffectiveStatus(
  deadline: string | undefined,
  publishDate: string
): "active" | "expiring" | "expired" {
  if (!deadline) {
    // 无截止日期：基于发布日期 + 1 年作为估算截止日期
    const publishTime = new Date(publishDate).getTime();
    const estimatedDeadline = publishTime + 365 * ONE_DAY;
    const now = Date.now();
    if (now > estimatedDeadline) return "expired";
    if (estimatedDeadline - now < 30 * ONE_DAY) return "expiring";
    return "active";
  }

  const deadlineTime = new Date(deadline).getTime();
  const now = Date.now();

  if (now > deadlineTime) return "expired";
  if (deadlineTime - now < 30 * ONE_DAY) return "expiring";
  return "active";
}

/**
 * 为政策列表批量计算时效状态
 */
export function enrichPoliciesWithStatus(policies: Policy[]): Policy[] {
  return policies.map((p) => ({
    ...p,
    effectiveStatus: calculateEffectiveStatus(p.deadline, p.publishDate),
  }));
}

/**
 * 获取时效标签信息
 */
export function getEffectiveStatusInfo(status: "active" | "expiring" | "expired"): {
  label: string;
  color: string;
  bgColor: string;
} {
  switch (status) {
    case "active":
      return { label: "申报中", color: "#10b981", bgColor: "#d1fae5" };
    case "expiring":
      return { label: "即将截止", color: "#f59e0b", bgColor: "#fef3c7" };
    case "expired":
      return { label: "已过期", color: "#9ca3af", bgColor: "#f3f4f6" };
  }
}

/**
 * V3 新增：计算距离截止日期的天数
 * @param deadline 截止日期字符串（YYYY-MM-DD）
 * @returns 距离截止日期的天数（负数表示已过期），无效日期返回 null
 */
export function getDaysLeft(deadline: string | undefined): number | null {
  if (!deadline) return null;
  const target = new Date(deadline);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - now.getTime()) / ONE_DAY);
}

/**
 * V3 新增：判断 deadline 是否在 N 天内（含已过期）
 * @param deadline 截止日期字符串（YYYY-MM-DD）
 * @param days 天数阈值
 * @returns 是否在 N 天内
 */
export function isDeadlineSoon(
  deadline: string | undefined,
  days: number
): boolean {
  if (!deadline) return false;
  const left = getDaysLeft(deadline);
  return left !== null && left >= 0 && left <= days;
}

/**
 * V3 新增：获取倒计时显示信息
 * @param deadline 截止日期字符串（YYYY-MM-DD）
 * @returns 倒计时显示信息（颜色/文案），无 deadline 或已过期返回 null
 */
export function getCountdownInfo(deadline: string | undefined): {
  daysLeft: number;
  label: string;
  color: string;
  bgColor: string;
} | null {
  const daysLeft = getDaysLeft(deadline);
  if (daysLeft === null || daysLeft < 0) return null;

  if (daysLeft === 0) {
    return {
      daysLeft: 0,
      label: "今日截止",
      color: "#ef4444",
      bgColor: "#fee2e2",
    };
  }
  if (daysLeft <= 7) {
    return {
      daysLeft,
      label: `还剩 ${daysLeft} 天`,
      color: "#ef4444",
      bgColor: "#fee2e2",
    };
  }
  if (daysLeft <= 30) {
    return {
      daysLeft,
      label: `还剩 ${daysLeft} 天`,
      color: "#f59e0b",
      bgColor: "#fef3c7",
    };
  }
  return {
    daysLeft,
    label: `还剩 ${daysLeft} 天`,
    color: "#10b981",
    bgColor: "#d1fae5",
  };
}

/**
 * V5 新增：计算资格窗口期预警
 * 基于用户身份和毕业年份，计算"距失去资格还剩多少天"
 *
 * 规则：
 * - 应届毕业生：毕业满 2 年失去部分政策资格
 * - 往届毕业生：毕业满 5 年失去部分政策资格
 * - 退役军人：退役满 3 年失去部分创业补贴资格
 * - 其他身份：返回 null
 */
export function getEligibilityWindow(
  userProfile: UserProfile,
  policy: Policy
): {
  label: string; // "资格窗口期：还剩 365 天"
  detail: string; // "您将于 2027-06-30 失去应届毕业生身份"
  urgency: "high" | "medium" | "low";
  color: string;
  bgColor: string;
} | null {
  const { identity, graduationYear } = userProfile;

  // 仅对需要毕业年份的身份计算
  if (
    !graduationYear ||
    (identity !== "应届毕业生" && identity !== "往届毕业生")
  ) {
    return null;
  }

  // 检查政策是否针对毕业生（否则不显示窗口期预警）
  const isGraduatePolicy =
    policy.applicableGroups.some((g) =>
      ["应届", "毕业", "高校毕业生", "往届"].some((k) => g.includes(k))
    ) ||
    policy.requirements.some((r) =>
      ["应届", "毕业", "高校毕业生", "往届"].some((k) => r.includes(k))
    );

  if (!isGraduatePolicy) return null;

  // 计算资格失效日期
  const loseYears = identity === "应届毕业生" ? 2 : 5;
  const loseDate = new Date(`${graduationYear + loseYears}-06-30`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor(
    (loseDate.getTime() - now.getTime()) / ONE_DAY
  );

  // 已过期
  if (daysLeft < 0) return null;

  // 计算紧迫度
  let urgency: "high" | "medium" | "low";
  let color: string;
  let bgColor: string;

  if (daysLeft <= 90) {
    urgency = "high";
    color = "#ef4444";
    bgColor = "#fee2e2";
  } else if (daysLeft <= 365) {
    urgency = "medium";
    color = "#f59e0b";
    bgColor = "#fef3c7";
  } else {
    urgency = "low";
    color = "#10b981";
    bgColor = "#d1fae5";
  }

  const loseDateStr = `${graduationYear + loseYears}年6月30日`;
  const identityLabel =
    identity === "应届毕业生" ? "应届毕业生" : "毕业生";

  return {
    label: `资格窗口期：还剩 ${daysLeft} 天`,
    detail: `您将于 ${loseDateStr} 失去${identityLabel}相关政策的申请资格`,
    urgency,
    color,
    bgColor,
  };
}
