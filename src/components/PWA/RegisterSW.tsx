"use client";

import { useEffect } from "react";

/**
 * Service Worker 注册器
 * 仅在生产环境注册，避免开发环境的缓存干扰 HMR
 */
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        // 检测到新版本时主动激活
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // 通知用户有新版本（V6.1 简化：直接激活）
              newWorker.postMessage("SKIP_WAITING");
            }
          });
        });
      } catch (err) {
        console.warn("[PWA] SW 注册失败:", err);
      }
    };

    register();
  }, []);

  return null;
}
