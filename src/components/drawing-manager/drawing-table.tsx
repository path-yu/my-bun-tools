import React, { useEffect, useMemo, useState } from "react";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { ThemeProvider, createTheme, Box } from "@mui/material";
import { useAppTheme } from "@/components/ThemeContext"; // 确保路径正确
import { Drawing, CADConfig, CadBrand } from "@/lib/types";
import {
  FileText,
  Pencil,
  Copy,
  Check,
  FolderOpen,
  Zap,
  Trash2,
} from "lucide-react";
import { getElectroView } from "@/lib/rpc";
import { useConfirm } from "../useConfirm";
import { on } from "node:cluster";
import { useToast } from "../useToast";

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
  // 删除
  onDelete?: (drawing: Drawing) => void;
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
  onDelete,
}: DrawingTableProps) {
  const { isDark } = useAppTheme(); // 从全局状态获取主题
  const { confirm, ConfirmDialog } = useConfirm();
  const { showToast, ToastComponent } = useToast();
  // 1. 动态构建 MUI 主题以匹配应用设计
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: isDark ? "dark" : "light",
          primary: { main: "#3b82f6" }, // 建议保留一个基础 HEX
          // 关键：不要在这里直接引用 var()，改为在下方组件重写中引用
        },
        components: {
          MuiTableCell: {
            styleOverrides: {
              root: {
                // 使用细边框，并引用带透明度的变量
                borderBottom: "1px solid var(--border)",
                padding: "12px 16px",
              },
              head: {
                // 表头背景稍微加深，增加层级感
                backgroundColor: "oklch(0.18 0 0 / 0.5)",
                borderBottom: "2px solid var(--border)", // 表头边框稍微厚一点
                color: "var(--muted-foreground)",
              },
            },
          },
          MuiTableContainer: {
            styleOverrides: {
              root: {
                // 给整个表格容器加一个淡淡的圆角边框
                border: "1px solid var(--border)",
                borderRadius: "12px",
                backgroundColor: "var(--card)",
                overflow: "hidden", // 确保圆角生效
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
    if (!cadConfig?.path)  {
      return showToast("请先配置 CAD 路径", "error");
    }
    getElectroView()
      .rpc!.request.professionalCadNavigate({
        brand: cadTypeMap[cadConfig.type] || "AutoCAD",
        cadPath: cadConfig.path,
        materialCode: drawing.materialCode,
        dwgPath: drawing.filePath,
        x: drawing.x ?? 0,
        y: drawing.y ?? 0,
        zoomHeight: 500,
      })
      .then((result: any) => {
        if (result) {
          showToast(result,"error");
        }
      });
  };

  const handleQuickLocate = (drawing: Drawing) => {
    if (!cadConfig?.path)  {
      return showToast("请先配置 CAD 路径", "error");
    }
    getElectroView()
      .rpc!.request.locateInCad({
        cadType: (cadTypeMap[cadConfig.type] || "AutoCAD") as any,
        dwgPath: drawing.filePath,
        x: drawing.x ?? 0,
        y: drawing.y ?? 0,
        zoomHeight: 500,
      })
      .then((result: any) => {
        if (result) {
          showToast(result,"error");
        }
      });
  };

  const handleDeleteRow = async (row: any) => {
    // 1. 检查会话存储
    const skipConfirm = sessionStorage.getItem("skipDeleteConfirm") === "true";

    if (skipConfirm) {
      executeDelete(row); // 直接执行
      return;
    }

    // 2. 调用弹窗，传入 true 表示显示勾选框
    const { confirmed, dontShowAgain } = await confirm(
      "确认删除",
      `确定要删除 ${row.materialCode} 吗？`,
      true,
    );

    if (confirmed) {
      if (dontShowAgain) {
        sessionStorage.setItem("skipDeleteConfirm", "true");
      }
      executeDelete(row);
    }
  };

  const executeDelete = (row: any) => {
    console.log("执行删除:", row);
    // 你的删除 API 逻辑
    getElectroView()
      .rpc!.request.delete({ id: row.id })
      .then(() => {
        // 这里可以添加删除成功后的反馈，比如刷新列表
        console.log("删除成功");
        showToast("删除成功", "success");
        onDelete && onDelete(row); // 调用父组件传入的删除回调，刷新列表
      })
      .catch((err) => {
        console.error("删除失败:", err);
        showToast("删除失败", "error");
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
        <div className="flex gap-2 items-center">
          <button
            onClick={() => handleOpenInCAD(p.row)}
            // 修正：hover:text 改为 hover:bg，并稍微调整内边距和过渡效果
            className="flex items-center  h-5 gap-1 rounded-md px-2 py-1 text-[11px] cursor-pointer font-medium text-blue-400 hover:bg-blue-500/10 active:scale-95 transition-all"
          >
            <FolderOpen className="h-3 w-3" /> 首次
          </button>

          <button
            onClick={() => handleQuickLocate(p.row)}
            // 修正：hover:text 改为 hover:bg
            className="flex items-center  h-5 gap-1 rounded-md px-2 py-1 text-[11px] cursor-pointer font-medium text-amber-400 hover:bg-amber-500/10 active:scale-95 transition-all"
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
            className="truncate text-[15px] text-slate-500 italic opacity-80"
            title={p.value || "无备注"}
          >
            {p.value || "/"}
          </span>
        </div>
      ),
    },
    {
      field: "manage",
      headerName: "操作",
      width: 140, // 稍微加宽一点，确保三个按钮不拥挤
      sortable: false,
      align: "right",
      renderCell: (p) => {
        // 假设你的数据行中有 x, y, z 或者类似的坐标字段
        // 如果没有，请替换为 p.row.x 等实际字段名
        const coordinateCmd = `ZOOM C ${p.row.x || 0},${p.row.y || 0} 500 `; // 这里的命令格式需要根据你的 CAD 软件调整，确保它能正确解析坐标并执行定位

        return (
          <div className="flex items-center justify-end gap-1 h-full">
            {/* CAD 坐标定位 - 点击复制 Z C x,y,z */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(coordinateCmd);
                // 这里也可以同时调用你之前的 handleQuickLocate
              }}
              className="group p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all active:scale-90"
              title={`点击复制: ${coordinateCmd}`}
            >
              <div className="flex items-center gap-1">
                <Zap className="h-4 w-4" />
                {/* 隐藏的成功提示：点击时通过 Tailwind 的 active 状态显示 */}
                <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-active:opacity-100 bg-slate-800 text-white text-[10px] px-2 py-1 rounded transition-opacity"></span>
              </div>
            </button>

            {/* 编辑按钮 */}
            <button
              onClick={() => onEdit(p.row)}
              className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
              title="编辑"
            >
              <Pencil className="h-4 w-4" />
            </button>

            {/* 删除按钮 */}
            <button
              onClick={() => handleDeleteRow(p.row)}
              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
              title="删除"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      },
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
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          height: "calc(100vh - 200px)", // 自动占满高度
          width: "100%",
          bgcolor: "background.paper",
          borderRadius: "16px",
          overflow: "hidden",
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
              display: "flex",
              alignItems: "center",
              // 如果你希望操作按钮靠右对齐，可以使用以下配置
            },
            border: "none",
            "& .MuiDataGrid-virtualScroller": {
              backgroundColor: "background.default",
            },
            "& .MuiDataGrid-footerContainer": {
              borderTop: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
            },
            // 1. 去除单元格获得焦点时的蓝色外边框 (这是最核心的)
            "& .MuiDataGrid-cell:focus": {
              outline: "none !important",
            },
            // 2. 去除单元格在“选中”状态下的外边框
            "& .MuiDataGrid-cell:focus-within": {
              outline: "none !important",
            },
            // 3. 去除点击行时的蓝色/灰色外轮廓
            "& .MuiDataGrid-row:focus": {
              outline: "none !important",
            },
          }}
        />
      </Box>
      <ConfirmDialog />
      <ToastComponent />
    </ThemeProvider>
  );
}
