import React from "react";
import { useAppTheme } from "@/components/ThemeContext";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

interface IOSButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "success" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export function IOSButton({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  disabled,
  children,
  style,
  ...props
}: IOSButtonProps) {
  const { isDark } = useAppTheme();

  // 1. 基础样式：添加 ios-transition 和 duration
  const baseStyles = "inline-flex items-center justify-center gap-2 font-medium rounded-[6px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ios-transition duration-300 ease-out active:scale-95";

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const getThemeStyles = () => {
    const styles = {
      primary: {
        bg: isDark ? "#3b82f6" : "#2563eb",
        text: "#ffffff",
        borderColor: "transparent",
        hoverBg: isDark ? "#60a5fa" : "#1d4ed8",
        activeBg: isDark ? "#93c5fd" : "#1e40af",
        shadow: `0 10px 25px -5px ${isDark ? "#3b82f6" : "#2563eb"}4D`,
      },
      secondary: {
        bg: isDark ? "#374151" : "#e5e7eb",
        text: isDark ? "#e5e7eb" : "#374151",
        borderColor: "transparent",
        hoverBg: isDark ? "#4b5563" : "#d1d5db",
        activeBg: isDark ? "#6b7280" : "#9ca3af",
        shadow: "0 0px 0px transparent", // 统一 shadow 格式有利于过渡
      },
      danger: {
        bg: isDark ? "#ef4444" : "#dc2626",
        text: "#ffffff",
        borderColor: "transparent",
        hoverBg: isDark ? "#f87171" : "#b91c1c",
        activeBg: isDark ? "#fca5a5" : "#991b1b",
        shadow: `0 10px 25px -5px ${isDark ? "#ef4444" : "#dc2626"}4D`,
      },
      success: {
        bg: isDark ? "#22c55e" : "#16a34a",
        text: "#ffffff",
        borderColor: "transparent",
        hoverBg: isDark ? "#4ade80" : "#15803d",
        activeBg: isDark ? "#86efac" : "#166534",
        shadow: `0 10px 25px -5px ${isDark ? "#22c55e" : "#16a34a"}4D`,
      },
      outline: {
        bg: "transparent",
        text: isDark ? "#e5e7eb" : "#374151",
        borderColor: isDark ? "#4b5563" : "#d1d5db",
        hoverBg: isDark ? "#374151" : "#f3f4f6",
        activeBg: isDark ? "#4b5563" : "#e5e7eb",
        shadow: "0 0px 0px transparent",
      },
    };
    return styles[variant];
  };

  const theme = getThemeStyles();

  // 2. 解决类型报错：将自定义属性放入 Record，然后断言为 React.CSSProperties
  const inlineStyle = {
    backgroundColor: theme.bg,
    color: theme.text,
    borderColor: theme.borderColor,
    boxShadow: theme.shadow,
    "--hover-bg": theme.hoverBg,
    "--active-bg": theme.activeBg,
    ...style,
  } as React.CSSProperties;

  return (
    <button
      className={cn(
        baseStyles,
        sizeStyles[size],
        variant === "outline" ? "border" : "border-none",
        // 使用 hover:bg-[var(--hover-bg)] 配合 ios-transition 即可实现平滑过渡
        "hover:bg-[var(--hover-bg)] active:bg-[var(--active-bg)]",
        className
      )}
      style={inlineStyle}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Spinner className="h-4 w-4 animate-spin" />
          <span className="opacity-70">{children}</span>
        </>
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}