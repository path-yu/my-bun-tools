import React, { useEffect, useMemo, useState } from "react";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { ThemeProvider, Box } from "@mui/material";
import { useAppTheme } from "@/components/ThemeContext";
import { Drawing, CADConfig, CadBrand } from "@/lib/types";
import zhCN from "@/lib/locale";
import { useDataGridTheme, getDataGridSxStyles } from "../useDataGrid";
import {
  FileText,
  Pencil,
  Copy,
  Check,
  FolderOpen,
  Zap,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { getElectroView } from "@/lib/rpc";
import { useConfirm } from "../useConfirm";
import { useToast } from "../useToast";
import { IOSButton } from "../IOSButton";
import { SelectDropdown } from "../SelectDropdown";
import { IOSInput } from "../IOSInput";



function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("复制失败");
    }
  };

  return (
    <IOSButton size="sm" variant="secondary" onClick={handleCopy} className="ml-1 !p-1">
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 text-slate-400" />
      )}
    </IOSButton>
  );
}

interface DrawingTableProps {
  drawings: Drawing[];
  onEdit: (drawing: Drawing) => void;
  onDelete?: (drawing: Drawing) => void;
  onRefresh?: () => void;
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
  onRefresh,
}: DrawingTableProps) {
  const { isDark } = useAppTheme();
  const { confirm, ConfirmDialog } = useConfirm();
  const { showToast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [drawingNumber, setDrawingNumber] = useState("");
  const [materialCode, setMaterialCode] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedBasePath, setSelectedBasePath] = useState<string>("");
  const [openMode, setOpenMode] = useState<"edit" | "readonly">("readonly");
  const [openInCadLoading, setOpenInCadLoading] = useState<Set<string>>(new Set());
  const [quickLocateLoading, setQuickLocateLoading] = useState<Set<string>>(new Set());
  const theme = useDataGridTheme(isDark);
  const basePathOptions = useMemo(() => {
    const sourcePath = localStorage.getItem("sourcePath");
    const localPath = localStorage.getItem("localPath");
    const options: { value: string; label: string }[] = [];
    if (sourcePath) {
      options.push({ value: sourcePath, label: `远程目录: ${sourcePath}` });
    }
    if (localPath) {
      options.push({ value: localPath, label: `本地目录: ${localPath}` });
    }
    if (options.length === 0) {
      options.push({ value: "", label: "未配置目录" });
    }
    return options;
  }, []);

  useEffect(() => {
    const sourcePath = localStorage.getItem("sourcePath");
    const localPath = localStorage.getItem("localPath");
    setSelectedBasePath(sourcePath || localPath || "");
  }, []);

  const getFullDwgPath = (drawing: Drawing): string => {
    if (!selectedBasePath) {
      return drawing.filePath;
    }
    const fileName = drawing.fileName || "";
    const fullPath = `${selectedBasePath}\\${fileName}.dwg`;
    return fullPath;
  };

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, [isDark]);

  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    drawings.forEach((d) => {
      const fileName = (d.fileName || "").trim();
      categorySet.add(fileName);
    });
    return Array.from(categorySet).sort();
  }, [drawings]);

  const categoryOptions = useMemo(() => {
    return [
      { value: "all", label: "全部分类" },
      ...categories.map((cat) => ({ value: cat, label: cat })),
    ];
  }, [categories]);

  const filteredDrawings = useMemo(() => {
    let filtered = drawings;

    if (selectedCategory !== "all") {
      filtered = filtered.filter((d) => {
        const fileName = (d.fileName || "").trim();
        return fileName === selectedCategory;
      });
    }

    if (drawingNumber.trim()) {
      const search = drawingNumber.toLowerCase();
      filtered = filtered.filter((d) =>
        d.drawingNumber.toLowerCase().includes(search)
      );
    }

    if (materialCode.trim()) {
      const search = materialCode.toLowerCase();
      filtered = filtered.filter((d) =>
        d.materialCode.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [drawings, selectedCategory, drawingNumber, materialCode]);

  const rows = useMemo(() => {
    return filteredDrawings.map((d) => {
      const fileName = (d.fileName || "").trim();
      return {
        ...d,
        fileName,
        tag: d.fileName,
      };
    });
  }, [filteredDrawings]);

  const handleOpenInCAD = (drawing: Drawing, isReadOnly: boolean = false) => {
    if (!cadConfig?.path) {
      return showToast("请先配置 CAD 路径", "error");
    }
    const rowId = drawing.id || drawing.materialCode;
    if (openInCadLoading.has(rowId)) return;
    
    setOpenInCadLoading(prev => new Set(prev).add(rowId));
    
    const fullDwgPath = getFullDwgPath(drawing);
    getElectroView()
      .rpc!.request.professionalCadNavigate({
        brand: cadTypeMap[cadConfig.type] || "AutoCAD",
        cadPath: cadConfig.path,
        dwgPath: fullDwgPath,
        x: drawing.x ?? 0,
        y: drawing.y ?? 0,
        zoomHeight: 500,
        isReadOnly,
      })
      .then((result: any) => {
        setOpenInCadLoading(prev => {
          const next = new Set(prev);
          next.delete(rowId);
          return next;
        });
        if (result) {
          if (
            result.includes("失败") ||
            result.includes("错误") ||
            result.includes("超时")
          ) {
            showToast(result, "error");
          } else {
            showToast(result, "success");
          }
        }
      })
      .catch(() => {
        setOpenInCadLoading(prev => {
          const next = new Set(prev);
          next.delete(rowId);
          return next;
        });
      });
  };

  const handleQuickLocate = (drawing: Drawing, isReadOnly: boolean = false) => {
    if (!cadConfig?.path) {
      return showToast("请先配置 CAD 路径", "error");
    }
    const rowId = drawing.id || drawing.materialCode;
    if (quickLocateLoading.has(rowId)) return;
    
    setQuickLocateLoading(prev => new Set(prev).add(rowId));
    
    const fullDwgPath = getFullDwgPath(drawing);
    getElectroView()
      .rpc!.request.locateInCad({
        cadType: (cadTypeMap[cadConfig.type] || "AutoCAD") as any,
        dwgPath: fullDwgPath,
        x: drawing.x ?? 0,
        y: drawing.y ?? 0,
        zoomHeight: 500,
        isReadOnly,
      })
      .then((result: any) => {
        setQuickLocateLoading(prev => {
          const next = new Set(prev);
          next.delete(rowId);
          return next;
        });
        if (result) {
          if (result.includes("失败") || result.includes("错误")) {
            showToast(result, "error");
          } else {
            showToast("定位指令已发送", "success");
          }
        }
      })
      .catch(() => {
        setQuickLocateLoading(prev => {
          const next = new Set(prev);
          next.delete(rowId);
          return next;
        });
        showToast("定位指令失败", "error");
      });
  };

  const handleDeleteRow = async (row: any) => {
    const skipConfirm = sessionStorage.getItem("skipDeleteConfirm") === "true";
    if (skipConfirm) {
      executeDelete(row);
      return;
    }

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
    getElectroView()
      .rpc!.request.delete({ id: row.id })
      .then(() => {
        showToast("删除成功", "success");
        onDelete && onDelete(row);
      })
      .catch((err) => {
        console.error("删除失败:", err);
        showToast("删除失败", "error");
      });
  };

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
      field: "fileName",
      headerName: "文件名",
      width: 160,
      renderCell: (p) => (
        <span className="truncate font-mono text-xs cursor-pointer">{p.value}</span>
      ),
    },
    {
      field: "created_at",
      headerName: "修改/创建日期",
      width: 150,
      renderCell: (p) => {
        if (!p.value) return <span className="text-slate-400">/</span>;
        const date = new Date(p.value);
        return (
          <span className="text-[12px] text-slate-500">
            {date.toLocaleString("zh-CN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        );
      },
    },
    {
      field: "actions",
      headerName: "操作",
      width: 220,
      sortable: false,
      renderCell: (p: GridRenderCellParams) => {
        const rowId = p.row.id || p.row.materialCode;
        const isOpenLoading = openInCadLoading.has(rowId);
        const isLocateLoading = quickLocateLoading.has(rowId);
        
        return (
          <div className="flex gap-2 items-center">
            <IOSButton size="sm" variant="primary" loading={isOpenLoading} disabled={isOpenLoading} onClick={() => handleOpenInCAD(p.row, openMode === "readonly")}>
              {isOpenLoading ? "打开中..." : <><FolderOpen className="h-3 w-3" /> 打开定位</>}
            </IOSButton>
            <IOSButton size="sm" variant="secondary" loading={isLocateLoading} disabled={isLocateLoading} onClick={() => handleQuickLocate(p.row, openMode === "readonly")}>
              {isLocateLoading ? "定位中..." : <><Zap className="h-3 w-3" /> 定位</>}
            </IOSButton>
          </div>
        );
      },
    },
    {
      field: "remarks",
      headerName: "备注",
      flex: 1,
      minWidth: 150,
      maxWidth: 200,
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
      width: 100,
      sortable: false,
      align: "right",
      renderCell: (p) => {
        const coordinateCmd = `ZOOM C ${p.row.x || 0},${p.row.y || 0} 500 `;

        return (
          <div className="flex items-center justify-end gap-1 h-full">
            <IOSButton size="sm" variant="secondary" onClick={() => {
                navigator.clipboard.writeText(coordinateCmd);
              }} title={`点击复制: ${coordinateCmd}`}>
              <Zap className="h-4 w-4" />
            </IOSButton>
            <IOSButton size="sm" variant="secondary" onClick={() => onEdit(p.row)} title="编辑">
              <Pencil className="h-4 w-4" />
            </IOSButton>
            <IOSButton size="sm" variant="danger" onClick={() => handleDeleteRow(p.row)} title="删除">
              <Trash2 className="h-4 w-4" />
            </IOSButton>
          </div>
        );
      },
    },
  ];


  if (drawings.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-2xl py-20 border-2 border-dashed ${isDark
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
          width: "100%",
          bgcolor: "background.paper",
          borderRadius: "16px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            p: 2,
            borderBottom: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
            display: "flex",
            justifyContent: "space-between",
            gap: 2,
            alignItems: "center",
          }}
        >
          <SelectDropdown
            options={basePathOptions}
            value={selectedBasePath}
            onChange={setSelectedBasePath}
            direction="left"
          />
          <div className="flex flex-end">
            <div className="flex items-center gap-2">
              <IOSInput
                value={drawingNumber}
                onChange={(value) => setDrawingNumber(value)}
                placeholder="图号..."
                className="w-40"
              />
              <IOSInput
                value={materialCode}
                onChange={(value) => setMaterialCode(value)}
                placeholder="物料编码..."
                className="w-40"
              />
              <IOSButton size="sm" variant="secondary" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </IOSButton>
            </div>
            <div className="ml-2">
              <SelectDropdown
                options={categoryOptions}
                value={selectedCategory}
                onChange={setSelectedCategory}
              />
            </div>
            <div className="ml-2">
              <SelectDropdown
                options={[
                  { value: "edit", label: "编辑模式" },
                  { value: "readonly", label: "只读模式" },
                ]}
                value={openMode}
                onChange={(value) => setOpenMode(value as any)}
              />
            </div>
          </div>

        </Box>
        <Box sx={{ height: "calc(100vh - 300px)" }}>
          <DataGrid
            rows={rows}
            columns={columns}
            localeText={zhCN}
            getRowId={(row) => row.id || row.materialCode}
            initialState={{
              pagination: { paginationModel: { pageSize: 100 } },
            }}
            pageSizeOptions={[50, 100, 200]}
            disableRowSelectionOnClick
            rowHeight={48}
            columnHeaderHeight={44}
            sx={getDataGridSxStyles(isDark)}
          />
        </Box>      </Box>
      <ConfirmDialog />
    </ThemeProvider>
  );
}

