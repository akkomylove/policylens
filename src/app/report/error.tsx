"use client";

import { useEffect } from "react";

/**
 * V4 新增：报告页错误边界
 * 捕获渲染错误，显示友好提示
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("报告页渲染错误:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-3">😵</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          报告页出错了
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          页面渲染时发生错误，请尝试刷新或重新填写画像
        </p>
        {error.message && (
          <p className="text-xs text-gray-400 mb-4 bg-gray-50 rounded p-2 break-all">
            {error.message}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            重试
          </button>
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    </main>
  );
}
