"use client";

import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

export interface ExportMeta {
  /** 用户画像摘要（用于页脚） */
  userSummary: string;
  /** 预估补贴 */
  subsidyEstimate: string;
  /** 报告生成时间 */
  generatedAt: Date;
}

interface ExportOptions {
  /** 输出文件名（不含扩展名） */
  filename: string;
  /** 页脚元信息 */
  meta: ExportMeta;
}

/**
 * 临时给 body 加 class，用于在导出时通过 CSS 隐藏不需要导出的元素
 * （筛选工具栏、按钮、返回顶部等）
 */
function withExportMode<T>(fn: () => Promise<T>): Promise<T> {
  document.body.classList.add("exporting-report");
  return fn().finally(() => {
    document.body.classList.remove("exporting-report");
  });
}

/**
 * 截取元素 canvas（共用逻辑）
 * 返回 canvas 及对应 scale（用于页脚文字尺寸换算）
 */
async function captureCanvas(
  element: HTMLElement
): Promise<{ canvas: HTMLCanvasElement; scale: number }> {
  // 等待一帧，让 CSS class 生效
  await new Promise((r) => requestAnimationFrame(r));

  const scale = window.devicePixelRatio > 1 ? 2 : 1.5;
  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    backgroundColor: "#f9fafb", // bg-gray-50
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });
  return { canvas, scale };
}

/**
 * 在 canvas 底部绘制水印页脚
 */
function drawFooter(
  canvas: HTMLCanvasElement,
  scale: number,
  meta: ExportMeta
): HTMLCanvasElement {
  const footerHeight = 80 * scale;
  const newCanvas = document.createElement("canvas");
  newCanvas.width = canvas.width;
  newCanvas.height = canvas.height + footerHeight;
  const newCtx = newCanvas.getContext("2d");
  if (!newCtx) return canvas;

  // 复制原 canvas
  newCtx.drawImage(canvas, 0, 0);

  // 页脚背景
  newCtx.fillStyle = "#f3f4f6";
  newCtx.fillRect(0, canvas.height, newCanvas.width, footerHeight);

  // 分隔线
  newCtx.fillStyle = "#e5e7eb";
  newCtx.fillRect(0, canvas.height, newCanvas.width, scale);

  // 页脚文字（所有尺寸基于 CSS 像素 × scale）
  const padding = 24 * scale;
  const fontSize = 12 * scale;

  newCtx.fillStyle = "#6b7280";
  newCtx.font = `${fontSize}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
  newCtx.textBaseline = "top";

  const dateStr = meta.generatedAt.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  // 第一行：用户画像摘要
  newCtx.fillText(
    `画像：${meta.userSummary}`,
    padding,
    canvas.height + 16 * scale
  );

  // 第二行：补贴预估 + 生成时间
  newCtx.fillText(
    `预估补贴：${meta.subsidyEstimate}　|　生成时间：${dateStr}　|　PolicyLens 政策体检`,
    padding,
    canvas.height + 40 * scale
  );

  // 免责声明
  newCtx.fillStyle = "#9ca3af";
  newCtx.font = `${fontSize * 0.85}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
  newCtx.fillText(
    "本报告由 AI 生成仅供参考，最终政策以官方发布为准",
    padding,
    canvas.height + 60 * scale
  );

  return newCanvas;
}

/**
 * 导出为 PNG 图片
 */
export async function exportAsImage(
  element: HTMLElement,
  options: ExportOptions
): Promise<void> {
  await withExportMode(async () => {
    const { canvas, scale } = await captureCanvas(element);
    const finalCanvas = drawFooter(canvas, scale, options.meta);

    // 触发下载
    finalCanvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `${options.filename}.png`);
    }, "image/png");
  });
}

/**
 * 导出为 PDF（A4 多页）
 */
export async function exportAsPDF(
  element: HTMLElement,
  options: ExportOptions
): Promise<void> {
  await withExportMode(async () => {
    const { canvas, scale } = await captureCanvas(element);
    const finalCanvas = drawFooter(canvas, scale, options.meta);

    const imgData = finalCanvas.toDataURL("image/jpeg", 0.92);

    // A4 纵向：210 x 297 mm
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // 图片按页面宽度等比缩放
    const imgWidth = pageWidth;
    const imgHeight = (finalCanvas.height * imgWidth) / finalCanvas.width;

    // 分页绘制
    let remaining = imgHeight;
    let position = 0;

    // 第一页
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    remaining -= pageHeight;

    // 后续页
    while (remaining > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      remaining -= pageHeight;
    }

    pdf.save(`${options.filename}.pdf`);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
