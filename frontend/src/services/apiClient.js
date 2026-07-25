const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (import.meta.env.PROD && !configuredApiBaseUrl) {
  throw new Error("Missing VITE_API_BASE_URL for production frontend build.");
}

const DEFAULT_API_BASE_URL = configuredApiBaseUrl || "http://localhost:9999";

export const apiBaseUrl = DEFAULT_API_BASE_URL;
let refreshPromise = null;
let csrfTokenCache = null;

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${apiBaseUrl}${path}`;
}

function getCookieValue(name) {
  if (typeof document === "undefined") return null;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? null;
}

function getStoredCsrfToken() {
  if (csrfTokenCache) return csrfTokenCache;
  if (typeof window === "undefined") return null;
  try {
    csrfTokenCache = window.sessionStorage.getItem("csrf_token");
  } catch {
    csrfTokenCache = null;
  }
  return csrfTokenCache;
}

function setStoredCsrfToken(token) {
  if (!token) return;
  csrfTokenCache = String(token);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem("csrf_token", csrfTokenCache);
  } catch {
    // Session storage can be unavailable in strict browser modes; memory cache still works.
  }
}

function clearStoredCsrfToken() {
  csrfTokenCache = null;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem("csrf_token");
  } catch {
    // Ignore storage cleanup failures.
  }
}

function getCsrfToken() {
  const cookieToken = getCookieValue("csrf_token");
  if (cookieToken) {
    const decoded = decodeURIComponent(cookieToken);
    setStoredCsrfToken(decoded);
    return decoded;
  }
  return getStoredCsrfToken();
}

function isUnsafeMethod(method) {
  return !["GET", "HEAD", "OPTIONS"].includes(String(method || "GET").toUpperCase());
}

function canBootstrapCsrf(path) {
  return ![
    "/auth/login",
    "/auth/google",
    "/auth/refresh",
    "/auth/forgot-password/request",
    "/auth/forgot-password/verify",
    "/auth/forgot-password/reset",
  ].includes(path);
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (payload && typeof payload === "object" && payload.csrfToken) {
    setStoredCsrfToken(payload.csrfToken);
  }

  if (!response.ok) {
    const retryAfterHeader = response.headers.get("retry-after") || response.headers.get("ratelimit-reset");
    const retryAfterSeconds = Number.parseInt(retryAfterHeader || "", 10);
    const message =
      (payload && typeof payload === "object" && (payload.error || payload.message)) ||
      (typeof payload === "string" && payload.trim()) ||
      `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.retryAfterSeconds = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds
      : 0;
    if (payload && typeof payload === "object") {
      Object.assign(error, payload);
    }
    throw error;
  }

  return payload;
}

// Access-token cookie có thể tự hết hạn/bị trình duyệt xoá trước khi request
// tới server, khi đó server trả 403 kèm code NO_TOKEN thay vì 401 (token có
// mặt nhưng không hợp lệ). Cả hai trường hợp đều nên thử refresh phiên;
// các 403 khác (tài khoản bị khoá, không đủ quyền) không có code này nên sẽ
// không bị thử refresh vô ích.
async function isRefreshableAuthFailure(response) {
  if (response.status === 401) return true;
  if (response.status !== 403) return false;

  try {
    const clone = response.clone();
    const contentType = clone.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return false;
    const payload = await clone.json();
    return payload?.code === "NO_TOKEN";
  } catch {
    return false;
  }
}

export async function refreshAuthSession() {
  if (!refreshPromise) {
    const headers = new Headers();
    const csrfToken = getCsrfToken();
    if (csrfToken) headers.set("X-CSRF-Token", csrfToken);

    refreshPromise = fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      headers,
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          const contentType = response.headers.get("content-type") || "";
          const payload = contentType.includes("application/json")
            ? await response.json()
            : await response.text();
          const message =
            (payload && typeof payload === "object" && (payload.error || payload.message)) ||
            (typeof payload === "string" && payload.trim()) ||
            "Unable to refresh session";
          throw new Error(message);
        }
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const payload = await response.json();
          if (payload?.csrfToken) setStoredCsrfToken(payload.csrfToken);
        }
        return response;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function apiRequest(path, options = {}) {
  const { method = "GET", body, token, headers = {}, signal } = options;
  const requestHeaders = new Headers(headers);
  const retryOnAuthFailure = options.retryOnAuthFailure !== false;
  const skipAuthRefresh = options.skipAuthRefresh === true;

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }
  if (isUnsafeMethod(method) && !requestHeaders.has("X-CSRF-Token")) {
    let csrfToken = getCsrfToken();
    if (!csrfToken && canBootstrapCsrf(path)) {
      try {
        await refreshAuthSession();
        csrfToken = getCsrfToken();
      } catch {
        // Let the original request surface the actual auth/CSRF error to the caller.
      }
    }
    if (csrfToken) requestHeaders.set("X-CSRF-Token", csrfToken);
  }

  let requestBody = body;
  if (body && !(body instanceof FormData)) {
    requestHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers: requestHeaders,
    body: requestBody,
    signal,
    credentials: "include",
  });

  const canAttemptRefresh =
    retryOnAuthFailure && !skipAuthRefresh && path !== "/auth/refresh" && path !== "/auth/login" && path !== "/auth/google";

  if (canAttemptRefresh && (await isRefreshableAuthFailure(response))) {
    await refreshAuthSession();
    return apiRequest(path, {
      ...options,
      retryOnAuthFailure: false,
    });
  }

  const payload = await parseResponse(response);
  if (path === "/auth/logout") clearStoredCsrfToken();
  return payload;
}
