import { useEffect, useState, useMemo } from "react";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { ThemeProvider, createTheme, Box } from "@mui/material";
import { Search, X, Calendar, User } from "lucide-react";
import { SyncLog } from "@/lib/types";
import { getElectroView } from "@/lib/rpc";
import { useAppTheme } from "@/components/ThemeContext";

interface LogListProps {
  sourcePath?: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getReasonTypeLabel(type: string): string {
  const map: Record<string, string> = {
    modify: "图纸修改",
    new: "上传新图纸",
    delete: "删除图纸",
    custom: "自定义",
  };
  return map[type] || type;
}

function getOperationLabel(op: string): string {
  return op === "syncToSource" ? "上传到源" : "从源更新";
}

export function LogList({ sourcePath }: LogListProps) {
  const { isDark } = useAppTheme();
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [reasonTypeFilter, setReasonTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  // 加载日志
  const loadLogs = async () => {
    setLoading(true);
    try {
      const result = await getElectroView().rpc!.request.getSyncLogs({ sourcePath });
      if (result.success && result.logs) {
        setLogs(result.logs);
      }
    } catch (err) {
      console.error("加载日志失败:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [sourcePath]);

  // 筛选日志
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 搜索筛选
      const matchesSearch = searchQuery
        ? log.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.createdBy.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      // 原因类型筛选
      const matchesReasonType = reasonTypeFilter === "all" || log.reasonType === reasonTypeFilter;

      // 日期筛选
      let matchesDate = true;
      if (dateFilter !== "all" && log.createdAt) {
        const logDate = new Date(log.createdAt).toDateString();
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        if (dateFilter === "today") {
          matchesDate = logDate === today;
        } else if (dateFilter === "yesterday") {
          matchesDate = logDate === yesterday;
        } else if (dateFilter === "week") {
          const weekAgo = Date.now() - 7 * 86400000;
          matchesDate = new Date(log.createdAt).getTime() >= weekAgo;
        }
      }

      return matchesSearch && matchesReasonType && matchesDate;
    });
  }, [logs, searchQuery, reasonTypeFilter, dateFilter]);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: isDark ? "dark" : "light",
          primary: { main: "#3b82f6" },
        },
        components: {
          MuiTableCell: {
            styleOverrides: {
              root: {
                borderBottom: "1px solid var(--border)",
                padding: "12px 16px",
              },
              head: {
                backgroundColor: "oklch(0.18 0 0 / 0.5)",
                borderBottom: "2px solid var(--border)",
                color: "var(--muted-foreground)",
              },
            },
          },
          MuiTableContainer: {
            styleOverrides: {
              root: {
                border: "1px solid var(--border)",
                borderRadius: "12px",
                backgroundColor: "var(--card)",
                overflow: "hidden",
              },
            },
          },
        },
      }),
    [isDark],
  );

  const columns: GridColDef[] = [
    {
      field: "createdAt",
      headerName: "时间",
      width: 180,
      renderCell: (p: GridRenderCellParams) => (
        <span className="text-sm text-slate-500 flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(p.value)}
        </span>
      ),
    },
    {
      field: "fileName",
      headerName: "文件名",
      flex: 1,
      minWidth: 150,
      renderCell: (p: GridRenderCellParams) => (
        <span className="font-medium truncate">{p.value}</span>
      ),
    },
    {
      field: "operation",
      headerName: "操作",
      width: 120,
      renderCell: (p: GridRenderCellParams) => (
        <span
          className={`px-2 py-0.5 rounded text-xs ${
            p.value === "syncToSource"
              ? isDark
                ? "bg-green-500/20 text-green-400"
                : "bg-green-50 text-green-700"
              : isDark
              ? "bg-blue-500/20 text-blue-400"
              : "bg-blue-50 text-blue-700"
          }`}
        >
          {getOperationLabel(p.value)}
        </span>
      ),
    },
    {
      field: "reasonType",
      headerName: "原因类型",
      width: 120,
      renderCell: (p: GridRenderCellParams) => (
        <span
          className={`px-2 py-0.5 rounded text-xs ${
            isDark ? "bg-purple-500/20 text-purple-400" : "bg-purple-50 text-purple-700"
          }`}
        >
          {getReasonTypeLabel(p.value)}
        </span>
      ),
    },
    {
      field: "reason",
      headerName: "原因详情",
      flex: 1,
      minWidth: 200,
      renderCell: (p: GridRenderCellParams) => (
        <span className="text-sm text-slate-600 dark:text-slate-400 truncate">
          {p.value}
        </span>
      ),
    },
    {
      field: "createdBy",
      headerName: "操作人",
      width: 120,
      renderCell: (p: GridRenderCellParams) => (
        <span className="text-sm text-slate-500 flex items-center gap-1">
          <User className="h-3 w-3" />
          {p.value}
        </span>
      ),
    },
  ];

  const rows = useMemo(() => {
    return filteredLogs.map((log) => ({
      id: log.id,
      ...log,
    }));
  }, [filteredLogs]);

  if (loading) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-2xl py-20 ${
          isDark ? "bg-slate-800/30" : "bg-slate-50"
        }`}
      >
        <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-slate-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border bg-card">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索文件名、原因或操作人..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
              isDark
                ? "bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
                : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={reasonTypeFilter}
          onChange={(e) => setReasonTypeFilter(e.target.value)}
          className={`px-3 py-2 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
            isDark
              ? "bg-slate-800 border-slate-700 text-slate-200"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <option value="all">所有原因类型</option>
          <option value="modify">图纸修改</option>
          <option value="new">上传新图纸</option>
          <option value="delete">删除图纸</option>
          <option value="custom">自定义</option>
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className={`px-3 py-2 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
            isDark
              ? "bg-slate-800 border-slate-700 text-slate-200"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <option value="all">所有时间</option>
          <option value="today">今天</option>
          <option value="yesterday">昨天</option>
          <option value="week">本周</option>
        </select>

        <button
          onClick={loadLogs}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isDark
              ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
              : "bg-blue-50 text-blue-600 hover:bg-blue-100"
          }`}
        >
          刷新
        </button>
      </div>

      {/* 数据表格 */}
      {filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border bg-card">
          <Search className="h-12 w-12 text-slate-600 mb-4 opacity-20" />
          <p className="text-sm text-slate-500">
            {searchQuery || reasonTypeFilter !== "all" || dateFilter !== "all"
              ? "没有找到匹配的日志"
              : "暂无同步日志"}
          </p>
        </div>
      ) : (
        <ThemeProvider theme={theme}>
          <Box
            sx={{
              height: "calc(100vh - 260px)",
              width: "100%",
              bgcolor: "background.paper",
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            <DataGrid
              rows={rows}
              columns={columns}
              getRowId={(row) => row.id}
              initialState={{
                pagination: { paginationModel: { pageSize: 50 } },
                sorting: { sortModel: [{ field: "createdAt", sort: "desc" }] },
              }}
              pageSizeOptions={[20, 50, 100]}
              disableRowSelectionOnClick
              rowHeight={48}
              columnHeaderHeight={44}
              sx={{
                "& .MuiDataGrid-cell": {
                  fontSize: "14px",
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
              }}
            />
          </Box>
        </ThemeProvider>
      )}
    </div>
  );
}
