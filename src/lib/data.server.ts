import fs from "fs";
import path from "path";
import { Policy } from "@/types/policy";

/**
 * 服务端数据加载（仅用于 SSG / Server Components）
 * 直接读取文件系统，避免客户端 fetch
 */

let policiesCache: Policy[] | null = null;

export function getAllPolicies(): Policy[] {
  if (policiesCache) return policiesCache;
  const filePath = path.join(process.cwd(), "public", "data", "policies.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  policiesCache = JSON.parse(raw) as Policy[];
  return policiesCache;
}

export function getPolicyById(id: string): Policy | null {
  const policies = getAllPolicies();
  return policies.find((p) => p.id === id) || null;
}
