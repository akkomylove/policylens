// ============ 请求去重（inflight 请求合并） ============
// 同一 key 的并发请求只执行一次，结果共享给所有调用方。
// 适用于短时间内的重复 AI 解读请求，避免重复调用 GLM 浪费成本。

const inflightRequests = new Map<string, Promise<unknown>>();

/**
 * 请求去重
 * @param key 去重键（如 `interpret:${policyId}`）
 * @param fn 实际执行函数
 * @returns 与已有请求共享的 Promise
 */
export async function dedupeRequest<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const existing = inflightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fn().finally(() => {
    inflightRequests.delete(key);
  });
  inflightRequests.set(key, promise);
  return promise;
}
