import { toNetworkError, toBadResponseError, summarizeBody, pickServerMessage, logApiFailure } from "./apiError";

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

/**
 * fetch() ném `TypeError: Failed to fetch` cho mọi sự cố trước khi có HTTP response —
 * câu đó vô nghĩa với người dùng và không nói được request nào hỏng. Bọc lại một lần ở
 * đây để mọi lời gọi API trong app đều nhận lỗi đã phân loại, kèm log debug.
 */
async function fetchOrThrowFriendly(url, init, { method, path }) {
  const startedAt = Date.now();
  try {
    return await fetch(url, init);
  } catch (cause) {
    const error = toNetworkError(cause, {
      method,
      path,
      url,
      baseUrl: apiBaseUrl,
      elapsedMs: Date.now() - startedAt,
    });
    logApiFailure(error);
    throw error;
  }
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

// HTTP status không có thân phản hồi dùng được thì tự diễn giải cho người dùng, thay vì
// đổ nguyên trang HTML của proxy hay câu "Request failed with status 502" ra toast.
const STATUS_FALLBACK = {
  401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  403: "Bạn không có quyền thực hiện thao tác này.",
  404: "Không tìm thấy dữ liệu yêu cầu.",
  409: "Dữ liệu vừa bị thay đổi bởi người khác. Tải lại rồi thử lại.",
  413: "Tệp tải lên quá lớn.",
  429: "Bạn thao tác quá nhanh. Vui lòng chờ một lát rồi thử lại.",
  502: "Máy chủ đang không phản hồi (502). Có thể dịch vụ đang khởi động lại.",
  503: "Máy chủ đang quá tải hoặc bảo trì (503). Thử lại sau ít phút.",
  504: "Máy chủ xử lý quá lâu (504). Thử lại sau ít phút.",
};

const fallbackMessageFor = (status) =>
  STATUS_FALLBACK[status]
  || (status >= 500 ? `Máy chủ gặp lỗi (HTTP ${status}). Vui lòng thử lại sau.` : `Yêu cầu không thành công (HTTP ${status}).`);

async function parseResponse(response, { method = "GET", path = "" } = {}) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  let payload;
  try {
    payload = isJson ? await response.json() : await response.text();
  } catch (cause) {
    // Body hỏng giữa chừng, hoặc content-type nói JSON nhưng nội dung không phải JSON
    // (proxy chèn trang lỗi). Trước đây lỗi này nổi lên dạng "Unexpected token < in JSON".
    const error = toBadResponseError(cause, { method, path, url: response.url, status: response.status });
    logApiFailure(error);
    throw error;
  }

  if (payload && typeof payload === "object" && payload.csrfToken) {
    setStoredCsrfToken(payload.csrfToken);
  }

  if (!response.ok) {
    const retryAfterHeader = response.headers.get("retry-after") || response.headers.get("ratelimit-reset");
    const retryAfterSeconds = Number.parseInt(retryAfterHeader || "", 10);
    // Chỉ dùng thân phản hồi khi nó thật sự là lời nhắn; trang HTML của proxy thì bỏ qua
    // để rơi về câu mặc định theo status thay vì đổ mã HTML vào toast.
    const serverMessage = pickServerMessage(payload);
    const message = serverMessage || fallbackMessageFor(response.status);

    const error = new Error(message);
    // Trải payload trước, rồi mới ghi các trường của client — nếu làm ngược lại, một
    // payload có khoá trùng (status/path/message...) sẽ ghi đè mất thông tin thật.
    if (payload && typeof payload === "object") {
      Object.assign(error, payload);
    }
    error.message = message;
    error.status = response.status;
    error.method = String(method).toUpperCase();
    error.path = path;
    error.retryAfterSeconds = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds
      : 0;
    error.debug = `[http_${response.status}] ${error.method} ${path} | ${serverMessage || summarizeBody(payload) || "(không có thân phản hồi)"}`;

    if (response.status >= 500) logApiFailure(error);
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

    refreshPromise = fetchOrThrowFriendly(
      buildUrl("/auth/refresh"),
      { method: "POST", headers, credentials: "include" },
      { method: "POST", path: "/auth/refresh" },
    )
      .then(async (response) => {
        if (!response.ok) {
          const contentType = response.headers.get("content-type") || "";
          const payload = contentType.includes("application/json")
            ? await response.json().catch(() => null)
            : await response.text().catch(() => "");
          const message = pickServerMessage(payload)
            || "Không làm mới được phiên đăng nhập. Vui lòng đăng nhập lại.";
          const error = new Error(message);
          error.status = response.status;
          error.path = "/auth/refresh";
          error.debug = `[http_${response.status}] POST /auth/refresh | ${summarizeBody(payload) || "(không có thân phản hồi)"}`;
          throw error;
        }
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          // Body hỏng ở đây không đáng làm hỏng cả phiên — chỉ là chỗ lấy CSRF token mới
          const payload = await response.json().catch(() => null);
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

  const response = await fetchOrThrowFriendly(
    buildUrl(path),
    { method, headers: requestHeaders, body: requestBody, signal, credentials: "include" },
    { method, path },
  );

  const canAttemptRefresh =
    retryOnAuthFailure && !skipAuthRefresh && path !== "/auth/refresh" && path !== "/auth/login" && path !== "/auth/google";

  if (canAttemptRefresh && (await isRefreshableAuthFailure(response))) {
    await refreshAuthSession();
    return apiRequest(path, {
      ...options,
      retryOnAuthFailure: false,
    });
  }

  const payload = await parseResponse(response, { method, path });
  if (path === "/auth/logout") clearStoredCsrfToken();
  return payload;
}
