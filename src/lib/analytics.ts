// ============ 轻量自托管数据埋点客户端 ============
// 使用 navigator.sendBeacon 上报事件，不阻塞页面、不依赖第三方
// 服务端接收：/api/track

export interface TrackEvent {
  name: string;
  props?: Record<string, string | number | boolean | undefined>;
  ts?: number;
}

let sessionId = "";
let sessionStart = 0;

// 初始化会话 ID（页面打开时一次性生成）
function initSession() {
  if (typeof window === "undefined") return;
  if (sessionId) return;
  sessionId =
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  sessionStart = Date.now();
}

/**
 * 上报一个事件
 * @param name 事件名（如 page_view / profile_submit / match_complete）
 * @param props 事件属性
 */
export function track(
  name: string,
  props?: Record<string, string | number | boolean | undefined>
): void {
  if (typeof window === "undefined") return;
  initSession();

  const event: TrackEvent & {
    sessionId: string;
    sessionDuration: number;
    path: string;
    referrer: string;
  } = {
    name,
    props,
    ts: Date.now(),
    sessionId,
    sessionDuration: Date.now() - sessionStart,
    path: window.location.pathname,
    referrer: document.referrer,
  };

  // 使用 sendBeacon 不阻塞页面卸载
  const blob = new Blob([JSON.stringify(event)], {
    type: "application/json",
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", blob);
    } else {
      // 降级：fetch with keepalive
      fetch("/api/track", {
        method: "POST",
        body: JSON.stringify(event),
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // 静默失败，不影响用户体验
  }
}

/**
 * 自动页面访问埋点
 * 在客户端组件挂载时调用
 */
export function trackPageView(path?: string): void {
  track("page_view", { path: path || (typeof window !== "undefined" ? window.location.pathname : "") });
}
