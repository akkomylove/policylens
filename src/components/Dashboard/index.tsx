"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MatchedPolicy,
  Policy,
  StatsData,
  UserProfile,
  DifficultyLevel,
} from "@/types/policy";
import { loadStats } from "@/lib/data";
import { extractSubsidyAmount, getDifficultyInfo } from "@/lib/matcher/scoreCalculator";
import { useAppStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { getDaysLeft, isDeadlineSoon } from "@/lib/effectiveStatus";
import { useEChart, EChartsOption } from "./useEChart";

interface DashboardProps {
  matchedPolicies: MatchedPolicy[];
  allPolicies: Policy[];
}

// ============ 卡片 1：政策画像总览卡（全宽） ============
function ProfileSummaryCard({
  matchedPolicies,
  userProfile,
}: {
  matchedPolicies: MatchedPolicy[];
  userProfile: UserProfile | null;
}) {
  const priorityCounts = useMemo(() => {
    return {
      strong: matchedPolicies.filter((p) => p.priority === "strong").length,
      normal: matchedPolicies.filter((p) => p.priority === "normal").length,
      optional: matchedPolicies.filter((p) => p.priority === "optional").length,
    };
  }, [matchedPolicies]);

  const avgScore = useMemo(() => {
    if (matchedPolicies.length === 0) return 0;
    return (
      matchedPolicies.reduce((s, p) => s + p.matchScore, 0) /
      matchedPolicies.length
    );
  }, [matchedPolicies]);

  const total = matchedPolicies.length;
  const strongPct = total > 0 ? (priorityCounts.strong / total) * 100 : 0;
  const normalPct = total > 0 ? (priorityCounts.normal / total) * 100 : 0;
  const optionalPct = total > 0 ? (priorityCounts.optional / total) * 100 : 0;

  return (
    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            📊 你的政策画像
          </h2>
          <p className="text-sm text-emerald-100 mt-1">
            {userProfile?.identity}·{userProfile?.education}·{userProfile?.province}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold">{total}</div>
          <div className="text-xs text-emerald-100">条匹配政策</div>
        </div>
      </div>

      {/* 优先级分布条 */}
      {total > 0 && (
        <>
          <div className="bg-white/20 rounded-full h-2 flex overflow-hidden mb-3">
            <div style={{ width: `${strongPct}%` }} className="bg-emerald-300" />
            <div style={{ width: `${normalPct}%` }} className="bg-amber-300" />
            <div style={{ width: `${optionalPct}%` }} className="bg-gray-300" />
          </div>
          <div className="flex gap-4 text-xs flex-wrap">
            <span>🔥 强烈推荐 {priorityCounts.strong}</span>
            <span>✓ 推荐 {priorityCounts.normal}</span>
            <span>○ 可选 {priorityCounts.optional}</span>
          </div>
        </>
      )}

      {/* 一句话总结 */}
      <p className="text-sm text-emerald-50 mt-3 leading-relaxed">
        基于你的画像，匹配到 {total} 条政策，其中 {priorityCounts.strong} 条强烈推荐，平均匹配度 {avgScore.toFixed(0)} 分。
      </p>
    </div>
  );
}

// ============ 图表 1：5 维度匹配雷达图 ============
function MatchRadarChart({
  matchedPolicies,
}: {
  matchedPolicies: MatchedPolicy[];
}) {
  const option = useMemo<EChartsOption>(() => {
    // 取前 3 条政策的匹配明细，叠加展示
    const top3 = matchedPolicies.slice(0, 3);
    const indicators = [
      { name: "身份", max: 100 },
      { name: "地域", max: 100 },
      { name: "学历", max: 100 },
      { name: "状态", max: 100 },
      { name: "行业", max: 100 },
    ];

    const colors = ["#10b981", "#f59e0b", "#6366f1"];
    const series = top3.map((p, i) => {
      const bd = p.matchBreakdown;
      return {
        value: [
          bd?.identity?.score ?? 0,
          bd?.region?.score ?? 0,
          bd?.education?.score ?? 0,
          bd?.status?.score ?? 0,
          bd?.industry?.score ?? 0,
        ],
        name: `Top${i + 1}`,
        lineStyle: { color: colors[i] },
        areaStyle: { color: colors[i], opacity: 0.15 },
        itemStyle: { color: colors[i] },
      };
    });

    return {
      tooltip: { trigger: "item" },
      legend: {
        data: top3.map((_, i) => `Top${i + 1}`),
        bottom: 0,
        textStyle: { fontSize: 11, color: "#6b7280" },
      },
      radar: {
        indicator: indicators,
        shape: "polygon",
        splitNumber: 4,
        axisName: { color: "#374151", fontSize: 11 },
        splitLine: { lineStyle: { color: "#e5e7eb" } },
        splitArea: { areaStyle: { color: ["#fafafa", "#fff"] } },
        axisLine: { lineStyle: { color: "#e5e7eb" } },
      },
      series: [
        {
          type: "radar",
          data: series,
        },
      ],
    };
  }, [matchedPolicies]);

  const { chartRef } = useEChart(option, [matchedPolicies]);

  if (matchedPolicies.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
        🎯 匹配维度雷达
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        Top3 政策在 5 个维度的匹配得分对比
      </p>
      <div ref={chartRef} className="w-full h-[280px]" />
    </div>
  );
}

// ============ 图表 2：补贴类型分布饼图 ============
function SubsidyTypePieChart({
  matchedPolicies,
}: {
  matchedPolicies: MatchedPolicy[];
}) {
  const option = useMemo<EChartsOption>(() => {
    const typeMap: Record<string, number> = {};
    for (const p of matchedPolicies) {
      const t = p.subsidyType || "其他";
      let category: string;
      if (/贷款|授信|信贷|创业担保/.test(t)) category = "贷款类";
      else if (/培训|学习|技能|实训/.test(t)) category = "培训类";
      else if (/社保|保险|参保|缴费/.test(t)) category = "社保类";
      else if (/税收|减税|免税|退税|税费/.test(t)) category = "税收类";
      else if (/见习|实习/.test(t)) category = "见习类";
      else if (/补贴|奖励|津贴|补助|资金/.test(t)) category = "现金补贴";
      else category = "其他";
      typeMap[category] = (typeMap[category] || 0) + 1;
    }

    const data = Object.entries(typeMap).map(([name, value]) => ({
      name,
      value,
    }));

    const palette = [
      "#10b981",
      "#6366f1",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#0ea5e9",
      "#9ca3af",
    ];

    return {
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c} 条 ({d}%)",
      },
      legend: {
        orient: "vertical",
        right: 10,
        top: "center",
        textStyle: { fontSize: 11, color: "#6b7280" },
      },
      color: palette,
      series: [
        {
          type: "pie",
          radius: ["40%", "70%"],
          center: ["40%", "50%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: "#fff",
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: "{b}\n{c}条",
            fontSize: 11,
            color: "#374151",
          },
          emphasis: {
            label: { show: true, fontSize: 13, fontWeight: "bold" },
          },
          data,
        },
      ],
    };
  }, [matchedPolicies]);

  const { chartRef } = useEChart(option, [matchedPolicies]);

  if (matchedPolicies.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
        🥧 补贴类型分布
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        匹配政策按补贴类型分组占比
      </p>
      <div ref={chartRef} className="w-full h-[280px]" />
    </div>
  );
}

// ============ 图表 3：补贴金额对比柱状图 ============
function SubsidyBarChart({
  matchedPolicies,
  onPolicyClick,
}: {
  matchedPolicies: MatchedPolicy[];
  onPolicyClick: () => void;
}) {
  const option = useMemo<EChartsOption>(() => {
    const top10 = [...matchedPolicies]
      .filter((p) => extractSubsidyAmount(p.subsidyAmount) > 0)
      .sort(
        (a, b) =>
          extractSubsidyAmount(b.subsidyAmount) -
          extractSubsidyAmount(a.subsidyAmount)
      )
      .slice(0, 10);

    const truncateTitle = (title: string) =>
      title.length > 10 ? title.slice(0, 10) + "…" : title;

    const priorityColor = (priority?: string) => {
      if (priority === "strong") return "#10b981";
      if (priority === "normal") return "#f59e0b";
      return "#9ca3af";
    };

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: Array<{ dataIndex?: number }>) => {
          const idx = params[0]?.dataIndex;
          if (idx === undefined) return "";
          const p = top10[idx];
          return `<div style="max-width:240px">
            <div style="font-weight:600;margin-bottom:4px">${p.title}</div>
            <div style="color:#6b7280">补贴：${p.subsidyAmount}</div>
            <div style="color:#6b7280">匹配度：${p.matchScore} 分</div>
            <div style="color:#6b7280">金额：${extractSubsidyAmount(p.subsidyAmount).toFixed(1)} 万元</div>
          </div>`;
        },
      },
      grid: { left: "3%", right: "4%", bottom: "10%", containLabel: true },
      xAxis: {
        type: "category",
        data: top10.map((p) => truncateTitle(p.title)),
        axisLabel: {
          rotate: 30,
          fontSize: 10,
          color: "#6b7280",
          interval: 0,
        },
        axisLine: { lineStyle: { color: "#e5e7eb" } },
      },
      yAxis: {
        type: "value",
        name: "万元",
        nameTextStyle: { fontSize: 11, color: "#6b7280" },
        axisLabel: { fontSize: 11, color: "#6b7280" },
        splitLine: { lineStyle: { color: "#f3f4f6" } },
      },
      series: [
        {
          type: "bar",
          data: top10.map((p) => ({
            value: extractSubsidyAmount(p.subsidyAmount),
            itemStyle: { color: priorityColor(p.priority) },
          })),
          barWidth: "60%",
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          label: {
            show: true,
            position: "top",
            formatter: "{c}",
            fontSize: 10,
            color: "#374151",
          },
        },
      ],
    };
  }, [matchedPolicies]);

  const { chartRef } = useEChart(option, [matchedPolicies]);

  const handleClick = () => {
    onPolicyClick();
  };

  if (matchedPolicies.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
          💹 补贴金额 Top10
        </h3>
        <button
          onClick={handleClick}
          className="text-xs text-emerald-600 hover:underline"
        >
          查看全部 →
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        颜色按推荐优先级区分（绿=强烈推荐 / 橙=推荐 / 灰=可选）
      </p>
      <div ref={chartRef} className="w-full h-[320px]" />
    </div>
  );
}

// ============ 卡片 2：申请路线图缩略卡（全宽） ============
function RoadmapPreviewCard({
  matchedPolicies,
  onPolicyClick,
}: {
  matchedPolicies: MatchedPolicy[];
  onPolicyClick: () => void;
}) {
  const roadmap = useMemo(() => {
    if (matchedPolicies.length === 0) {
      return { immediate: [], thisWeek: [] };
    }

    const top5 = matchedPolicies.slice(0, 5);
    const diffOrder: Record<DifficultyLevel, number> = {
      easy: 0,
      medium: 1,
      hard: 2,
    };

    const sorted = [...top5].sort((a, b) => {
      const da = a.difficulty ? diffOrder[a.difficulty] : 3;
      const db = b.difficulty ? diffOrder[b.difficulty] : 3;
      if (da !== db) return da - db;
      const amountDiff =
        extractSubsidyAmount(b.subsidyAmount) -
        extractSubsidyAmount(a.subsidyAmount);
      if (amountDiff !== 0) return amountDiff;
      return b.matchScore - a.matchScore;
    });

    return {
      immediate: sorted.slice(0, 2),
      thisWeek: sorted.slice(2, 4),
    };
  }, [matchedPolicies]);

  if (matchedPolicies.length === 0) return null;

  const renderPolicyItem = (policy: MatchedPolicy) => {
    const amount = extractSubsidyAmount(policy.subsidyAmount);
    const diffInfo = policy.difficulty ? getDifficultyInfo(policy.difficulty) : null;
    return (
      <button
        key={policy.id}
        onClick={onPolicyClick}
        className="w-full text-left p-2.5 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
      >
        <div className="flex items-start gap-2 mb-1">
          <h4 className="text-xs font-semibold text-gray-900 flex-1 leading-snug line-clamp-1">
            {policy.title}
          </h4>
          {amount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-amber-50 text-amber-700 flex-shrink-0">
              {amount.toFixed(1)}万
            </span>
          )}
        </div>
        {diffInfo && (
          <span
            className="px-1.5 py-0.5 rounded text-xs"
            style={{ backgroundColor: diffInfo.bgColor, color: diffInfo.color }}
          >
            {diffInfo.label}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            🗺️ 申请路线图
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            按「先易后难 + 先高补贴」排序，分 3 步走
          </p>
        </div>
        <button
          onClick={onPolicyClick}
          className="text-xs text-emerald-600 hover:underline flex-shrink-0"
        >
          查看全部 →
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 立即申请 */}
        <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
              1
            </span>
            <span className="text-sm font-bold text-gray-900">立即申请</span>
            <span className="text-xs text-gray-500">最易+最高补贴</span>
          </div>
          <div className="space-y-2">
            {roadmap.immediate.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">暂无</p>
            ) : (
              roadmap.immediate.map(renderPolicyItem)
            )}
          </div>
        </div>

        {/* 本周申请 */}
        <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">
              2
            </span>
            <span className="text-sm font-bold text-gray-900">本周申请</span>
            <span className="text-xs text-gray-500">中等难度</span>
          </div>
          <div className="space-y-2">
            {roadmap.thisWeek.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">暂无</p>
            ) : (
              roadmap.thisWeek.map(renderPolicyItem)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ 卡片 3：补贴预估卡（三列之一） ============
function TypeStat({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold" style={{ color }}>
        {count}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function SubsidyEstimateCard({
  matchedPolicies,
  onPolicyClick,
}: {
  matchedPolicies: MatchedPolicy[];
  onPolicyClick: () => void;
}) {
  const data = useMemo(() => {
    // 总额（非贷款类）
    const totalAmount = matchedPolicies
      .filter((p) => !p.subsidyType.includes("贷款") && !p.subsidyAmount.includes("贷款"))
      .reduce((sum, p) => sum + extractSubsidyAmount(p.subsidyAmount), 0);

    // 按类型分布
    const typeDistribution = {
      cash: 0,
      loan: 0,
      training: 0,
      social: 0,
      other: 0,
    };
    for (const p of matchedPolicies) {
      const t = p.subsidyType;
      if (/贷款|授信|信贷|创业担保/.test(t)) typeDistribution.loan++;
      else if (/培训|学习|技能|实训/.test(t)) typeDistribution.training++;
      else if (/社保|保险|参保|缴费/.test(t)) typeDistribution.social++;
      else if (/补贴|奖励|津贴|补助|资金/.test(t)) typeDistribution.cash++;
      else typeDistribution.other++;
    }

    // Top3 高补贴政策
    const top3 = [...matchedPolicies]
      .filter((p) => extractSubsidyAmount(p.subsidyAmount) > 0)
      .sort(
        (a, b) =>
          extractSubsidyAmount(b.subsidyAmount) -
          extractSubsidyAmount(a.subsidyAmount)
      )
      .slice(0, 3);

    return { totalAmount, typeDistribution, top3 };
  }, [matchedPolicies]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
        💰 补贴预估
      </h3>
      <div className="text-3xl font-bold text-amber-600">
        {data.totalAmount.toFixed(1)}
        <span className="text-base font-normal text-gray-500 ml-1">万</span>
      </div>
      <div className="text-xs text-gray-500 mt-1">预估可享受补贴总额（非贷款类）</div>

      {/* 类型分布 */}
      <div className="grid grid-cols-4 gap-2 mt-4 py-3 border-y border-gray-100">
        <TypeStat label="现金补贴" count={data.typeDistribution.cash} color="#10b981" />
        <TypeStat label="贷款" count={data.typeDistribution.loan} color="#6366f1" />
        <TypeStat label="培训" count={data.typeDistribution.training} color="#f59e0b" />
        <TypeStat label="社保" count={data.typeDistribution.social} color="#ef4444" />
      </div>

      {/* Top3 高补贴 */}
      <div className="mt-3">
        <div className="text-xs text-gray-500 mb-2">Top3 高补贴政策</div>
        <div className="space-y-1.5">
          {data.top3.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">暂无数据</p>
          ) : (
            data.top3.map((p, i) => (
              <button
                key={p.id}
                onClick={onPolicyClick}
                className="w-full flex justify-between items-center text-left p-1.5 rounded hover:bg-gray-50 transition-colors"
              >
                <span className="text-xs text-gray-700 truncate flex-1 mr-2">
                  {i + 1}. {p.title}
                </span>
                <span className="text-xs text-amber-600 font-medium flex-shrink-0">
                  {extractSubsidyAmount(p.subsidyAmount).toFixed(1)}万
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ============ 卡片 4：即将过期提醒卡（三列之一） ============
function ExpiringSoonCard({
  matchedPolicies,
  onPolicyClick,
}: {
  matchedPolicies: MatchedPolicy[];
  onPolicyClick: () => void;
}) {
  const expiring = useMemo(() => {
    return matchedPolicies
      .filter(
        (p) =>
          p.effectiveStatus === "expiring" || isDeadlineSoon(p.deadline, 30)
      )
      .sort((a, b) => {
        const da = getDaysLeft(a.deadline) ?? 999;
        const db = getDaysLeft(b.deadline) ?? 999;
        return da - db;
      })
      .slice(0, 3);
  }, [matchedPolicies]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-orange-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-orange-500 text-lg">⏰</span>
        <h3 className="text-base font-bold text-gray-900">即将截止提醒</h3>
      </div>

      {expiring.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-3xl mb-2">✓</div>
          <p className="text-sm text-gray-400">暂无即将截止的政策</p>
          <p className="text-xs text-gray-400 mt-1">所有政策申报期充足</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expiring.map((p) => {
            const daysLeft = getDaysLeft(p.deadline);
            const urgencyColor =
              daysLeft !== null && daysLeft <= 7
                ? "#ef4444"
                : daysLeft !== null && daysLeft <= 30
                ? "#f59e0b"
                : "#10b981";
            return (
              <button
                key={p.id}
                onClick={onPolicyClick}
                className="w-full text-left p-2.5 rounded-lg hover:bg-orange-50 transition-colors border border-orange-100"
              >
                <div className="flex justify-between items-start gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-900 flex-1 line-clamp-2">
                    {p.title}
                  </span>
                  <span
                    className="text-xs font-bold flex-shrink-0 px-1.5 py-0.5 rounded"
                    style={{ color: urgencyColor, backgroundColor: `${urgencyColor}15` }}
                  >
                    {daysLeft !== null
                      ? daysLeft <= 0
                        ? "今日截止"
                        : `还剩 ${daysLeft} 天`
                      : "即将截止"}
                  </span>
                </div>
                {p.deadline && (
                  <div className="text-xs text-gray-400">
                    截止日期：{p.deadline}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ 卡片 5：同类用户参考卡（三列之一） ============
function PeerReferenceCard({
  matchedPolicies,
  userProfile,
  onPolicyClick,
}: {
  matchedPolicies: MatchedPolicy[];
  userProfile: UserProfile | null;
  onPolicyClick: () => void;
}) {
  const { topApplied, totalPeers } = useMemo(() => {
    const withCount = matchedPolicies.filter(
      (p) => p.successCount && p.successCount > 0
    );
    const sorted = [...withCount].sort(
      (a, b) => (b.successCount || 0) - (a.successCount || 0)
    );
    const top3 = sorted.slice(0, 3);
    const total = withCount.reduce(
      (sum, p) => sum + (p.successCount || 0),
      0
    );
    return { topApplied: top3, totalPeers: total };
  }, [matchedPolicies]);

  const maxCount = topApplied[0]?.successCount || 1;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">👥</span>
        <h3 className="text-base font-bold text-gray-900">同类用户参考</h3>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        与你同身份（{userProfile?.identity || "用户"}）的用户，最常申请的政策
      </p>

      {topApplied.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-3xl mb-2">📊</div>
          <p className="text-sm text-gray-400">暂无同类用户数据</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topApplied.map((p, i) => (
            <button
              key={p.id}
              onClick={onPolicyClick}
              className="w-full text-left"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-700 truncate flex-1 mr-2">
                  {i + 1}. {p.title}
                </span>
                <span className="text-xs text-emerald-600 font-medium flex-shrink-0">
                  {p.successCount} 人
                </span>
              </div>
              {/* 进度条 */}
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all"
                  style={{
                    width: `${((p.successCount || 0) / maxCount) * 100}%`,
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400 text-center">
        累计 {totalPeers} 位 {userProfile?.identity || "用户"} 已申请
      </div>
    </div>
  );
}

// ============ 卡片 6：宏观背景个性化卡（全宽） ============
function MacroPersonalizedCard({
  stats,
  userProfile,
}: {
  stats: StatsData | null;
  userProfile: UserProfile | null;
}) {
  const identityInsight = useMemo(() => {
    const map: Record<string, string> = {
      应届毕业生:
        "作为应届毕业生，今年高校毕业生人数再创新高，但政策红利也最充足。建议优先关注创业担保贷款（最高30万元）、就业见习补贴和一次性吸纳就业补贴（1500元/人）。",
      往届毕业生:
        "作为往届毕业生，虽然部分应届专属政策已不适用，但仍可关注灵活就业社保补贴、职业技能培训补贴（1000-6000元/人）等政策。",
      退役军人:
        "退役军人就业有专项扶持，吸纳就业补贴最高 1500 元/人，创业担保贷款最高 30 万元。建议关注退役军人专项就业创业政策。",
      返乡创业者:
        "返乡创业者可申请最高 30 万元创业担保贷款，首次创办小微企业可获 1 万元创业补贴。建议关注乡村振兴相关就业政策。",
      灵活就业人员:
        "灵活就业人员可享受社保补贴（不超过实际缴纳的2/3），建议关注新就业形态劳动者权益保障政策和社保补贴政策。",
      在职人员:
        "在职人员可关注技能提升补贴（初级1000元、中级1500元、高级2000元）和失业保险稳岗返还政策，提升职业技能。",
      失业人员:
        "失业人员可申请失业保险金，参加职业技能培训可获 1000-6000 元/人补贴。建议关注就业困难人员就业援助政策。",
      农民工:
        "农民工返乡创业有专项支持，职业技能培训补贴 1000-6000 元/人。建议先提升技能再求职，关注劳务协作政策。",
    };
    return map[userProfile?.identity || ""] || "当前就业形势总体稳定，建议关注各类补贴政策，提升自身技能。";
  }, [userProfile]);

  const unemployment = stats?.indicators.find((i) =>
    i.name.includes("失业率")
  );
  const newJobs = stats?.indicators.find((i) =>
    i.name.includes("新增就业")
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
        📈 宏观背景与你的关系
      </h3>
      <p className="text-sm text-gray-700 leading-relaxed">
        {identityInsight}
      </p>

      {/* 关键指标 */}
      {stats && (unemployment || newJobs) && (
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
          {unemployment && (
            <div>
              <div className="text-xs text-gray-500">城镇调查失业率</div>
              <div className="text-xl font-bold text-gray-900">
                {unemployment.yearly[unemployment.yearly.length - 1].value}
                <span className="text-sm font-normal text-gray-500 ml-1">%</span>
              </div>
            </div>
          )}
          {newJobs && (
            <div>
              <div className="text-xs text-gray-500">城镇新增就业</div>
              <div className="text-xl font-bold text-gray-900">
                {newJobs.yearly[newJobs.yearly.length - 1].value}
                <span className="text-sm font-normal text-gray-500 ml-1">万人</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 text-xs text-gray-400">
        数据来源：国家统计局 · 更新时间：{stats?.updateTime || "未知"}
      </div>
    </div>
  );
}

// ============ 数据来源浮层 ============
function DataSourceModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          📊 数据说明
        </h3>
        <div className="space-y-2 text-sm text-gray-600 leading-relaxed">
          <p>• 政策数据：来源于国务院、各省人社厅公开发布的政策文件</p>
          <p>• 统计数据：来源于国家统计局公开数据</p>
          <p>
            • 匹配算法：基于用户画像（身份/学历/地域/就业状态/行业）5 维度加权匹配
          </p>
          <p>• 申请人数：模拟数据，仅用于参考展示</p>
          <p>• 时效标注：基于发布日期估算，仅供参考</p>
          <p>• 推荐优先级：基于身份+地域+其他维度命中情况分层</p>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 rounded-lg bg-gray-100 text-sm text-gray-700 hover:bg-gray-200 transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
  );
}

// ============ 主组件 ============
export default function Dashboard({
  matchedPolicies,
  allPolicies: _allPolicies,
}: DashboardProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [showDataSource, setShowDataSource] = useState(false);
  const router = useRouter();
  const userProfile = useAppStore((s) => s.matchResult?.userProfile ?? null);

  useEffect(() => {
    loadStats().then((data) => setStats(data));
  }, []);

  const handlePolicyClick = () => {
    router.push("/report");
  };

  if (matchedPolicies.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
        <div className="text-4xl mb-3">📋</div>
        <p className="text-sm text-gray-500 mb-1">暂无匹配数据</p>
        <p className="text-xs text-gray-400">请先完成画像填写，生成匹配报告</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 卡片 1：政策画像总览（全宽） */}
      <ProfileSummaryCard
        matchedPolicies={matchedPolicies}
        userProfile={userProfile}
      />

      {/* 图表区：雷达图 + 饼图（两列） */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MatchRadarChart matchedPolicies={matchedPolicies} />
        <SubsidyTypePieChart matchedPolicies={matchedPolicies} />
      </div>

      {/* 卡片 2：申请路线图缩略（全宽） */}
      <RoadmapPreviewCard
        matchedPolicies={matchedPolicies}
        onPolicyClick={handlePolicyClick}
      />

      {/* 卡片 3-5：三列布局 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SubsidyEstimateCard
          matchedPolicies={matchedPolicies}
          onPolicyClick={handlePolicyClick}
        />
        <ExpiringSoonCard
          matchedPolicies={matchedPolicies}
          onPolicyClick={handlePolicyClick}
        />
        <PeerReferenceCard
          matchedPolicies={matchedPolicies}
          userProfile={userProfile}
          onPolicyClick={handlePolicyClick}
        />
      </div>

      {/* 图表 3：补贴金额 Top10 柱状图（全宽） */}
      <SubsidyBarChart
        matchedPolicies={matchedPolicies}
        onPolicyClick={handlePolicyClick}
      />

      {/* 卡片 6：宏观背景个性化（全宽） */}
      <MacroPersonalizedCard stats={stats} userProfile={userProfile} />

      {/* 数据来源说明 */}
      <div className="text-center py-2">
        <button
          onClick={() => setShowDataSource(true)}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          📊 数据说明
        </button>
      </div>

      {/* 数据来源浮层 */}
      {showDataSource && (
        <DataSourceModal onClose={() => setShowDataSource(false)} />
      )}
    </div>
  );
}
