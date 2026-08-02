import { useTheme } from "./ThemeProvider";
import { APP_NAME, LOGO_DARK_SRC, LOGO_LIGHT_SRC } from "../constants/brand";

/**
 * Logo tự đổi theo theme: sáng dùng logo.png, tối dùng logodark.png.
 * Nhận mọi prop của <img> (className, alt, aria-hidden…).
 *
 * Đây là nơi DUY NHẤT được trỏ tới file ảnh logo — chỗ khác import component này.
 */
export default function Logo({ alt = APP_NAME, ...rest }) {
  const { isDark } = useTheme();
  return <img src={isDark ? LOGO_DARK_SRC : LOGO_LIGHT_SRC} alt={alt} {...rest} />;
}
