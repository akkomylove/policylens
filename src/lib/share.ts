import { UserProfile } from "@/types/policy";

/**
 * 用户画像分享工具
 * 将 userProfile 编码为 URL query string，支持生成分享链接
 */

const FIELD_ORDER: Array<keyof UserProfile> = [
  "identity",
  "education",
  "province",
  "city",
  "employmentStatus",
  "industryIntent",
];

/**
 * 将 userProfile 编码为 base64 字符串
 */
export function encodeUserProfile(profile: UserProfile): string {
  // 仅编码关键字段，保持 URL 简短
  const compact: Record<string, string> = {};
  for (const field of FIELD_ORDER) {
    const value = profile[field];
    if (value) {
      compact[field] = value;
    }
  }
  const json = JSON.stringify(compact);
  // 使用 base64 编码（浏览器环境）
  if (typeof window !== "undefined") {
    return btoa(encodeURIComponent(json));
  }
  // Node 环境 fallback
  return Buffer.from(json, "utf-8").toString("base64");
}

/**
 * 从 base64 字符串解码 userProfile
 */
export function decodeUserProfile(encoded: string): UserProfile | null {
  try {
    let json: string;
    if (typeof window !== "undefined") {
      json = decodeURIComponent(atob(encoded));
    } else {
      json = Buffer.from(encoded, "base64").toString("utf-8");
    }
    const parsed = JSON.parse(json) as Partial<UserProfile>;
    // 必填字段校验
    if (!parsed.identity || !parsed.education || !parsed.province || !parsed.employmentStatus) {
      return null;
    }
    return {
      identity: parsed.identity,
      education: parsed.education,
      province: parsed.province,
      city: parsed.city || "",
      employmentStatus: parsed.employmentStatus,
      industryIntent: parsed.industryIntent || "不限",
    };
  } catch {
    return null;
  }
}

/**
 * 生成分享链接
 */
export function generateShareLink(profile: UserProfile): string {
  const encoded = encodeUserProfile(profile);
  if (typeof window !== "undefined") {
    return `${window.location.origin}/?profile=${encoded}`;
  }
  return `/?profile=${encoded}`;
}

/**
 * 从当前 URL 提取 profile 参数
 */
export function getProfileFromUrl(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("profile");
  if (!encoded) return null;
  return decodeUserProfile(encoded);
}
