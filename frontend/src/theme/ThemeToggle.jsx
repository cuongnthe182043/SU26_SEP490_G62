import { Button, Tooltip } from "@heroui/react";
import { RiMoonLine, RiSunLine } from "react-icons/ri";
import { useTheme } from "./ThemeProvider";

/** Nút chuyển giao diện sáng/tối, dùng chung cho mọi TopBar. */
export default function ThemeToggle({ className = "" }) {
  const { isDark, toggleTheme } = useTheme();
  return (
    <Tooltip content={isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"} placement="bottom">
      <Button
        isIconOnly
        variant="flat"
        size="sm"
        aria-label="Đổi giao diện sáng/tối"
        onPress={toggleTheme}
        className={`h-9 w-9 text-gray-500 dark:text-gray-300 bg-gray-50 dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 transition-colors ${className}`}
      >
        {isDark ? <RiSunLine size={18} /> : <RiMoonLine size={18} />}
      </Button>
    </Tooltip>
  );
}
