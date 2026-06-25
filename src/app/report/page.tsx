"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { loadPolicies } from "@/lib/data";
import { trackPageView } from "@/lib/analytics";
import Report from "@/components/Report";
import { Policy } from "@/types/policy";

// 懒加载 Dashboard（含 ECharts ~400KB），仅在用户切到"数据看板"Tab 时加载
const Dashboard = dynamic(() => import("@/components/Dashboard"), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-400 animate-pulse">
      正在加载数据看板...
    </div>
  ),
});

export default function ReportPage() {
  const router = useRouter();
  const { matchResult, reset } = useAppStore();
  const [allPolicies, setAllPolicies] = useState<Policy[]>([]);

  // V4：Tab 状态从 URL query 读取，刷新不丢
  const [activeTab, setActiveTab] = useState<"report" | "dashboard">("report");

  useEffect(() => {
    loadPolicies().then(setAllPolicies);
    // V4：从 URL 读取初始 Tab（客户端挂载后读取，避免 SSR 不一致）
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "dashboard") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab("dashboard");
    }
    trackPageView("/report");
  }, []);

  // 如果没有匹配结果，返回首页
  useEffect(() => {
    if (!matchResult) {
      router.push("/");
    }
  }, [matchResult, router]);

  // V4：切换 Tab 时更新 URL
  const handleTabChange = (tab: "report" | "dashboard") => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "dashboard") {
      url.searchParams.set("tab", "dashboard");
    } else {
      url.searchParams.delete("tab");
    }
    window.history.replaceState(null, "", url.toString());
  };

  if (!matchResult) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => {
              reset();
              router.push("/");
            }}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 transition-colors"
          >
            <span>←</span>
            <span>重新填写</span>
          </button>
          <h1 className="text-sm font-medium text-gray-900">政策体检报告</h1>
          <div className="w-20" />
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="max-w-4xl mx-auto px-4 pt-6 print:hidden">
        <div className="flex gap-2 bg-white rounded-xl p-1 border border-gray-100">
          <button
            onClick={() => handleTabChange("report")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "report"
                ? "bg-emerald-500 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            匹配报告
          </button>
          <button
            onClick={() => handleTabChange("dashboard")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "dashboard"
                ? "bg-emerald-500 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            数据看板
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="max-w-4xl mx-auto px-4 py-6 pb-20">
        {activeTab === "report" ? (
          <Report
            matchedPolicies={matchResult.matchedPolicies}
            userProfile={matchResult.userProfile}
            totalSubsidyEstimate={matchResult.totalSubsidyEstimate}
            summary={matchResult.summary}
          />
        ) : (
          <Dashboard
            matchedPolicies={matchResult.matchedPolicies}
            allPolicies={allPolicies}
          />
        )}
      </div>
    </main>
  );
}
