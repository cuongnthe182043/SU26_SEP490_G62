import { useTheme } from "./ThemeProvider";

/**
 * Logo tự đổi theo theme: sáng dùng /logo.png, tối dùng /logodark.png.
 * Nhận mọi prop của <img> (className, alt, aria-hidden…).
 */
export default function Logo({ alt = "LogisCount", ...rest }) {
  const { isDark } = useTheme();
  return <img src={isDark ? "/logodark.png" : "/logo.png"} alt={alt} {...rest} />;
}
