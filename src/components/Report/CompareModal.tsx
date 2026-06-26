"use client";

import { MatchedPolicy } from "@/types/policy";
import {
  getDifficultyInfo,
  extractSubsidyAmount,
} from "@/lib/matcher/scoreCalculator";
import { getEffectiveStatusInfo } from "@/lib/effectiveStatus";
import { BarChart3, X, Check } from "lucide-react";

interface CompareModalProps {
  policies: MatchedPolicy[];
  onClose: () => void;
  onRemove: (policyId: string) => void;
}

// ============ 政策对比模态框 ============
export default function CompareModal({
  policies,
  onClose,
  onRemove,
}: CompareModalProps) {
  if (policies.length < 2) {
    return (
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl max-w-md w-full p-6 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-4xl mb-3 text-gray-300 flex justify-center"><BarChart3 size={32} /></div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            至少选择 2 条政策
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            请在政策卡片点击&ldquo;加入对比&rdquo;，至少选择 2 条（最多 3 条）政策进行对比
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600"
          >
            知道了
          </button>
        </div>
      </div>
    );
  }

  // 对比维度
  const dimensions = [
    {
      key: "matchScore",
      label: "匹配度",
      getValue: (p: MatchedPolicy) => `${p.matchScore} 分`,
      getScore: (p: MatchedPolicy) => p.matchScore,
      higherIsBetter: true,
    },
    {
      key: "subsidyAmount",
      label: "补贴金额",
      getValue: (p: MatchedPolicy) => p.subsidyAmount,
      getScore: (p: MatchedPolicy) => extractSubsidyAmount(p.subsidyAmount),
      higherIsBetter: true,
    },
    {
      key: "difficulty",
      label: "申请难度",
      getValue: (p: MatchedPolicy) =>
        p.difficulty ? getDifficultyInfo(p.difficulty).label : "未知",
      getScore: (p: MatchedPolicy) => {
        if (!p.difficulty) return 99;
        const order = { easy: 0, medium: 1, hard: 2 };
        return order[p.difficulty];
      },
      higherIsBetter: false,
    },
    {
      key: "effectiveStatus",
      label: "时效状态",
      getValue: (p: MatchedPolicy) =>
        p.effectiveStatus ? getEffectiveStatusInfo(p.effectiveStatus).label : "未知",
      getScore: (p: MatchedPolicy) => {
        if (!p.effectiveStatus) return 99;
        const order = { active: 0, expiring: 1, expired: 2 };
        return order[p.effectiveStatus];
      },
      higherIsBetter: false,
    },
    {
      key: "subsidyType",
      label: "补贴类型",
      getValue: (p: MatchedPolicy) => p.subsidyType,
      getScore: () => 0,
      higherIsBetter: false,
    },
    {
      key: "agency",
      label: "发文机构",
      getValue: (p: MatchedPolicy) => p.agency,
      getScore: () => 0,
      higherIsBetter: false,
    },
    {
      key: "publishDate",
      label: "发布日期",
      getValue: (p: MatchedPolicy) => p.publishDate,
      getScore: (p: MatchedPolicy) => new Date(p.publishDate).getTime(),
      higherIsBetter: true,
    },
    {
      key: "requirements",
      label: "申请条件数",
      getValue: (p: MatchedPolicy) => `${p.requirements.length} 项`,
      getScore: (p: MatchedPolicy) => p.requirements.length,
      higherIsBetter: false,
    },
  ];

  // 找出每列最优值
  const bestMap: Record<string, number> = {};
  for (const dim of dimensions) {
    if (dim.getScore(policies[0]) === 0 && dim.key === "subsidyType") continue;
    if (dim.key === "agency") continue;
    const scores = policies.map((p) => dim.getScore(p));
    const bestScore = dim.higherIsBetter ? Math.max(...scores) : Math.min(...scores);
    bestMap[dim.key] = bestScore;
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 size={18} className="text-emerald-600" />
              政策对比
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              对比 {policies.length} 条政策，绿色高亮为该维度最优
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        {/* 对比表格 */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  对比维度
                </th>
                {policies.map((p) => (
                  <th key={p.id} className="px-4 py-3 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-400 mb-1">
                          {p.publishDate}
                        </div>
                        <div className="text-sm font-semibold text-gray-900 leading-snug">
                          {p.title.length > 30
                            ? p.title.slice(0, 30) + "..."
                            : p.title}
                        </div>
                      </div>
                      <button
                        onClick={() => onRemove(p.id)}
                        className="text-gray-300 hover:text-red-500"
                        aria-label="移除"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dimensions.map((dim) => (
                <tr key={dim.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-medium text-gray-500">
                    {dim.label}
                  </td>
                  {policies.map((p) => {
                    const score = dim.getScore(p);
                    const isBest =
                      bestMap[dim.key] !== undefined &&
                      score === bestMap[dim.key] &&
                      dim.key !== "subsidyType" &&
                      dim.key !== "agency";
                    return (
                      <td
                        key={p.id}
                        className={`px-4 py-3 text-sm ${
                          isBest
                            ? "bg-emerald-50 text-emerald-700 font-medium"
                            : "text-gray-700"
                        }`}
                      >
                        {dim.getValue(p)}
                        {isBest && (
                          <Check size={12} className="ml-1 inline-block text-emerald-600" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 底部操作 */}
        <div className="p-4 border-t border-gray-100 flex justify-between items-center">
          <span className="text-xs text-gray-400">
            提示：绿色高亮表示该维度最优，难度/时效状态越低越好
          </span>
          <a
            href={policies[0].sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600"
          >
            查看首条原文 →
          </a>
        </div>
      </div>
    </div>
  );
}
