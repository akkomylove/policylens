import { Policy, StatsData } from "@/types/policy";

/**
 * 政策数据加载器
 * 从 public/data/ 加载静态数据文件
 */

let policiesCache: Policy[] | null = null;
let statsCache: StatsData | null = null;

/**
 * 加载政策数据
 */
export async function loadPolicies(): Promise<Policy[]> {
  if (policiesCache) return policiesCache;

  try {
    const response = await fetch("/data/policies.json");
    if (!response.ok) {
      throw new Error(`Failed to load policies: ${response.status}`);
    }
    const data = await response.json();
    policiesCache = data as Policy[];
    return policiesCache;
  } catch (error) {
    console.error("加载政策数据失败:", error);
    return [];
  }
}

/**
 * 加载统计数据
 */
export async function loadStats(): Promise<StatsData | null> {
  if (statsCache) return statsCache;

  try {
    const response = await fetch("/data/stats.json");
    if (!response.ok) {
      throw new Error(`Failed to load stats: ${response.status}`);
    }
    const data = await response.json();
    statsCache = data as StatsData;
    return statsCache;
  } catch (error) {
    console.error("加载统计数据失败:", error);
    return null;
  }
}

/**
 * 获取省份列表（从政策数据中提取）
 */
export function getProvinces(policies: Policy[]): string[] {
  const provinceSet = new Set<string>();
  const chinaProvinces = [
    "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江",
    "上海", "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南",
    "湖北", "湖南", "广东", "广西", "海南", "重庆", "四川", "贵州",
    "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆",
  ];

  // 从政策数据中提取涉及的省份
  for (const policy of policies) {
    for (const region of policy.regions) {
      if (region !== "全国") {
        for (const province of chinaProvinces) {
          if (region.includes(province)) {
            provinceSet.add(province);
          }
        }
      }
    }
  }

  // 确保所有省份都在列表中
  for (const province of chinaProvinces) {
    provinceSet.add(province);
  }

  return Array.from(provinceSet).sort();
}
