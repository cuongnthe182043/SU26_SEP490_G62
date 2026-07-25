import React from "react";
import { Spinner } from "@heroui/react";

export default function LoadingState({
  label = "Đang tải...",
  size = "md",
  color = "primary",
  className = "",
}) {
  return (
    <div
      className={`flex items-center justify-center gap-3 py-8 text-sm text-gray-500 dark:text-gray-400 ${className}`}
      role="status"
      aria-live="polite"
    >
      <Spinner size={size} color={color} />
      <span>{label}</span>
    </div>
  );
}
