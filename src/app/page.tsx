"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import ProfileForm from "@/components/ProfileForm";
import { useAppStore } from "@/lib/store";
import { loadPolicies } from "@/lib/data";
import { matchAllPolicies } from "@/lib/matcher/ruleMatcher";
import { calculateSummary } from "@/lib/matcher/scoreCalculator";
import { enrichPoliciesWithStatus } from "@/lib/effectiveStatus";
import { getProfileFromUrl } from "@/lib/share";
import { track, trackPageView } from "@/lib/analytics";
import { Policy } from "@/types/policy";

export default function Home() {
  const router = useRouter();
  const {
    userProfile,
    currentStep,
    setMatchResult,
    setLoading,
    isLoading,
    setUserProfile,
    setCurrentStep,
  } = useAppStore();
  const [policies, setPolicies] = useState<Policy[]>([]);

  useEffect(() => {
    loadPolicies().then((data) => setPolicies(enrichPoliciesWithStatus(data)));
  }, []);

  // 页面访问埋点
  useEffect(() => {
    trackPageView("/");
  }, []);

  // 检测 URL 中的分享参数，自动填充表单并触发匹配
  useEffect(() => {
    const sharedProfile = getProfileFromUrl();
    if (sharedProfile && policies.length > 0 && currentStep === 0 && !isLoading) {
      setUserProfile(sharedProfile);
      setCurrentStep(3); // 直接触发匹配
    }
  }, [policies, currentStep, isLoading, setUserProfile, setCurrentStep]);

  // 当用户完成表单（currentStep === 3）时，执行匹配
  useEffect(() => {
    if (currentStep === 3 && policies.length > 0) {
      setLoading(true);
      // 加载延迟，让用户看到骨架屏
      setTimeout(() => {
        const matched = matchAllPolicies(policies, userProfile);
        const { totalSubsidyEstimate, summary } = calculateSummary(
          matched,
          userProfile
        );

        // 匹配完成埋点
        track("match_complete", {
          matchedCount: matched.length,
          totalSubsidy: totalSubsidyEstimate,
          topPriority: matched[0]?.priority || "none",
        });

        setMatchResult({
          userProfile,
          matchedPolicies: matched,
          totalSubsidyEstimate,
          summary,
        });
        setLoading(false);
        router.push("/report");
      }, 200);
    }
  }, [currentStep, policies, userProfile, setMatchResult, setLoading, router]);

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-gradient-to-b from-emerald-50 to-white outline-none">
      {/* 顶部：返回介绍页 */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <Link
          href="/landing"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft size={14} />
          介绍页
        </Link>
      </div>

      {/* Hero */}
      <div className="pt-8 pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-100 rounded-full mb-4">
          <Sparkles size={14} className="text-emerald-600" />
          <span className="text-xs font-medium text-emerald-700">
            社会服务 · 社会公益
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          就业政策智能解读器
        </h1>
        <p className="text-gray-500 text-sm md:text-base max-w-xl mx-auto px-4">
          填写你的画像，3 分钟知道你能享受哪些就业政策补贴
        </p>
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-400">
          <span>已收录 {policies.length} 条政策</span>
          <span>·</span>
          <span>覆盖 31 个省份</span>
          <span>·</span>
          <span>AI 智能解读</span>
        </div>
      </div>

      {/* 表单 */}
      <div className="pb-16 px-4">
        {isLoading ? (
          <div className="w-full max-w-2xl mx-auto space-y-4">
            {/* 骨架屏：模拟报告头部 */}
            <div className="bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl p-6 animate-pulse">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-24 bg-emerald-200 rounded-full" />
                <div className="h-4 w-20 bg-emerald-200 rounded" />
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="h-7 w-20 bg-emerald-200 rounded-full" />
                <div className="h-7 w-16 bg-emerald-200 rounded-full" />
                <div className="h-7 w-16 bg-emerald-200 rounded-full" />
                <div className="h-7 w-20 bg-emerald-200 rounded-full" />
              </div>
              <div className="h-4 w-full bg-emerald-200 rounded mb-2" />
              <div className="h-4 w-3/4 bg-emerald-200 rounded mb-4" />
              <div className="flex items-baseline gap-2">
                <div className="h-4 w-24 bg-emerald-200 rounded" />
                <div className="h-8 w-32 bg-emerald-200 rounded" />
              </div>
            </div>

            {/* 骨架屏：模拟 KPI 卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse"
                >
                  <div className="flex justify-between mb-2">
                    <div className="h-3 w-16 bg-gray-200 rounded" />
                    <div className="h-4 w-4 bg-gray-200 rounded" />
                  </div>
                  <div className="h-7 w-20 bg-gray-200 rounded" />
                </div>
              ))}
            </div>

            {/* 骨架屏：模拟政策卡片 */}
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-4 w-8 bg-gray-200 rounded" />
                  <div className="h-5 w-24 bg-gray-200 rounded-full" />
                  <div className="h-5 w-16 bg-gray-200 rounded-full" />
                </div>
                <div className="h-5 w-3/4 bg-gray-200 rounded mb-2" />
                <div className="h-3 w-1/2 bg-gray-200 rounded mb-4" />
                <div className="flex gap-2 mb-3">
                  <div className="h-6 w-20 bg-emerald-100 rounded" />
                  <div className="h-6 w-24 bg-emerald-100 rounded" />
                </div>
                <div className="h-16 w-full bg-amber-50 rounded-xl" />
              </div>
            ))}

            <div className="text-center text-sm text-gray-400 pt-2">
              正在为你匹配政策，请稍候...
            </div>
          </div>
        ) : (
          <ProfileForm />
        )}
      </div>
    </main>
  );
}
