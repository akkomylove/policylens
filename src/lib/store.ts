import { create } from "zustand";
import { persist } from "zustand/middleware";
import { UserProfile, MatchResult } from "@/types/policy";

// 申请状态类型
export type ApplicationStatus = "todo" | "applying" | "done";

// V5 新增：申请进度步骤
export type ApplicationStep = "materials" | "submitted" | "reviewed" | "received";

// V5 新增：申请进度跟踪（4 步）
export interface ApplicationProgress {
  status: ApplicationStatus;
  steps: {
    materials: boolean; // 材料准备完成
    submitted: boolean; // 已提交申请
    reviewed: boolean; // 审核通过
    received: boolean; // 已领取补贴
  };
  notes?: string;
  updatedAt?: number;
}

interface AppState {
  // 当前步骤
  currentStep: number;

  // 用户画像
  userProfile: UserProfile;

  // 匹配结果
  matchResult: MatchResult | null;

  // 加载状态
  isLoading: boolean;

  // 看板→报告页的联动筛选（例如点击玫瑰图某扇区后传递难度筛选）
  pendingFilter: { type: "difficulty"; value: string } | null;

  // 申请进度跟踪：policyId → status（V4 旧字段，保留兼容）
  applicationStatus: Record<string, ApplicationStatus>;

  // V5 新增：申请进度跟踪（4 步进度条）
  applicationProgress: Record<string, ApplicationProgress>;

  // Actions
  setCurrentStep: (step: number) => void;
  updateUserProfile: (partial: Partial<UserProfile>) => void;
  setMatchResult: (result: MatchResult | null) => void;
  setLoading: (loading: boolean) => void;
  setPendingFilter: (filter: { type: "difficulty"; value: string } | null) => void;
  setApplicationStatus: (policyId: string, status: ApplicationStatus) => void;
  // V5 新增：切换某一步骤的完成状态
  toggleApplicationStep: (policyId: string, step: ApplicationStep) => void;
  // V5 新增：设置申请备注
  setApplicationNotes: (policyId: string, notes: string) => void;
  // V5 新增：重置某政策的申请进度
  resetApplicationProgress: (policyId: string) => void;
  setUserProfile: (profile: UserProfile) => void;
  reset: () => void;
}

const defaultProfile: UserProfile = {
  identity: "应届毕业生",
  education: "本科",
  province: "北京",
  city: "北京",
  employmentStatus: "求职中",
  industryIntent: "不限",
};

// V5：根据步骤完成情况推断申请状态
function inferStatusFromSteps(steps: ApplicationProgress["steps"]): ApplicationStatus {
  if (steps.received) return "done";
  if (steps.materials || steps.submitted || steps.reviewed) return "applying";
  return "todo";
}

// V5：从旧版 applicationStatus 迁移到 ApplicationProgress
function migrateFromStatus(status: ApplicationStatus): ApplicationProgress {
  switch (status) {
    case "done":
      return {
        status: "done",
        steps: { materials: true, submitted: true, reviewed: true, received: true },
      };
    case "applying":
      return {
        status: "applying",
        steps: { materials: true, submitted: true, reviewed: false, received: false },
      };
    default:
      return {
        status: "todo",
        steps: { materials: false, submitted: false, reviewed: false, received: false },
      };
  }
}

// V4：持久化配置
// 只持久化 userProfile 和 currentStep（表单草稿）
// matchResult 不持久化（依赖 policies 运行时计算，且数据量大）
// V5：新增持久化 applicationStatus + applicationProgress（用户申请进度跨会话保留）
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentStep: 0,
      userProfile: defaultProfile,
      matchResult: null,
      isLoading: false,
      pendingFilter: null,
      applicationStatus: {},
      applicationProgress: {},

      setCurrentStep: (step) => set({ currentStep: step }),
      updateUserProfile: (partial) =>
        set((state) => ({ userProfile: { ...state.userProfile, ...partial } })),
      setUserProfile: (profile) => set({ userProfile: profile }),
      setMatchResult: (result) => set({ matchResult: result }),
      setLoading: (loading) => set({ isLoading: loading }),
      setPendingFilter: (filter) => set({ pendingFilter: filter }),
      setApplicationStatus: (policyId, status) =>
        set((state) => ({
          applicationStatus: { ...state.applicationStatus, [policyId]: status },
        })),
      // V5：切换某一步骤的完成状态
      // 业务规则：步骤必须按顺序——只能勾选当前步骤或下一步，不能跳步
      toggleApplicationStep: (policyId, step) =>
        set((state) => {
          const existing = state.applicationProgress[policyId];
          const oldStatus = state.applicationStatus[policyId];
          const current: ApplicationProgress = existing
            || migrateFromStatus(oldStatus || "todo");
          const steps = { ...current.steps };
          const stepOrder: ApplicationStep[] = ["materials", "submitted", "reviewed", "received"];
          const idx = stepOrder.indexOf(step);
          const newSteps = { ...steps };

          if (steps[step]) {
            // 取消该步骤：该步骤及其后所有步骤全部置 false
            for (let i = idx; i < stepOrder.length; i++) {
              newSteps[stepOrder[i]] = false;
            }
          } else {
            // 勾选该步骤：前置步骤必须全部完成
            for (let i = 0; i <= idx; i++) {
              newSteps[stepOrder[i]] = true;
            }
          }

          const newStatus = inferStatusFromSteps(newSteps);
          return {
            applicationProgress: {
              ...state.applicationProgress,
              [policyId]: {
                status: newStatus,
                steps: newSteps,
                notes: current.notes,
                updatedAt: Date.now(),
              },
            },
            applicationStatus: {
              ...state.applicationStatus,
              [policyId]: newStatus,
            },
          };
        }),
      // V5：设置申请备注
      setApplicationNotes: (policyId, notes) =>
        set((state) => {
          const existing = state.applicationProgress[policyId];
          const oldStatus = state.applicationStatus[policyId];
          const current: ApplicationProgress = existing
            || migrateFromStatus(oldStatus || "todo");
          return {
            applicationProgress: {
              ...state.applicationProgress,
              [policyId]: { ...current, notes, updatedAt: Date.now() },
            },
          };
        }),
      // V5：重置某政策的申请进度
      resetApplicationProgress: (policyId) =>
        set((state) => {
          const newProgress = { ...state.applicationProgress };
          delete newProgress[policyId];
          const newStatus = { ...state.applicationStatus };
          delete newStatus[policyId];
          return {
            applicationProgress: newProgress,
            applicationStatus: newStatus,
          };
        }),
      reset: () =>
        set({
          currentStep: 0,
          userProfile: defaultProfile,
          matchResult: null,
          isLoading: false,
          pendingFilter: null,
        }),
    }),
    {
      name: "policylens_store",
      // 持久化字段：表单草稿 + 申请进度
      partialize: (state) => ({
        userProfile: state.userProfile,
        currentStep: state.currentStep,
        applicationStatus: state.applicationStatus,
        applicationProgress: state.applicationProgress,
      }),
    }
  )
);
