"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";

type EChartsInstance = echarts.ECharts;
type EChartsOption = echarts.EChartsCoreOption;

/**
 * ECharts 自定义 hook
 * 统一处理 init / setOption / resize / dispose 生命周期
 * @param option ECharts 配置
 * @param deps 依赖数组（option 变化时重建图表）
 * @param onChartReady 图表初始化完成回调（用于绑定事件等）
 */
export function useEChart(
  option: EChartsOption,
  deps: React.DependencyList,
  onChartReady?: (chart: EChartsInstance) => void
) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<EChartsInstance | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);
    chartInstanceRef.current = chart;
    chart.setOption(option);
    onChartReady?.(chart);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { chartRef, chartInstanceRef };
}

export { echarts };
export type { EChartsInstance, EChartsOption };
