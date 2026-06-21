"use client";

import { useMemo } from "react";
import { MatchedPolicy, PolicyInterpretation, DifficultyLevel } from "@/types/policy";
import { extractSubsidyAmount, getDifficultyInfo } from "@/lib/matcher/scoreCalculator";

interface ApplicationRoadmapProps {
  matchedPolicies: MatchedPolicy[];
  interpretations: Record<string, PolicyInterpretation>;
  onPolicyClick?: (policyId: string) => void;
}

// 优先级信息映射
const priorityInfo: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  strong: { label: "强烈推荐", color: "#10b981", bgColor: "#d1fae5", icon: "🔥" },
  normal: { label: "推荐", color: "#f59e0b", bgColor: "#fef3c7", icon: "✓" },
  optional: { label: "可选", color: "#9ca3af", bgColor: "#f3f4f6", icon: "○" },
};

// 单步卡片
function RoadmapStep({
  step,
  title,
  subtitle,
  policies,
  color,
  interpretations,
  onPolicyClick,
}: {
  step: number;
  title: string;
  subtitle: string;
  policies: MatchedPolicy[];
  color: string;
  interpretations: Record<string, PolicyInterpretation>;
  onPolicyClick?: (policyId: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* 头部 */}
      <div className="p-3 border-b border-gray-50" style={{ backgroundColor: `${color}10` }}>
        <div className="flex items-center gap-2 mb-1">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {step}
          </span>
          <span className="text-sm font-bold text-gray-900">{title}</span>
        </div>
        <p className="text-xs text-gray-500 ml-8">{subtitle}</p>
      </div>

      {/* 政策列表 */}
      <div className="p-3 space-y-2">
        {policies.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-4">暂无</div>
        ) : (
          policies.map((policy) => {
            const amount = extractSubsidyAmount(policy.subsidyAmount);
            const diffInfo = policy.difficulty ? getDifficultyInfo(policy.difficulty) : null;
            const pInfo = policy.priority ? priorityInfo[policy.priority] : null;
            const interp = interpretations[policy.id];

            return (
              <button
                key={policy.id}
                onClick={() => onPolicyClick?.(policy.id)}
                className="w-full text-left p-2.5 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
              >
                <div className="flex items-start gap-2 mb-1.5">
                  {pInfo && (
                    <span className="text-xs">{pInfo.icon}</span>
                  )}
                  <h4 className="text-xs font-semibold text-gray-900 flex-1 leading-snug line-clamp-2">
                    {policy.title}
                  </h4>
                </div>

                <div className="flex flex-wrap gap-1 mb-1.5">
                  {diffInfo && (
                    <span
                      className="px-1.5 py-0.5 rounded text-xs"
                      style={{ backgroundColor: diffInfo.bgColor, color: diffInfo.color }}
                    >
                      {diffInfo.label}
                    </span>
                  )}
                  {amount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-amber-50 text-amber-700">
                      {amount.toFixed(1)}万
                    </span>
                  )}
                  {policy.effectiveStatus === "expiring" && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-orange-50 text-orange-700">
                      即将截止
                    </span>
                  )}
                </div>

                {interp?.estimatedAmount && (
                  <p className="text-xs text-gray-500 leading-relaxed">
                    预计：{interp.estimatedAmount}
                  </p>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function ApplicationRoadmap({
  matchedPolicies,
  interpretations,
  onPolicyClick,
}: ApplicationRoadmapProps) {
  // 排序算法：easy 优先 + 高补贴优先 + 高匹配优先
  const roadmap = useMemo(() => {
    if (matchedPolicies.length === 0) {
      return { immediate: [], thisWeek: [], later: [] };
    }

    const top5 = matchedPolicies.slice(0, 5);
    const diffOrder: Record<DifficultyLevel, number> = { easy: 0, medium: 1, hard: 2 };

    const sorted = [...top5].sort((a, b) => {
      // 1. 难度：easy < medium < hard
      const da = a.difficulty ? diffOrder[a.difficulty] : 3;
      const db = b.difficulty ? diffOrder[b.difficulty] : 3;
      if (da !== db) return da - db;
      // 2. 补贴金额高优先
      const amountDiff = extractSubsidyAmount(b.subsidyAmount) - extractSubsidyAmount(a.subsidyAmount);
      if (amountDiff !== 0) return amountDiff;
      // 3. 匹配度高优先
      return b.matchScore - a.matchScore;
    });

    return {
      immediate: sorted.slice(0, 2),   // 立即申请（最易+最高补贴）
      thisWeek: sorted.slice(2, 4),    // 本周申请（中等）
      later: sorted.slice(4, 5),       // 后续考虑
    };
  }, [matchedPolicies]);

  if (matchedPolicies.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            🗺️ 你的申请路线图
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            按「先易后难 + 先高补贴」排序，分 3 步走，逐步落地
          </p>
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          基于 Top5 政策
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <RoadmapStep
          step={1}
          title="立即申请"
          subtitle="最易申请 + 补贴最高"
          policies={roadmap.immediate}
          color="#10b981"
          interpretations={interpretations}
          onPolicyClick={onPolicyClick}
        />
        <RoadmapStep
          step={2}
          title="本周申请"
          subtitle="中等难度，本周内完成"
          policies={roadmap.thisWeek}
          color="#f59e0b"
          interpretations={interpretations}
          onPolicyClick={onPolicyClick}
        />
        <RoadmapStep
          step={3}
          title="后续考虑"
          subtitle="较复杂，可后续规划"
          policies={roadmap.later}
          color="#9ca3af"
          interpretations={interpretations}
          onPolicyClick={onPolicyClick}
        />
      </div>
    </div>
  );
}
