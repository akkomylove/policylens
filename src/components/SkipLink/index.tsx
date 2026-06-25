/**
 * 跳过到主内容链接（无障碍）
 * 键盘 Tab 第一个聚焦元素，点击后跳到 #main-content
 * 视觉隐藏，仅在聚焦时显示
 */
export default function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-medium"
    >
      跳到主内容
    </a>
  );
}
