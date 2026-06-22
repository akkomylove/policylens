"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Wallet,
  Target,
  CheckCircle,
  FileText,
  Flame,
  Clock,
  Users,
  TrendingUp,
  MapPin,
  Landmark,
  BookOpen,
  ShieldCheck,
  ClipboardList,
  Send,
  Search,
  PartyPopper,
  Star,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Share2,
  Download,
  Heart,
  GitCompare,
  ArrowUp,
  AlertTriangle,
  GraduationCap,
  Info,
  Phone,
} from "lucide-react";
import {
  MatchedPolicy,
  UserProfile,
  PolicyInterpretation,
  DifficultyLevel,
} from "@/types/policy";
import {
  getMatchLevel,
  getDifficultyInfo,
  extractSubsidyAmount,
} from "@/lib/matcher/scoreCalculator";
import {
  getCachedInterpretation,
  setCachedInterpretation,
} from "@/lib/ai";
import { useAppStore, ApplicationStatus, ApplicationProgress, ApplicationStep } from "@/lib/store";
import { generateShareLink } from "@/lib/share";
import { getEffectiveStatusInfo, getCountdownInfo, getEligibilityWindow } from "@/lib/effectiveStatus";
import { useCountUp, formatNumber } from "@/lib/useCountUp";
import CompareModal from "./CompareModal";
import ApplicationRoadmap from "./ApplicationRoadmap";

interface ReportProps {
  matchedPolicies: MatchedPolicy[];
  userProfile: UserProfile;
  totalSubsidyEstimate: string;
  summary: string;
}

// ============ 收藏持久化工具 ============
const FAV_KEY = "policylens_favorites";

function loadFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(FAV_KEY);
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

function saveFavorites(favs: Set<string>) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));
  } catch {
    // 忽略写入错误
  }
}

// ============ 申请状态持久化工具 ============
const APP_STATUS_KEY = "policylens_applications";

function loadApplicationStatus(): Record<string, ApplicationStatus> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(APP_STATUS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveApplicationStatus(status: Record<string, ApplicationStatus>) {
  try {
    localStorage.setItem(APP_STATUS_KEY, JSON.stringify(status));
  } catch {
    // 忽略写入错误
  }
}

// ============ 轻量 Toast ============
function useToast() {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const ToastEl = toast ? (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-xl text-sm font-medium shadow-lg ${
        toast.type === "success"
          ? "bg-emerald-500 text-white"
          : "bg-red-500 text-white"
      }`}
    >
      {toast.message}
    </div>
  ) : null;

  return { showToast, ToastEl };
}

// ============ 补贴类型图标映射 ============
type LucideIcon = React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;

// V6：补贴图标组件（直接条件渲染，避免在 render 中创建组件）
function SubsidyIcon({ subsidyType, size = 16, className }: { subsidyType: string; size?: number; className?: string }) {
  if (/贷款|授信|信贷|创业担保/.test(subsidyType)) return <Landmark size={size} className={className} />;
  if (/培训|学习|技能|实训/.test(subsidyType)) return <BookOpen size={size} className={className} />;
  if (/社保|保险|参保|缴费/.test(subsidyType)) return <ShieldCheck size={size} className={className} />;
  if (/税收|减税|免税|退税|税费/.test(subsidyType)) return <ClipboardList size={size} className={className} />;
  if (/补贴|奖励|津贴|补助|资金/.test(subsidyType)) return <Wallet size={size} className={className} />;
  return <FileText size={size} className={className} />;
}

// ============ 申请状态信息映射 ============
function getApplicationStatusInfo(status: ApplicationStatus): {
  label: string;
  color: string;
  bgColor: string;
  icon: LucideIcon;
} {
  switch (status) {
    case "todo":
      return { label: "待申请", color: "#6b7280", bgColor: "#f3f4f6", icon: Clock };
    case "applying":
      return { label: "申请中", color: "#f59e0b", bgColor: "#fef3c7", icon: Clock };
    case "done":
      return { label: "已通过", color: "#10b981", bgColor: "#d1fae5", icon: CheckCircle };
  }
}

// ============ V5：4 步申请进度条 ============
const APPLICATION_STEPS: { key: ApplicationStep; label: string; icon: LucideIcon }[] = [
  { key: "materials", label: "材料", icon: ClipboardList },
  { key: "submitted", label: "提交", icon: Send },
  { key: "reviewed", label: "审核", icon: Search },
  { key: "received", label: "领取", icon: PartyPopper },
];

function ApplicationProgressBar({
  progress,
  onToggleStep,
  onReset,
}: {
  progress?: ApplicationProgress;
  onToggleStep: (step: ApplicationStep) => void;
  onReset: () => void;
}) {
  // 默认状态：全部未完成
  const steps = progress?.steps ?? {
    materials: false,
    submitted: false,
    reviewed: false,
    received: false,
  };
  const completedCount = Object.values(steps).filter(Boolean).length;
  const isAllDone = completedCount === 4;
  const isStarted = completedCount > 0;

  // 计算下一步可点击的步骤（已完成的下一步）
  const stepOrder: ApplicationStep[] = ["materials", "submitted", "reviewed", "received"];
  let nextClickableIdx = 0;
  for (let i = 0; i < stepOrder.length; i++) {
    if (steps[stepOrder[i]]) {
      nextClickableIdx = i + 1;
    } else {
      break;
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">
          申请进度
          {isStarted && (
            <span className="ml-1.5 text-2xs text-gray-400">
              ({completedCount}/4)
            </span>
          )}
        </span>
        {isStarted && (
          <button
            onClick={onReset}
            className="text-2xs text-gray-400 hover:text-red-500 transition-colors"
            title="重置进度"
          >
            重置
          </button>
        )}
      </div>

      {/* 4 步进度条 */}
      <div className="flex items-center gap-1">
        {APPLICATION_STEPS.map((step, idx) => {
          const done = steps[step.key];
          // 可点击：已完成 OR 是当前下一步
          const isClickable = done || idx === nextClickableIdx;
          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => isClickable && onToggleStep(step.key)}
                disabled={!isClickable}
                className={`
                  flex flex-col items-center gap-0.5 flex-1 py-1.5 px-1 rounded-lg text-2xs font-medium transition-all
                  ${done
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : isClickable
                    ? "bg-white text-gray-600 border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/50 cursor-pointer"
                    : "bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed"
                  }
                `}
                title={done ? `已完成：${step.label}（点击取消）` : isClickable ? `标记完成：${step.label}` : "需先完成前一步"}
              >
                <span className={`text-sm ${done ? "" : "opacity-50"} flex items-center justify-center`}>
                  {done ? <CheckCircle size={14} /> : <step.icon size={14} />}
                </span>
                <span>{step.label}</span>
              </button>
              {/* 连接线 */}
              {idx < APPLICATION_STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-2 mx-0.5 rounded-full transition-colors ${
                    done && steps[stepOrder[idx + 1]]
                      ? "bg-emerald-400"
                      : done
                      ? "bg-emerald-200"
                      : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 完成提示 */}
      {isAllDone && (
        <div className="mt-2 text-2xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1 flex items-center gap-1">
          <PartyPopper size={12} />
          <span>补贴已领取，恭喜完成申请流程！</span>
        </div>
      )}
      {!isStarted && (
        <div className="mt-2 text-2xs text-gray-400">
          点击「材料」开始跟踪你的申请进度，进度会自动保存到本地。
        </div>
      )}
    </div>
  );
}

// ============ 推荐优先级信息映射 ============
function getPriorityInfo(priority?: string): {
  label: string;
  color: string;
  bgColor: string;
  icon: LucideIcon;
} | null {
  if (!priority) return null;
  switch (priority) {
    case "strong":
      return { label: "强烈推荐", color: "#10b981", bgColor: "#d1fae5", icon: Flame };
    case "normal":
      return { label: "推荐", color: "#f59e0b", bgColor: "#fef3c7", icon: CheckCircle };
    case "optional":
      return { label: "可选", color: "#9ca3af", bgColor: "#f3f4f6", icon: Info };
    default:
      return null;
  }
}

// ============ 匹配维度标签映射 ============
const DIM_LABELS: Record<string, string> = {
  identity: "身份",
  region: "地域",
  education: "学历",
  status: "状态",
  industry: "行业",
};

// ============ 筛选条件类型 ============
type FilterType = "all" | "cash" | "loan" | "training" | "social";
type FilterDifficulty = "all" | DifficultyLevel;
type FilterMatch = "all" | "high" | "medium" | "low";
type SortBy = "matchDesc" | "amountDesc" | "dateDesc" | "difficultyAsc";

// ============ KPI 卡片 ============
function KpiCard({
  icon: Icon,
  value,
  label,
  color,
  isNumeric = false,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  value: string | number;
  label: string;
  color: string;
  isNumeric?: boolean;
}) {
  // V6：数字 count-up 动画
  const numericValue = typeof value === "number" ? value : 0;
  const animatedValue = useCountUp(numericValue, 1000);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden card-hover"
    >
      <div className="h-1" style={{ backgroundColor: color }} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">{label}</span>
          <Icon size={18} className="opacity-70" style={{ color }} />
        </div>
        <div
          className="text-2xl font-bold"
          style={{ color }}
        >
          {isNumeric && typeof value === "number"
            ? formatNumber(animatedValue)
            : value}
        </div>
      </div>
    </motion.div>
  );
}

// ============ V6：补贴总额 count-up 展示 ============
function SubsidyDisplay({ estimate }: { estimate: string }) {
  // 提取数字部分（如"约 35000 元" → 35000）
  const match = estimate.match(/[\d,]+/);
  const numericValue = match ? parseInt(match[0].replace(/,/g, ""), 10) : 0;
  const animatedValue = useCountUp(numericValue, 1500);

  // 提取前后缀
  const prefix = estimate.slice(0, match?.index ?? 0);
  const suffix = estimate.slice((match?.index ?? 0) + (match?.[0].length ?? 0));

  return (
    <span className="text-3xl font-bold">
      {prefix}{formatNumber(animatedValue)}{suffix}
    </span>
  );
}

// ============ 筛选工具栏 ============
function FilterToolbar({
  filterType,
  setFilterType,
  filterDifficulty,
  setFilterDifficulty,
  filterMatch,
  setFilterMatch,
  sortBy,
  setSortBy,
  searchQuery,
  setSearchQuery,
  showOnlyFavorited,
  setShowOnlyFavorited,
  showOnlyActive,
  setShowOnlyActive,
  totalCount,
  filteredCount,
  favoriteCount,
}: {
  filterType: FilterType;
  setFilterType: (v: FilterType) => void;
  filterDifficulty: FilterDifficulty;
  setFilterDifficulty: (v: FilterDifficulty) => void;
  filterMatch: FilterMatch;
  setFilterMatch: (v: FilterMatch) => void;
  sortBy: SortBy;
  setSortBy: (v: SortBy) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  showOnlyFavorited: boolean;
  setShowOnlyFavorited: (v: boolean) => void;
  showOnlyActive: boolean;
  setShowOnlyActive: (v: boolean) => void;
  totalCount: number;
  filteredCount: number;
  favoriteCount: number;
}) {
  const selectClass =
    "px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:border-emerald-500 text-gray-700";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      {/* 搜索框 + 收藏筛选 + 时效筛选 */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索政策标题或内容..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-emerald-500"
          />
        </div>
        <button
          onClick={() => setShowOnlyFavorited(!showOnlyFavorited)}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap inline-flex items-center gap-1 ${
            showOnlyFavorited
              ? "bg-amber-100 text-amber-700 border border-amber-300"
              : "bg-white text-gray-600 border border-gray-200 hover:border-amber-300"
          }`}
        >
          <Star size={12} className={showOnlyFavorited ? "fill-amber-500 text-amber-500" : ""} />
          收藏 {favoriteCount > 0 && `(${favoriteCount})`}
        </button>
        <button
          onClick={() => setShowOnlyActive(!showOnlyActive)}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap inline-flex items-center gap-1 ${
            showOnlyActive
              ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
              : "bg-white text-gray-600 border border-gray-200 hover:border-emerald-300"
          }`}
        >
          <CheckCircle size={12} />
          仅看可申报
        </button>
      </div>

      {/* 筛选+排序 */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
          className={selectClass}
        >
          <option value="all">全部类型</option>
          <option value="cash">现金补贴</option>
          <option value="loan">贷款</option>
          <option value="training">培训</option>
          <option value="social">社保</option>
        </select>

        <select
          value={filterDifficulty}
          onChange={(e) =>
            setFilterDifficulty(e.target.value as FilterDifficulty)
          }
          className={selectClass}
        >
          <option value="all">全部难度</option>
          <option value="easy">易申请</option>
          <option value="medium">中等</option>
          <option value="hard">较复杂</option>
        </select>

        <select
          value={filterMatch}
          onChange={(e) => setFilterMatch(e.target.value as FilterMatch)}
          className={selectClass}
        >
          <option value="all">全部匹配度</option>
          <option value="high">高度匹配</option>
          <option value="medium">中度匹配</option>
          <option value="low">基本匹配</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className={selectClass}
        >
          <option value="matchDesc">按匹配度</option>
          <option value="amountDesc">按金额</option>
          <option value="dateDesc">按时间</option>
          <option value="difficultyAsc">按难度</option>
        </select>

        <span className="px-3 py-2 text-xs text-gray-400 self-center">
          {filteredCount}/{totalCount} 条
        </span>
      </div>
    </div>
  );
}

// ============ V5：地图查看器组件 ============
function MapViewer({ location }: { location: string }) {
  const [showMap, setShowMap] = useState(false);

  // 提取地点关键词用于地图搜索
  const mapQuery = encodeURIComponent(location.replace(/或.*$/, "").trim());
  // 使用高德地图开放平台 URL，无需 API Key
  const mapUrl = `https://uri.amap.com/search?keyword=${mapQuery}&src=PolicyLens&coordinate=wgs84&callnative=1`;

  return (
    <div className="mt-1">
      <button
        onClick={() => setShowMap(!showMap)}
        className="text-2xs text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1"
      >
        <span>{showMap ? "▼" : "▸"}</span>
        {showMap ? "收起地图" : "查看地图"}
      </button>
      {showMap && (
        <div className="mt-1.5 rounded-lg overflow-hidden border border-gray-200">
          <iframe
            src={mapUrl}
            width="100%"
            height="200"
            style={{ border: 0 }}
            title="办理地点地图"
            loading="lazy"
          />
          <div className="text-2xs text-gray-400 p-1.5 bg-gray-50">
            地图由高德地图提供，仅供参考，具体以实际办理地点为准
          </div>
        </div>
      )}
    </div>
  );
}

// ============ V5：差几条提示组件 ============
function ConditionGapDisplay({
  evaluation,
}: {
  evaluation: import("@/types/policy").ConditionEvaluation;
}) {
  const {
    allRequiredMet,
    satisfiedCount,
    totalConditions,
    totalRequired,
    requiredSatisfiedCount,
    gapText,
    results,
  } = evaluation;

  // 判断状态颜色
  const failedRequired = results.filter(
    (r) => !r.passed && r.condition.required
  );
  const failedOptional = results.filter(
    (r) => !r.passed && !r.condition.required
  );

  let bgColor = "bg-emerald-50";
  let borderColor = "border-emerald-200";
  let textColor = "text-emerald-800";
  let Icon: LucideIcon = CheckCircle;

  if (failedRequired.length > 0) {
    bgColor = "bg-red-50";
    borderColor = "border-red-200";
    textColor = "text-red-800";
    Icon = AlertTriangle;
  } else if (failedOptional.length > 0) {
    bgColor = "bg-amber-50";
    borderColor = "border-amber-200";
    textColor = "text-amber-800";
    Icon = AlertTriangle;
  }

  // 满足比例进度条
  const satisfactionRatio =
    totalConditions > 0 ? (satisfiedCount / totalConditions) * 100 : 100;
  const requiredRatio =
    totalRequired > 0 ? (requiredSatisfiedCount / totalRequired) * 100 : 100;

  return (
    <div
      className={`${bgColor} ${borderColor} border rounded-xl p-3 mb-3`}
    >
      {/* 头部：状态图标 + gapText */}
      <div className="flex items-start gap-2 mb-2">
        <Icon size={14} className={`${textColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1">
          <div className={`text-xs font-medium ${textColor}`}>{gapText}</div>
          <div className="text-2xs text-gray-500 mt-0.5">
            满足 {satisfiedCount}/{totalConditions} 个条件
            {totalRequired > 0 &&
              `（核心 ${requiredSatisfiedCount}/${totalRequired}）`}
          </div>
        </div>
      </div>

      {/* 进度条 */}
      <div className="space-y-1">
        {totalRequired > 0 && (
          <div>
            <div className="flex justify-between text-2xs text-gray-500 mb-0.5">
              <span>核心条件</span>
              <span>{requiredSatisfiedCount}/{totalRequired}</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  allRequiredMet ? "bg-emerald-500" : "bg-red-500"
                }`}
                style={{ width: `${requiredRatio}%` }}
              />
            </div>
          </div>
        )}
        <div>
          <div className="flex justify-between text-2xs text-gray-500 mb-0.5">
            <span>全部条件</span>
            <span>{satisfiedCount}/{totalConditions}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${satisfactionRatio}%` }}
            />
          </div>
        </div>
      </div>

      {/* 未满足条件列表（展开式） */}
      {(failedRequired.length > 0 || failedOptional.length > 0) && (
        <details className="mt-2">
          <summary className={`text-2xs ${textColor} cursor-pointer hover:underline`}>
            查看未满足条件（{failedRequired.length + failedOptional.length} 项）
          </summary>
          <ul className="mt-1 space-y-0.5 text-2xs text-gray-600">
            {failedRequired.map((r) => (
              <li key={r.condition.id} className="flex items-start gap-1">
                <span className="text-red-500 flex-shrink-0 mt-0.5"><AlertTriangle size={10} /></span>
                <span>
                  <span className="font-medium">{r.condition.label}</span>
                  {r.actualValue !== undefined && (
                    <span className="text-gray-400">（当前：{r.actualValue}）</span>
                  )}
                  <span className="text-red-400 ml-1">[核心]</span>
                </span>
              </li>
            ))}
            {failedOptional.map((r) => (
              <li key={r.condition.id} className="flex items-start gap-1">
                <span className="text-amber-500 flex-shrink-0 mt-0.5"><AlertTriangle size={10} /></span>
                <span>
                  <span className="font-medium">{r.condition.label}</span>
                  {r.actualValue !== undefined && (
                    <span className="text-gray-400">（当前：{r.actualValue}）</span>
                  )}
                  <span className="text-amber-400 ml-1">[可选]</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ============ 政策卡片 ============
function PolicyCard({
  policy,
  index,
  interpretation,
  isLoading,
  isAutoLoading,
  isFavorited,
  onToggleFavorite,
  onInterpret,
  applicationStatus,
  applicationProgress,
  onToggleApplicationStep,
  onResetApplicationProgress,
  isInCompare,
  onToggleCompare,
  compareDisabled,
}: {
  policy: MatchedPolicy;
  index: number;
  interpretation?: PolicyInterpretation;
  isLoading: boolean;
  isAutoLoading: boolean;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onInterpret: () => void;
  applicationStatus?: ApplicationStatus;
  // V5 新增：4 步进度条
  applicationProgress?: ApplicationProgress;
  onToggleApplicationStep: (step: ApplicationStep) => void;
  onResetApplicationProgress: () => void;
  isInCompare: boolean;
  onToggleCompare: () => void;
  compareDisabled: boolean;
}) {
  const { color, label } = getMatchLevel(policy.matchScore);
  const difficultyInfo = policy.difficulty
    ? getDifficultyInfo(policy.difficulty)
    : null;
  const effectiveInfo = policy.effectiveStatus
    ? getEffectiveStatusInfo(policy.effectiveStatus)
    : null;
  // V5：优先使用 applicationProgress 的 status，回退到旧版 applicationStatus
  const effectiveStatus: ApplicationStatus | undefined =
    applicationProgress?.status ?? applicationStatus;
  const appStatusInfo = effectiveStatus
    ? getApplicationStatusInfo(effectiveStatus)
    : null;
  const priorityInfo = getPriorityInfo(policy.priority);
  const countdownInfo = getCountdownInfo(policy.deadline);

  // V5 新增：资格窗口期预警
  const userProfile = useAppStore((s) => s.userProfile);
  const eligibilityWindow = useMemo(
    () => getEligibilityWindow(userProfile, policy),
    [userProfile, policy]
  );

  // V4 新增：标签折叠状态（默认只显示核心 4 个标签）
  const [showMoreTags, setShowMoreTags] = useState(false);

  // V6 新增：详情折叠状态（渐进式披露，默认折叠次要信息）
  const [isExpanded, setIsExpanded] = useState(false);

  // 次要标签（折叠区）：难度 + 时效 + 序号
  const secondaryTags = [
    difficultyInfo,
    effectiveInfo,
  ].filter(Boolean);

  // V4：howToApply 已改为数组，兼容旧字符串缓存
  const applySteps = useMemo(() => {
    if (!interpretation?.howToApply) return [];
    // 用 unknown 兼容旧缓存（可能是 string 或 string[]）
    const raw = interpretation.howToApply as unknown;
    // 新格式：数组
    if (Array.isArray(raw)) {
      return (raw as string[]).filter((s) => typeof s === "string" && s.trim().length > 0);
    }
    // 兼容旧格式：字符串
    if (typeof raw === "string" && raw.trim()) {
      const text = raw.trim();
      if (text.includes("\n")) {
        return text
          .split("\n")
          .map((s) => s.replace(/^[\d.、\s]+/, "").trim())
          .filter(Boolean);
      }
      return text
        .split(/[。；;]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 5);
    }
    return [];
  }, [interpretation]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3), ease: "easeOut" }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden card-hover"
    >
      <div className="p-5">
        {/* 头部：序号 + 标签 + 收藏 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {/* 核心标签 1：优先级 */}
              {priorityInfo && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1"
                  style={{
                    backgroundColor: priorityInfo.bgColor,
                    color: priorityInfo.color,
                  }}
                >
                  <priorityInfo.icon size={11} />
                  {priorityInfo.label}
                </span>
              )}
              {/* 核心标签 2：匹配度 */}
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: `${color}15`, color }}
              >
                {label} {policy.matchScore}分
              </span>
              {/* 核心标签 3：倒计时（仅有 deadline 时显示） */}
              {countdownInfo && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
                  style={{
                    backgroundColor: countdownInfo.bgColor,
                    color: countdownInfo.color,
                  }}
                  title={`申报截止：${policy.deadline}`}
                >
                  <Clock size={11} />
                  {countdownInfo.label}
                </span>
              )}
              {/* V5 新增：资格窗口期预警徽章 */}
              {eligibilityWindow && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
                  style={{
                    backgroundColor: eligibilityWindow.bgColor,
                    color: eligibilityWindow.color,
                  }}
                  title={eligibilityWindow.detail}
                >
                  <GraduationCap size={11} />
                  {eligibilityWindow.label}
                </span>
              )}
              {/* 核心标签 4：申请状态（仅已设置时显示） */}
              {appStatusInfo && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
                  style={{
                    backgroundColor: appStatusInfo.bgColor,
                    color: appStatusInfo.color,
                  }}
                >
                  <appStatusInfo.icon size={11} />
                  {appStatusInfo.label}
                </span>
              )}

              {/* 次要标签折叠区：序号 + 难度 + 时效 */}
              {showMoreTags && (
                <>
                  <span className="text-xs text-gray-400">#{index + 1}</span>
                  {difficultyInfo && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
                      style={{
                        backgroundColor: difficultyInfo.bgColor,
                        color: difficultyInfo.color,
                      }}
                    >
                      {policy.difficulty === "easy" ? <CheckCircle size={11} /> : policy.difficulty === "medium" ? <TrendingUp size={11} /> : <AlertTriangle size={11} />}
                      {difficultyInfo.label}
                    </span>
                  )}
                  {effectiveInfo && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
                      style={{
                        backgroundColor: effectiveInfo.bgColor,
                        color: effectiveInfo.color,
                      }}
                    >
                      {policy.effectiveStatus === "active" ? <CheckCircle size={11} /> : policy.effectiveStatus === "expiring" ? <Clock size={11} /> : <AlertTriangle size={11} />}
                      {effectiveInfo.label}
                    </span>
                  )}
                </>
              )}

              {/* 更多/收起按钮（仅有次要标签时显示，打印时隐藏） */}
              {secondaryTags.length > 0 && (
                <button
                  onClick={() => setShowMoreTags(!showMoreTags)}
                  className="px-1.5 py-0.5 rounded-full text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors print:hidden"
                  aria-label={showMoreTags ? "收起标签" : "展开更多标签"}
                >
                  {showMoreTags ? "收起" : `+${secondaryTags.length}`}
                </button>
              )}
            </div>
            <h3 className="text-base font-semibold text-gray-900 leading-snug">
              {policy.title}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {policy.agency} · {policy.publishDate}
            </p>
          </div>
          <div className="ml-2 flex flex-col gap-1 flex-shrink-0">
            <button
              onClick={onToggleFavorite}
              className="p-2 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label={isFavorited ? "取消收藏" : "收藏"}
            >
              <Star
                size={20}
                className={isFavorited ? "fill-amber-400 text-amber-400" : "text-gray-300"}
              />
            </button>
            <button
              onClick={onToggleCompare}
              disabled={compareDisabled && !isInCompare}
              className={`p-2 rounded-lg transition-colors ${
                isInCompare
                  ? "bg-indigo-100 text-indigo-700"
                  : "hover:bg-gray-50 text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
              }`}
              aria-label={isInCompare ? "移出对比" : "加入对比"}
              title={compareDisabled && !isInCompare ? "对比已满 3 条" : ""}
            >
              {isInCompare ? <GitCompare size={16} /> : <TrendingUp size={16} />}
            </button>
          </div>
        </div>

        {/* V6 新增：匹配详情折叠区（渐进式披露） */}
        {(policy.matchBreakdown || policy.matchReasons.length > 0 || policy.conditionEvaluation || (policy.successCount && policy.successCount > 0)) && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mb-3 text-xs text-gray-500 hover:text-emerald-600 transition-colors inline-flex items-center gap-1 print:hidden"
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {isExpanded ? "收起匹配详情" : "查看匹配详情"}
          </button>
        )}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              {/* 匹配维度可视化（5 维度命中情况） */}
              {policy.matchBreakdown ? (
                <div className="grid grid-cols-5 gap-1 mb-3">
                  {Object.entries(policy.matchBreakdown).map(([dim, item]) => (
                    <div
                      key={dim}
                      className={`text-xs px-1.5 py-1 rounded text-center flex items-center justify-center gap-0.5 ${
                        item.hit
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-50 text-gray-400"
                      }`}
                      title={item.reason}
                    >
                      {DIM_LABELS[dim] || dim}
                      {item.hit ? <CheckCircle size={10} /> : <span className="text-2xs">✕</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {policy.matchReasons.map((reason, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              )}

              {/* V5 新增：差几条提示（原子条件评估结果） */}
              {policy.conditionEvaluation && (
                <ConditionGapDisplay evaluation={policy.conditionEvaluation} />
              )}

              {/* V3 新增：同类用户反馈（社会证明） */}
              {policy.successCount && policy.successCount > 0 && (
                <div className="flex items-center gap-2 mb-3 text-xs">
                  <span className="text-gray-500 inline-flex items-center gap-1">
                    <Users size={12} />
                    同类用户已申请
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-full bg-emerald-100 border border-white flex items-center justify-center text-2xs text-emerald-600 font-medium"
                        >
                          {i}
                        </div>
                      ))}
                    </div>
                    <span className="text-emerald-600 font-medium">
                      {policy.successCount} 人
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 补贴信息（升级版） */}
        {policy.subsidyAmount && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-3 mb-3 border border-amber-100">
            <div className="flex items-center gap-2 mb-1">
              <SubsidyIcon subsidyType={policy.subsidyType} size={16} className="text-amber-600" />
              <span className="text-xs text-amber-700 font-medium">
                {policy.subsidyType}
              </span>
            </div>
            <div className="text-lg font-bold text-amber-900">
              {policy.subsidyAmount}
            </div>
          </div>
        )}

        {/* AI 解读结果 */}
        {interpretation ? (
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            {interpretation.whyYou && (
              <div className="flex gap-2 items-start">
                <span className="text-xs text-emerald-600 font-medium flex-shrink-0 mt-0.5">为什么是你：</span>
                <span className="text-sm text-gray-700 leading-relaxed">{interpretation.whyYou}</span>
              </div>
            )}
            {interpretation.whyNow && (
              <div className="flex gap-2 items-start">
                <span className="text-xs text-amber-600 font-medium flex-shrink-0 mt-0.5">为什么现在：</span>
                <span className="text-sm text-gray-700 leading-relaxed">{interpretation.whyNow}</span>
              </div>
            )}

            <div className="pt-2 border-t border-gray-200">
              <p className="text-sm text-gray-700 leading-relaxed">
                {interpretation.plainLanguage}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="flex gap-2">
                <span className="text-gray-500 flex-shrink-0">你能享受：</span>
                <span className="text-gray-800">{interpretation.whatYouGet}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 flex-shrink-0">预计金额：</span>
                <span className="text-gray-800 font-medium">
                  {interpretation.estimatedAmount}
                </span>
              </div>
            </div>

            {/* V3 新增：申请材料清单 */}
            {interpretation.requiredDocuments && interpretation.requiredDocuments.length > 0 && (
              <div className="pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <ClipboardList size={12} />
                  申请材料：
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {interpretation.requiredDocuments.map((doc, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                    >
                      {doc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* V3 新增：办理地点 + 联系方式 */}
            {(interpretation.applyLocation || interpretation.contactPhone) && (
              <div className="pt-2 border-t border-gray-200 space-y-1.5">
                {interpretation.applyLocation && (
                  <div className="flex gap-2 items-start">
                    <span className="text-xs text-gray-500 flex-shrink-0 mt-0.5 inline-flex items-center gap-1">
                      <MapPin size={12} />
                      办理地点：
                    </span>
                    <div className="flex-1">
                      <span className="text-xs text-gray-700 leading-relaxed">{interpretation.applyLocation}</span>
                      {/* V5 新增：查看地图按钮 */}
                      <MapViewer location={interpretation.applyLocation} />
                    </div>
                  </div>
                )}
                {interpretation.contactPhone && (
                  <div className="flex gap-2 items-start">
                    <span className="text-xs text-gray-500 flex-shrink-0 mt-0.5 inline-flex items-center gap-1">
                      <Phone size={12} />
                      咨询电话：
                    </span>
                    <span className="text-xs text-gray-700 leading-relaxed">{interpretation.contactPhone}</span>
                  </div>
                )}
              </div>
            )}

            {/* 申请步骤结构化展示 */}
            {applySteps.length > 0 && (
              <div className="pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-500 mb-2">申请步骤：</div>
                <ol className="space-y-1.5">
                  {applySteps.slice(0, 5).map((step, i) => (
                    <li key={i} className="flex gap-2 text-xs">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-medium">
                        {i + 1}
                      </span>
                      <span className="text-gray-700 leading-relaxed pt-0.5">
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* V5 新增：立即申报按钮 */}
            {policy.applyUrl && (
              <div className="pt-3 border-t border-gray-200">
                <a
                  href={policy.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                >
                  立即申报
                </a>
                <div className="text-2xs text-gray-400 text-center mt-1">
                  点击跳转至官方申报入口
                </div>
              </div>
            )}

            {/* V5 新增：防骗警示（仅有 applyUrl 时显示） */}
            {policy.applyUrl && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="text-2xs text-amber-800 leading-relaxed flex items-start gap-1">
                  <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
                  <span>防骗警示：本政策唯一官方申报入口为上方按钮。任何收费代办、承诺包过均为骗局，请勿上当。</span>
                </div>
              </div>
            )}
          </div>
        ) : isAutoLoading ? (
          // V4 新增：自动解读骨架屏
          <div className="bg-gray-50 rounded-xl p-4 space-y-3 animate-pulse">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
              <span className="w-3 h-3 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
              <span>AI 正在解读这条政策...</span>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-1/4" />
              <div className="h-3 bg-gray-200 rounded w-full" />
              <div className="h-3 bg-gray-200 rounded w-5/6" />
            </div>
            <div className="pt-2 border-t border-gray-200 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
            <div className="pt-2 border-t border-gray-200 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-1/4" />
              <div className="flex gap-1.5">
                <div className="h-5 w-12 bg-gray-200 rounded" />
                <div className="h-5 w-14 bg-gray-200 rounded" />
                <div className="h-5 w-10 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="pt-2 border-t border-gray-200 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-1/5" />
              <div className="h-3 bg-gray-200 rounded w-full" />
              <div className="h-3 bg-gray-200 rounded w-4/5" />
            </div>
          </div>
        ) : (
          <button
            onClick={onInterpret}
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl border-2 border-emerald-500 text-emerald-600 text-sm font-medium hover:bg-emerald-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="w-3 h-3 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                AI 解读中...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                AI 解读这条政策
              </>
            )}
          </button>
        )}

        {/* V5：4 步申请进度条 + 原文链接 */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">
              申请进度
              {applicationProgress && Object.values(applicationProgress.steps).some(Boolean) && (
                <span className="ml-1.5 text-2xs text-gray-400">
                  ({Object.values(applicationProgress.steps).filter(Boolean).length}/4)
                </span>
              )}
            </span>
            <a
              href={policy.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline inline-flex items-center gap-0.5"
            >
              查看政策原文
              <ArrowUp size={10} className="rotate-45" />
            </a>
          </div>
          <ApplicationProgressBar
            progress={applicationProgress}
            onToggleStep={onToggleApplicationStep}
            onReset={onResetApplicationProgress}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ============ 申请清单模态框 ============
function ChecklistModal({
  favoritePolicies,
  interpretations,
  onClose,
}: {
  favoritePolicies: MatchedPolicy[];
  interpretations: Record<string, PolicyInterpretation>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const lines = [
      "我的就业政策申请清单",
      `生成时间：${new Date().toLocaleString("zh-CN")}`,
      "",
    ];
    favoritePolicies.forEach((p, i) => {
      const diff = p.difficulty ? getDifficultyInfo(p.difficulty).label : "未知";
      const interp = interpretations[p.id];
      lines.push(`${i + 1}. ${p.title}`);
      lines.push(`   补贴类型：${p.subsidyType}`);
      lines.push(`   补贴金额：${p.subsidyAmount}`);
      lines.push(`   申请难度：${diff}`);
      if (interp) {
        lines.push(`   你能享受：${interp.whatYouGet}`);
        lines.push(`   预计金额：${interp.estimatedAmount}`);
        // V4：howToApply 是数组，兼容旧字符串
        const steps = Array.isArray(interp.howToApply)
          ? interp.howToApply
          : typeof interp.howToApply === "string"
          ? [interp.howToApply]
          : [];
        lines.push(`   申请步骤：${steps.join(" → ")}`);
      }
      lines.push(`   政策原文：${p.sourceUrl}`);
      lines.push("");
    });

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("复制失败，请手动选择文本复制");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList size={18} className="text-emerald-600" />
              我的申请清单
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              已收藏 {favoritePolicies.length} 条政策
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <span className="text-xl">✕</span>
          </button>
        </div>

        {/* 内容 */}
        <div className="p-5 overflow-y-auto flex-1">
          {favoritePolicies.length === 0 ? (
            <div className="text-center py-12">
              <Heart size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500 mb-1">还没有收藏任何政策</p>
              <p className="text-xs text-gray-400">
                点击政策卡片右上角的星标按钮，收藏感兴趣的政策
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {favoritePolicies.map((p, i) => {
                const diff = p.difficulty
                  ? getDifficultyInfo(p.difficulty)
                  : null;
                const interp = interpretations[p.id];
                return (
                  <div
                    key={p.id}
                    className="border border-gray-200 rounded-xl p-4"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-xs text-gray-400 mt-0.5">
                        {i + 1}.
                      </span>
                      <h3 className="text-sm font-semibold text-gray-900 flex-1">
                        {p.title}
                      </h3>
                      {diff && (
                        <span
                          className="px-2 py-0.5 rounded-full text-xs"
                          style={{
                            backgroundColor: diff.bgColor,
                            color: diff.color,
                          }}
                        >
                          {diff.label}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 space-y-1 ml-5">
                      <div>补贴：{p.subsidyAmount}</div>
                      {interp && (
                        <>
                          <div>预计：{interp.estimatedAmount}</div>
                          <div className="text-gray-500">
                            申请：{Array.isArray(interp.howToApply) ? interp.howToApply.join(" → ") : interp.howToApply}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        {favoritePolicies.length > 0 && (
          <div className="p-4 border-t border-gray-100 flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              {copied ? <CheckCircle size={14} /> : <ClipboardList size={14} />}
              {copied ? "已复制" : "复制到剪贴板"}
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Download size={14} />
              打印
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ 主组件 ============
export default function Report({
  matchedPolicies,
  userProfile,
  totalSubsidyEstimate,
  summary,
}: ReportProps) {
  const [interpretations, setInterpretations] = useState<
    Record<string, PolicyInterpretation>
  >({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  // V4 新增：自动解读 Top3 的 loading 追踪（用于骨架屏）
  const [autoInterpretingIds, setAutoInterpretingIds] = useState<Set<string>>(new Set());

  // 收藏状态
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  // 申请状态
  const [applicationStatus, setApplicationStatus] = useState<Record<string, ApplicationStatus>>({});
  const [appStatusLoaded, setAppStatusLoaded] = useState(false);

  // 对比状态
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);

  // 筛选状态
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<FilterDifficulty>(
    "all"
  );
  const [filterMatch, setFilterMatch] = useState<FilterMatch>("all");
  const [sortBy, setSortBy] = useState<SortBy>("matchDesc");
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyFavorited, setShowOnlyFavorited] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(false);

  // 清单模态框
  const [showChecklist, setShowChecklist] = useState(false);

  // V4 新增：返回顶部按钮显示状态
  const [showBackToTop, setShowBackToTop] = useState(false);

  // 看板联动筛选
  const pendingFilter = useAppStore((s) => s.pendingFilter);
  const setPendingFilter = useAppStore((s) => s.setPendingFilter);

  // V5：申请进度跟踪（4 步进度条，持久化到 store）
  const storeApplicationProgress = useAppStore((s) => s.applicationProgress);
  const toggleApplicationStep = useAppStore((s) => s.toggleApplicationStep);
  const resetApplicationProgress = useAppStore((s) => s.resetApplicationProgress);

  // Toast
  const { showToast, ToastEl } = useToast();

  // V4 新增：滚动监听，控制返回顶部按钮显隐
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // V4 新增：返回顶部
  const handleBackToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // 客户端加载收藏和申请状态
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavorites(loadFavorites());
    setFavoritesLoaded(true);
    setApplicationStatus(loadApplicationStatus());
    setAppStatusLoaded(true);
  }, []);

  // 应用看板跳转过来的筛选
  useEffect(() => {
    if (pendingFilter && pendingFilter.type === "difficulty") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilterDifficulty(pendingFilter.value as FilterDifficulty);
      setPendingFilter(null);
    }
  }, [pendingFilter, setPendingFilter]);

  // 自动解读前 3 条政策
  useEffect(() => {
    const top3 = matchedPolicies.slice(0, 3);
    // 标记需要请求的（无缓存的）为 loading
    const needFetch = top3.filter((p) => !getCachedInterpretation(p.id));
    if (needFetch.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAutoInterpretingIds(new Set(needFetch.map((p) => p.id)));
    }

    top3.forEach(async (policy) => {
      const cached = getCachedInterpretation(policy.id);
      if (cached) {
        setInterpretations((prev) => ({ ...prev, [policy.id]: cached }));
        return;
      }
      try {
        const response = await fetch("/api/interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ policy, userProfile, matchBreakdown: policy.matchBreakdown, priority: policy.priority }),
        });
        const data = await response.json();
        setInterpretations((prev) => ({ ...prev, [policy.id]: data }));
        setCachedInterpretation(data);
      } catch (error) {
        console.error("解读失败:", error);
      } finally {
        // 移出 loading 集合
        setAutoInterpretingIds((prev) => {
          const next = new Set(prev);
          next.delete(policy.id);
          return next;
        });
      }
    });
  }, [matchedPolicies, userProfile]);

  // 单条解读
  const handleInterpret = useCallback(
    async (policy: MatchedPolicy) => {
      const cached = getCachedInterpretation(policy.id);
      if (cached) {
        setInterpretations((prev) => ({ ...prev, [policy.id]: cached }));
        return;
      }

      setLoadingId(policy.id);
      try {
        const response = await fetch("/api/interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ policy, userProfile, matchBreakdown: policy.matchBreakdown, priority: policy.priority }),
        });
        const data = await response.json();
        setInterpretations((prev) => ({ ...prev, [policy.id]: data }));
        setCachedInterpretation(data);
      } catch (error) {
        console.error("解读失败:", error);
        showToast("AI 解读失败，请稍后重试", "error");
      } finally {
        setLoadingId(null);
      }
    },
    [userProfile, showToast]
  );

  // 批量解读 Top5
  const handleBatchInterpret = useCallback(async () => {
    const top5 = matchedPolicies.slice(0, 5);
    const needInterpret = top5.filter((p) => !interpretations[p.id]);
    if (needInterpret.length === 0) {
      showToast("Top5 政策已全部解读");
      return;
    }

    setBatchLoading(true);
    setBatchProgress(0);

    // 并发控制：每次 2 条
    for (let i = 0; i < needInterpret.length; i += 2) {
      const batch = needInterpret.slice(i, i + 2);
      await Promise.all(
        batch.map(async (policy) => {
          const cached = getCachedInterpretation(policy.id);
          if (cached) {
            setInterpretations((prev) => ({
              ...prev,
              [policy.id]: cached,
            }));
          } else {
            try {
              const response = await fetch("/api/interpret", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ policy, userProfile, matchBreakdown: policy.matchBreakdown, priority: policy.priority }),
              });
              const data = await response.json();
              setInterpretations((prev) => ({
                ...prev,
                [policy.id]: data,
              }));
              setCachedInterpretation(data);
            } catch (error) {
              console.error("解读失败:", error);
            }
          }
          setBatchProgress((prev) => prev + 1);
        })
      );
    }

    setBatchLoading(false);
    showToast("Top5 政策解读完成");
  }, [matchedPolicies, interpretations, userProfile, showToast]);

  // 收藏切换
  const toggleFavorite = useCallback((policyId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(policyId)) {
        next.delete(policyId);
      } else {
        next.add(policyId);
      }
      saveFavorites(next);
      return next;
    });
  }, []);

  // V5：申请状态切换已迁移到 store 的 toggleApplicationStep
  // 保留 handleApplicationStatusChange 用于旧版数据兼容（如需手动重置）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleApplicationStatusChange = useCallback(
    (policyId: string, status: ApplicationStatus) => {
      setApplicationStatus((prev) => {
        const next = { ...prev };
        // 如果是"未设置"（空字符串），则删除该条
        if (!status) {
          delete next[policyId];
        } else {
          next[policyId] = status;
        }
        saveApplicationStatus(next);
        return next;
      });
    },
    []
  );

  // 对比切换
  const toggleCompare = useCallback((policyId: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(policyId)) {
        next.delete(policyId);
      } else {
        if (next.size >= 3) {
          showToast("对比最多 3 条，请先移除一条", "error");
          return prev;
        }
        next.add(policyId);
      }
      return next;
    });
  }, [showToast]);

  // 分享
  const handleShare = useCallback(async () => {
    const link = generateShareLink(userProfile);
    try {
      await navigator.clipboard.writeText(link);
      showToast("分享链接已复制，可粘贴给朋友");
    } catch {
      showToast("复制失败，请手动复制链接", "error");
    }
  }, [userProfile, showToast]);

  // KPI 计算
  const kpiData = useMemo(() => {
    const highMatchCount = matchedPolicies.filter(
      (p) => p.matchScore >= 80
    ).length;
    const easyApplyCount = matchedPolicies.filter(
      (p) => p.difficulty === "easy"
    ).length;
    // V5：合并旧版 applicationStatus 和新版 applicationProgress 计算已申请数
    const appliedFromOld = Object.values(applicationStatus).filter(
      (s) => s === "done" || s === "applying"
    ).length;
    const appliedFromNew = Object.values(storeApplicationProgress).filter(
      (p) => p && (p.status === "done" || p.status === "applying")
    ).length;
    // 取较大值（避免重复计数）
    const appliedCount = Math.max(appliedFromOld, appliedFromNew);
    return {
      total: matchedPolicies.length,
      subsidy: totalSubsidyEstimate,
      highMatch: highMatchCount,
      easyApply: easyApplyCount,
      applied: appliedCount,
    };
  }, [matchedPolicies, totalSubsidyEstimate, applicationStatus, storeApplicationProgress]);

  // 筛选+排序
  const filteredPolicies = useMemo(() => {
    let result = [...matchedPolicies];

    // 类型筛选
    if (filterType !== "all") {
      result = result.filter((p) => {
        const t = p.subsidyType;
        switch (filterType) {
          case "cash":
            return /补贴|奖励|津贴|补助|资金/.test(t) && !/贷款/.test(t);
          case "loan":
            return /贷款|授信|信贷|创业担保/.test(t);
          case "training":
            return /培训|学习|技能|实训/.test(t);
          case "social":
            return /社保|保险|参保|缴费/.test(t);
          default:
            return true;
        }
      });
    }

    // 难度筛选
    if (filterDifficulty !== "all") {
      result = result.filter((p) => p.difficulty === filterDifficulty);
    }

    // 匹配度筛选
    if (filterMatch !== "all") {
      result = result.filter((p) => {
        switch (filterMatch) {
          case "high":
            return p.matchScore >= 80;
          case "medium":
            return p.matchScore >= 60 && p.matchScore < 80;
          case "low":
            return p.matchScore < 60;
          default:
            return true;
        }
      });
    }

    // 收藏筛选
    if (showOnlyFavorited) {
      result = result.filter((p) => favorites.has(p.id));
    }

    // 时效筛选（仅看可申报 = 排除已过期）
    if (showOnlyActive) {
      result = result.filter((p) => p.effectiveStatus !== "expired");
    }

    // 搜索
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.agency.toLowerCase().includes(q) ||
          p.subsidyType.toLowerCase().includes(q)
      );
    }

    // 排序
    switch (sortBy) {
      case "matchDesc":
        result.sort((a, b) => b.matchScore - a.matchScore);
        break;
      case "amountDesc":
        result.sort(
          (a, b) =>
            extractSubsidyAmount(b.subsidyAmount) -
            extractSubsidyAmount(a.subsidyAmount)
        );
        break;
      case "dateDesc":
        result.sort((a, b) => b.publishDate.localeCompare(a.publishDate));
        break;
      case "difficultyAsc": {
        const order: Record<DifficultyLevel, number> = {
          easy: 0,
          medium: 1,
          hard: 2,
        };
        result.sort((a, b) => {
          const da = a.difficulty ? order[a.difficulty] : 3;
          const db = b.difficulty ? order[b.difficulty] : 3;
          return da - db;
        });
        break;
      }
    }

    return result;
  }, [
    matchedPolicies,
    filterType,
    filterDifficulty,
    filterMatch,
    sortBy,
    searchQuery,
    showOnlyFavorited,
    showOnlyActive,
    favorites,
  ]);

  // 收藏的政策列表（用于清单导出）
  const favoritePolicies = useMemo(() => {
    return matchedPolicies.filter((p) => favorites.has(p.id));
  }, [matchedPolicies, favorites]);

  // 对比的政策列表
  const comparePolicies = useMemo(() => {
    return matchedPolicies.filter((p) => compareIds.has(p.id));
  }, [matchedPolicies, compareIds]);

  // 批量解读进度文本
  const batchProgressText = batchLoading
    ? `解读中 ${batchProgress}/${matchedPolicies.slice(0, 5).filter((p) => !interpretations[p.id]).length}`
    : "";

  return (
    <div className="space-y-5">
      {/* 报告头部 */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs">
              政策体检报告
            </span>
            <span className="text-xs text-emerald-100">
              {new Date().toLocaleDateString("zh-CN")}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
            >
              <Share2 size={12} />
              分享
            </button>
            <button
              onClick={() => setShowChecklist(true)}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
            >
              <ClipboardList size={12} />
              导出清单
              {favorites.size > 0 && (
                <span className="px-1.5 py-0.5 bg-white/30 rounded-full text-xs">
                  {favorites.size}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-3 py-1 bg-white/15 rounded-full text-sm">
            {userProfile.identity}
          </span>
          <span className="px-3 py-1 bg-white/15 rounded-full text-sm">
            {userProfile.education}
          </span>
          <span className="px-3 py-1 bg-white/15 rounded-full text-sm">
            {userProfile.province}
          </span>
          <span className="px-3 py-1 bg-white/15 rounded-full text-sm">
            {userProfile.employmentStatus}
          </span>
        </div>

        <p className="text-sm text-emerald-50 mb-4">{summary}</p>

        <div className="flex items-baseline gap-2">
          <span className="text-sm text-emerald-100">预计可享受补贴</span>
          <SubsidyDisplay estimate={totalSubsidyEstimate} />
        </div>
      </div>

      {/* 申请路线图 */}
      <ApplicationRoadmap
        matchedPolicies={matchedPolicies}
        interpretations={interpretations}
      />

      {/* KPI 卡片区 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          icon={BarChart3}
          value={kpiData.total}
          label="匹配政策数"
          color="#10b981"
          isNumeric
        />
        <KpiCard
          icon={Wallet}
          value={kpiData.subsidy.replace("约 ", "")}
          label="预估补贴总额"
          color="#f59e0b"
        />
        <KpiCard
          icon={Target}
          value={kpiData.highMatch}
          label="高匹配政策数"
          color="#6366f1"
          isNumeric
        />
        <KpiCard
          icon={CheckCircle}
          value={kpiData.easyApply}
          label="可立即申请数"
          color="#ef4444"
          isNumeric
        />
        <KpiCard
          icon={FileText}
          value={kpiData.applied}
          label="已申请/通过"
          color="#0ea5e9"
          isNumeric
        />
      </div>

      {/* 批量解读按钮 */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBatchInterpret}
          disabled={batchLoading}
          className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {batchLoading ? (
            <>
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {batchProgressText}
            </>
          ) : (
            <>
              <Sparkles size={14} />
              一键解读 Top5
            </>
          )}
        </button>
        <span className="text-xs text-gray-400">
          自动解读前 3 条，点击可解读前 5 条
        </span>
      </div>

      {/* 筛选工具栏 */}
      <FilterToolbar
        filterType={filterType}
        setFilterType={setFilterType}
        filterDifficulty={filterDifficulty}
        setFilterDifficulty={setFilterDifficulty}
        filterMatch={filterMatch}
        setFilterMatch={setFilterMatch}
        sortBy={sortBy}
        setSortBy={setSortBy}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showOnlyFavorited={showOnlyFavorited}
        setShowOnlyFavorited={setShowOnlyFavorited}
        showOnlyActive={showOnlyActive}
        setShowOnlyActive={setShowOnlyActive}
        totalCount={matchedPolicies.length}
        filteredCount={filteredPolicies.length}
        favoriteCount={favorites.size}
      />

      {/* 政策列表 */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900">
          匹配政策（{filteredPolicies.length} 条）
        </h2>

        {filteredPolicies.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Search size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500 mb-1">没有符合条件的政策</p>
            <p className="text-xs text-gray-400">试试调整筛选条件或清空搜索</p>
          </div>
        ) : (
          filteredPolicies.map((policy, index) => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              index={index}
              interpretation={interpretations[policy.id]}
              isLoading={loadingId === policy.id}
              isAutoLoading={autoInterpretingIds.has(policy.id)}
              isFavorited={favoritesLoaded && favorites.has(policy.id)}
              onToggleFavorite={() => toggleFavorite(policy.id)}
              onInterpret={() => handleInterpret(policy)}
              applicationStatus={appStatusLoaded ? applicationStatus[policy.id] : undefined}
              applicationProgress={storeApplicationProgress[policy.id]}
              onToggleApplicationStep={(step) => toggleApplicationStep(policy.id, step)}
              onResetApplicationProgress={() => resetApplicationProgress(policy.id)}
              isInCompare={compareIds.has(policy.id)}
              onToggleCompare={() => toggleCompare(policy.id)}
              compareDisabled={compareIds.size >= 3}
            />
          ))
        )}
      </div>

      {/* 对比浮动按钮 */}
      {compareIds.size > 0 && (
        <button
          onClick={() => setShowCompare(true)}
          className="fixed bottom-20 right-6 z-40 px-4 py-3 rounded-full bg-indigo-500 text-white text-sm font-medium shadow-lg hover:bg-indigo-600 transition-colors flex items-center gap-2 print:hidden"
        >
          <GitCompare size={14} />
          对比 {compareIds.size}/3
        </button>
      )}

      {/* 申请清单模态框 */}
      {showChecklist && (
        <ChecklistModal
          favoritePolicies={favoritePolicies}
          interpretations={interpretations}
          onClose={() => setShowChecklist(false)}
        />
      )}

      {/* 对比模态框 */}
      {showCompare && (
        <CompareModal
          policies={comparePolicies}
          onClose={() => setShowCompare(false)}
          onRemove={(id) => toggleCompare(id)}
        />
      )}

      {/* V4 新增：返回顶部按钮 */}
      {showBackToTop && (
        <button
          onClick={handleBackToTop}
          className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-emerald-500 text-white shadow-lg hover:bg-emerald-600 transition-all flex items-center justify-center print:hidden"
          aria-label="返回顶部"
          title="返回顶部"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      )}

      {/* Toast */}
      {ToastEl}
    </div>
  );
}
