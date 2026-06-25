"use client";

import { useState, useRef } from "react";
import { Download, FileImage, FileType, Loader2 } from "lucide-react";
import { track } from "@/lib/analytics";

interface ReportExportMenuProps {
  /** 用户画像摘要 */
  userSummary: string;
  /** 预估补贴 */
  subsidyEstimate: string;
  /** 显示 toast 提示（由父组件提供） */
  showToast: (message: string, type?: "success" | "error") => void;
}

type ExportType = "pdf" | "image";

export default function ReportExportMenu({
  userSummary,
  subsidyEstimate,
  showToast,
}: ReportExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<ExportType | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleExport = async (type: ExportType) => {
    const root = document.getElementById("report-export-root");
    if (!root) {
      showToast("找不到报告内容", "error");
      return;
    }

    setLoading(type);
    setOpen(false);

    try {
      // 动态导入，减小首屏 bundle
      const { exportAsPDF, exportAsImage } = await import("@/lib/exportReport");

      const filename = `政策体检报告_${new Date()
        .toISOString()
        .slice(0, 10)}`;
      const meta = {
        userSummary,
        subsidyEstimate,
        generatedAt: new Date(),
      };

      if (type === "pdf") {
        await exportAsPDF(root, { filename, meta });
      } else {
        await exportAsImage(root, { filename, meta });
      }

      track("report_export", {
        type,
        policy_count: root.querySelectorAll("[data-policy-card]").length,
      });
      showToast(type === "pdf" ? "PDF 已导出" : "图片已导出");
    } catch (err) {
      console.error("导出失败:", err);
      showToast("导出失败，请重试", "error");
    } finally {
      setLoading(null);
    }
  };

  const isLoading = loading !== null;

  return (
    <div className="relative no-export" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isLoading}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="导出报告"
        className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-60"
      >
        {isLoading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Download size={12} />
        )}
        {loading === "pdf"
          ? "PDF 中..."
          : loading === "image"
          ? "图片中..."
          : "导出"}
      </button>

      {open && !isLoading && (
        <>
          {/* 点击外部关闭 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[160px]"
          >
            <button
              role="menuitem"
              onClick={() => handleExport("pdf")}
              className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <FileType size={14} className="text-red-500" />
              <div>
                <div className="font-medium">PDF 文件</div>
                <div className="text-[10px] text-gray-400">A4 多页，可打印</div>
              </div>
            </button>
            <button
              role="menuitem"
              onClick={() => handleExport("image")}
              className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <FileImage size={14} className="text-emerald-500" />
              <div>
                <div className="font-medium">PNG 图片</div>
                <div className="text-[10px] text-gray-400">适合微信分享</div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
