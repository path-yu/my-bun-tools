"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
// 引入 MUI 的主题相关组件
import { ThemeProvider as MUIThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const isDark = theme === "dark";

  // 1. 初始化逻辑保持不变
  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme;
    if (saved) {
      setTheme(saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // 2. 使用 useMemo 创建 MUI 主题对象
  // 这样当 isDark 改变时，MUI 的全局样式会自动更新
  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: theme, // 让 MUI 知道当前是深色还是浅色模式
        },
        components: {
          // 修复下拉菜单在深色模式下的白底问题
          MuiMenu: {
            styleOverrides: {
              paper: {
                backgroundColor: isDark ? "#1e293b" : "#ffffff",
                backgroundImage: "none",
                border: `1px solid ${isDark ? "#475569" : "#e2e8f0"}`,
                color: isDark ? "#e2e8f0" : "#1e293b",
              },
            },
          },
          // 可选：顺便修复 MenuItem 的悬停效果
          MuiMenuItem: {
            styleOverrides: {
              root: {
                "&:hover": {
                  backgroundColor: isDark ? "#334155" : "#f1f5f9",
                },
                "&.Mui-selected": {
                  backgroundColor: isDark ? "#3b82f64D" : "#3b82f61A",
                  "&:hover": {
                    backgroundColor: isDark ? "#3b82f666" : "#3b82f633",
                  },
                },
              },
            },
          },
        },
      }),
    [theme, isDark]
  );

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark }}>
      {/* 3. 嵌套 MUI 的 ThemeProvider */}
      <MUIThemeProvider theme={muiTheme}>
        {/* CssBaseline 可以帮助统一不同浏览器的默认样式，并应用背景色 */}
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
}

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useAppTheme must be used within ThemeProvider");
  return context;
};