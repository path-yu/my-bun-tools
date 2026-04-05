
import React, { useEffect, useMemo, useState } from "react";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { ThemeProvider, createTheme, Box } from "@mui/material";
import { useAppTheme } from "@/components/ThemeContext"; // 确保路径正确
import { getElectroview } from "@/lib/rpc";
import { Drawing, CADConfig, CadBrand } from "@/lib/types";
import { FileText, Pencil, Copy, Check, FolderOpen, Zap } from "lucide-react";

// --- 内部小组件：分类标签 ---
// 1. 瘦身后的 Tag 组件
function CategoryBadge({ category }: { category: string }) {
  const colorMap = {
    卧式储气罐: "bg-blue-500/10 text-blue-400",
    碳钢: "bg-orange-500/10 text-orange-400",
    真空罐: "bg-emerald-500/10 text-emerald-400",
    其他: "bg-slate-500/10 text-slate-400",
  };
  return (
    <span
      className={`
      inline-flex items-center whitespace-nowrap rounded-full 
      px-2 py-0.5 text-[12px] font-medium border leading-tight
      ${colorMap[category as keyof typeof colorMap] || "bg-muted text-muted-foreground"}
    `}
    >
      {category}
    </span>
  );
}
// --- 内部小组件：带反馈的复制按钮 ---
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发行点击
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("复制失败");
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded hover:bg-slate-500/20 transition-colors"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 text-slate-400" />
      )}
    </button>
  );
}

interface DrawingTableProps {
  drawings: Drawing[];
  onEdit: (drawing: Drawing) => void;
  cadConfig?: CADConfig;
}

const cadTypeMap: Record<string, CadBrand> = {
  AutoCAD: "AutoCAD",
  中望CAD: "ZWCAD",
  浩辰CAD: "GstarCAD",
};

export function DrawingTable({
  drawings,
  onEdit,
  cadConfig,
}: DrawingTableProps) {
  const { isDark } = useAppTheme(); // 从全局状态获取主题

  // 1. 动态构建 MUI 主题以匹配应用设计
  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: isDark ? "dark" : "light",
          primary: { main: "#3b82f6" },
          background: {
            paper: isDark ? "#1e293b" : "#ffffff", // slate-800 : white
            default: isDark ? "#0f172a" : "#f8fafc", // slate-900 : slate-50
          },
        },
        components: {
          MuiDataGrid: {
            styleOverrides: {
              root: {
                border: "none",
                color: isDark ? "#f1f5f9" : "#1e293b",
                "& .MuiDataGrid-columnHeader": {
                  backgroundColor: isDark ? "#1e293b" : "#f8fafc",
                  borderBottom: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                },
                "& .MuiDataGrid-cell": {
                  borderBottom: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}`,
                  display: "flex",
                  alignItems: "center",
                },
                "& .MuiDataGrid-row:hover": {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.03)"
                    : "rgba(0, 0, 0, 0.02)",
                },
              },
            },
          },
        },
      }),
    [isDark],
  );
  useEffect(() => {
    // 同步 MUI 主题到 DOM，确保组件库样式正确切换
    const root = window.document.documentElement;
    console.log(isDark);

    if (isDark) {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, [isDark]);
  // 2. 业务逻辑处理
  const handleOpenInCAD = (drawing: Drawing) => {
    if (!cadConfig?.path) return alert("请先在设置中配置 CAD 安装路径");
    getElectroview().rpc!.request.professionalCadNavigate({
      brand: cadTypeMap[cadConfig.type] || "AutoCAD",
      cadPath: cadConfig.path,
      materialCode: drawing.materialCode,
      dwgPath: drawing.filePath,
      x: drawing.x ?? 0,
      y: drawing.y ?? 0,
      zoomHeight: 500,
    });
  };

  const handleQuickLocate = (drawing: Drawing) => {
    if (!cadConfig?.path) return alert("请先配置 CAD 路径");
    getElectroview().rpc!.request.locateInCad({
      cadType: (cadTypeMap[cadConfig.type] || "AutoCAD") as any,
      dwgPath: drawing.filePath,
      x: drawing.x ?? 0,
      y: drawing.y ?? 0,
      zoomHeight: 500,
    });
  };

  // 3. 数据预处理（添加计算属性如分类标签）
  const rows = useMemo(() => {
    return drawings.map((d) => {
      const fileName = d.fileName || "";
      const tag = fileName.includes("卧式")
        ? "卧式储气罐"
        : fileName.includes("碳钢")
          ? "碳钢"
          : fileName.includes("真空")
            ? "真空罐"
            : "其他";
      return { ...d, tag };
    });
  }, [drawings]);

  // 4. 定义表格列
  const columns: GridColDef[] = [
    {
      field: "materialCode",
      headerName: "物料编码",
      width: 160,
      renderCell: (p) => (
        <div className="flex items-center gap-1 overflow-hidden">
          <span className="truncate font-mono text-xs">{p.value}</span>
          <CopyButton text={p.value} />
        </div>
      ),
    },
    {
      field: "drawingNumber",
      headerName: "图号",
      width: 160,
      renderCell: (p) => (
        <span className="font-medium text-blue-500 truncate">{p.value}</span>
      ),
    },
    {
      field: "tag",
      headerName: "分类",
      width: 120,
      renderCell: (p) => <CategoryBadge category={p.value} />,
    },
    {
      field: "filePath",
      headerName: "路径",
      // 关键：flex: 1 让它自适应剩余空间，minWidth 保证最少可见度
      flex: 1,
      minWidth: 50,
      maxWidth: 200, // 关键：限制最大宽度，防止它抢占太多空间
      renderCell: (p) => (
        <div className="flex items-center w-full group">
          {/* 使用 max-w-[0] 配合 flex-1 是 DataGrid 中处理 truncate 的一个小技巧，
           它能确保 span 不会撑大父容器，从而正确触发省略号 
        */}
          <span
            className="flex-1 truncate text-[15px] text-slate-500 leading-none"
            title={p.value} // 鼠标悬停显示全路径
          >
            {p.value}
          </span>

          {/* 仅在鼠标悬停行时显示复制按钮，减少视觉干扰 */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-1">
            <CopyButton text={p.value} />
          </div>
        </div>
      ),
    },
    {
      field: "actions",
      headerName: "CAD 操作",
      width: 200,
      sortable: false,
      renderCell: (p: GridRenderCellParams) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleOpenInCAD(p.row)}
            className="flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-1 text-[11px] font-medium text-blue-400 hover:bg-blue-500/20 transition-all"
          >
            <FolderOpen className="h-3 w-3" /> 首次
          </button>
          <button
            onClick={() => handleQuickLocate(p.row)}
            className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-400 hover:bg-amber-500/20 transition-all"
          >
            <Zap className="h-3 w-3" /> 定位
          </button>
        </div>
      ),
    },
    {
    field: "remarks",
    headerName: "备注",
    flex: 1,
    minWidth: 150,
    maxWidth: 200, // 或者使用 flex: 0.5
    renderCell: (p) => (
      <div className="flex items-center w-full h-full">
        <span 
          className="truncate text-[11px] text-slate-500 italic opacity-80" 
          title={p.value || "无备注"}
        >
          {p.value || "-"}
        </span>
      </div>
    ),
  },
    {
      field: "manage",
      headerName: "",
      width: 60,
      sortable: false,
      align: "right",
      renderCell: (p) => (
        <button
          onClick={() => onEdit(p.row)}
          className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ),
    },
  ];

  if (drawings.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-2xl py-20 border-2 border-dashed ${
          isDark
            ? "bg-slate-800/30 border-slate-700"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        <FileText className="h-12 w-12 text-slate-600 mb-4 opacity-20" />
        <p className="text-sm text-slate-500">暂无图纸记录，请先添加</p>
      </div>
    );
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <Box
        sx={{
          height: "calc(100vh - 220px)", // 自动占满高度
          width: "100%",
          bgcolor: "background.paper",
          borderRadius: "16px",
          overflow: "hidden",
          border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
          boxShadow: isDark ? "none" : "0 4px 12px -2px rgba(0,0,0,0.05)",
        }}
      >
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id || row.materialCode}
          initialState={{
            pagination: { paginationModel: { pageSize: 100 } },
          }}
          pageSizeOptions={[50, 100, 200]}
          disableRowSelectionOnClick
          rowHeight={48}
          columnHeaderHeight={44}
          sx={{
            // 1. 设置单元格文字大小
            "& .MuiDataGrid-cell": {
              fontSize: "16px",
            },
            "& .MuiDataGrid-virtualScroller": {
              backgroundColor: "background.default",
            },
            "& .MuiDataGrid-footerContainer": {
              borderTop: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
            },
          }}
        />
      </Box>
    </ThemeProvider>
  );
}
