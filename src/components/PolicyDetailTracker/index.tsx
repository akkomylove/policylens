"use client";

import { useEffect } from "react";
import { trackPageView, track } from "@/lib/analytics";

/**
 * 政策详情页埋点组件（客户端）
 * 仅在生产环境上报
 */
export default function PolicyDetailTracker({ policyId }: { policyId: string }) {
  useEffect(() => {
    trackPageView(`/policy/${policyId}`);
    track("policy_detail_view", { policyId });
  }, [policyId]);
  return null;
}
