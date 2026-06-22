"use client";

import { useEffect, useRef, useState } from "react";

/**
 * V6：数字 count-up 动画 hook
 * 从 0 滚动到目标值，支持千分位格式化
 *
 * @param target 目标数值
 * @param duration 动画时长（毫秒），默认 1200
 * @param delay 延迟启动（毫秒），默认 0
 */
export function useCountUp(target: number, duration = 1200, delay = 0) {
  const [value, setValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // 延迟启动
    const timer = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (startTimeRef.current === null) {
          startTimeRef.current = timestamp;
        }
        const progress = Math.min(
          (timestamp - startTimeRef.current) / duration,
          1
        );
        // easeOutCubic 缓动函数
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.floor(eased * target));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          setValue(target);
        }
      };
      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      startTimeRef.current = null;
    };
  }, [target, duration, delay]);

  return value;
}

/**
 * 格式化数字为千分位字符串
 */
export function formatNumber(num: number): string {
  return num.toLocaleString("zh-CN");
}
