
import { createTheme } from "@mui/material";
import { useMemo } from "react";

export function useDataGridTheme(isDark: boolean) {
  return useMemo(
    () =>
      createTheme({
        palette: {
          mode: isDark ? "dark" : "light",
          primary: { main: "#3b82f6" },
          background: {
            default: isDark ? "#0f172a" : "#ffffff",
            paper: isDark ? "#1e293b" : "#ffffff",
          },
        },
        components: {
          MuiDataGrid: {
            styleOverrides: {
              root: {
                border: isDark ? "1px solid #1e293b" : "1px solid #e2e8f0",
                borderRadius: "12px",
                overflow: "hidden",
                backgroundColor: isDark ? "#0f172a" : "#ffffff",
              },
              columnHeader: {
                color: isDark ? "#cbd5e1" : "#475569",
                fontWeight: 600,
                fontSize: "13px",
              },
              cell: {
                borderBottom: isDark ? "1px solid #1e293b" : "1px solid #f1f5f9",
                color: isDark ? "#e2e8f0" : "#334155",
                fontSize: "13px",
              },
              row: {
                "&:hover": {
                  backgroundColor: isDark ? "rgba(59, 130, 246, 0.1)" : "#f8fafc",
                },
              },
            },
          },
        },
      }),
    [isDark],
  );
}

export function getDataGridSxStyles(isDark: boolean) {
  return {
    "& .MuiDataGrid-cell": {
      fontSize: "16px",
      display: "flex",
      alignItems: "center",
    },
    border: "none",
    "& .MuiDataGrid-virtualScroller": {
      backgroundColor: "background.default",
    },
    "& .MuiDataGrid-footerContainer": {
      borderTop: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
    },
    "& .MuiDataGrid-cell:focus": {
      outline: "none !important",
    },
    "& .MuiDataGrid-cell:focus-within": {
      outline: "none !important",
    },
    "& .MuiDataGrid-row:focus": {
      outline: "none !important",
    },
  };
}
