import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "g62-theme";
const ThemeContext = createContext(null);

/** Đọc theme khởi tạo: ưu tiên lựa chọn đã lưu, fallback theo hệ điều hành. */
function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Gắn class `dark` + color-scheme lên <html> để Tailwind, HeroUI và trình duyệt đồng bộ. */
function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  root.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Theo dõi thay đổi của hệ điều hành — chỉ tự đổi khi người dùng CHƯA chọn thủ công.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return undefined;
    const onChange = (e) => {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        setThemeState(e.matches ? "dark" : "light");
      }
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const setTheme = useCallback((next) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === "dark", setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme phải được dùng bên trong <ThemeProvider>.");
  return ctx;
}
