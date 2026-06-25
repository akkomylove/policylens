// PolicyLens Service Worker
// 三层缓存策略：
// 1. policies.json / cities.json / stats.json —— cache-first（数据变动低频，离线可用）
// 2. Next.js 静态资源（_next/static）—— cache-first（哈希命名，可长期缓存）
// 3. 页面导航（HTML）—— stale-while-revalidate（先返回缓存，后台更新）
// 4. API 调用（/api/*）—— network-only（AI 解读必须实时调用，不缓存）

const SW_VERSION = "v6.1-20260625";
const STATIC_CACHE = `pl-static-${SW_VERSION}`;
const DATA_CACHE = `pl-data-${SW_VERSION}`;
const PAGE_CACHE = `pl-page-${SW_VERSION}`;

const DATA_URLS = ["/data/policies.json", "/data/cities.json", "/data/stats.json"];

// 安装：预缓存核心数据
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(DATA_CACHE)
      .then((cache) => cache.addAll(DATA_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("[SW] 预缓存失败:", err))
  );
});

// 激活：清理旧版本缓存
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![STATIC_CACHE, DATA_CACHE, PAGE_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// 请求拦截
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // 仅处理 GET 请求
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 同源检查
  if (url.origin !== self.location.origin) return;

  // 1. API 调用：network-only（不缓存 AI 解读结果）
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 2. 数据 JSON：cache-first
  if (DATA_URLS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, DATA_CACHE));
    return;
  }

  // 3. Next.js 静态资源：cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 4. 页面导航：stale-while-revalidate
  if (request.mode === "navigate") {
    event.respondWith(staleWhileRevalidate(request, PAGE_CACHE));
    return;
  }

  // 5. 其他资源（图片、字体等）：stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// cache-first：先查缓存，无则请求并缓存
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    // 离线且无缓存：返回简单降级响应
    return new Response(JSON.stringify({ error: "离线模式，数据暂不可用" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// stale-while-revalidate：先返回缓存，后台更新
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

// 消息通信：允许页面主动触发更新
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
