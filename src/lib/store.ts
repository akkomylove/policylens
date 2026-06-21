import { create } from "zustand";
import { persist } from "zustand/middleware";
import { UserProfile, MatchResult } from "@/types/policy";

// 申请状态类型
export type ApplicationStatus = "todo" | "applying" | "done";

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

  // 申请进度跟踪：policyId → status
  applicationStatus: Record<string, ApplicationStatus>;

  // Actions
  setCurrentStep: (step: number) => void;
  updateUserProfile: (partial: Partial<UserProfile>) => void;
  setMatchResult: (result: MatchResult | null) => void;
  setLoading: (loading: boolean) => void;
  setPendingFilter: (filter: { type: "difficulty"; value: string } | null) => void;
  setApplicationStatus: (policyId: string, status: ApplicationStatus) => void;
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

// V4：持久化配置
// 只持久化 userProfile 和 currentStep（表单草稿）
// matchResult 不持久化（依赖 policies 运行时计算，且数据量大）
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentStep: 0,
      userProfile: defaultProfile,
      matchResult: null,
      isLoading: false,
      pendingFilter: null,
      applicationStatus: {},

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
      // 只持久化表单草稿相关字段
      partialize: (state) => ({
        userProfile: state.userProfile,
        currentStep: state.currentStep,
      }),
    }
  )
);
