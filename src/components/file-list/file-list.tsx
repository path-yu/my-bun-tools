import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { ThemeProvider, Box, Modal, Typography, Button } from "@mui/material";
import { FileText, Folder, FolderOpen, Search, Download, Upload, X, RefreshCw, FolderSearch, Edit, Eye } from "lucide-react";
import { FileInfo, SyncReasonType } from "@/lib/types";
import { eventBus, getElectroView } from "@/lib/rpc";
import { useAppTheme } from "@/components/ThemeContext";
import { useToast } from "../useToast";
import { Fade } from "@mui/material";
import { readCadConfig } from "@/lib/utils";
import { SelectDropdown } from "../SelectDropdown";
import { IOSInput } from "../IOSInput";
import { SyncReasonModal } from "./SyncReasonModal";
import zhCN from "@/lib/locale";
import { useDataGridTheme } from "../useDataGrid";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";

interface FileListProps {
  searchQuery: string;
  sourcePath?: string;
  onSourcePathChange?: (path: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === queryLower.length;
}

const FILE_TYPE_MAP: Record<string, string> = {
  dwg: "AutoCAD图纸",
  dxf: "DXF图纸",
  pdf: "PDF文档",
  xls: "Excel表格",
  xlsx: "Excel表格",
  doc: "Word文档",
  docx: "Word文档",
  txt: "文本文件",
  jpg: "JPG图片",
  jpeg: "JPEG图片",
  png: "PNG图片",
  gif: "GIF图片",
  bmp: "BMP图片",
  zip: "ZIP压缩包",
  rar: "RAR压缩包",
  "7z": "7Z压缩包",
};

function getFileType(ext: string): string {
  return FILE_TYPE_MAP[ext.toLowerCase()] || ext.toUpperCase() + "文件";
}

type FileType = "all" | "excel" | "dwg" | "word" | "ppt" | "pdf" | "image";

const FILE_TYPE_EXTENSIONS: Record<FileType, string[]> = {
  all: [],
  excel: ["xls", "xlsx", "csv"],
  dwg: ["dwg", "dxf", "dwt"],
  word: ["doc", "docx", "txt"],
  ppt: ["ppt", "pptx"],
  pdf: ["pdf"],
  image: ["jpg", "jpeg", "png", "gif", "bmp"],
};

const CLONE_TYPE_OPTIONS: Array<{ id: FileType; label: string; extensions: string[] }> = [
  { id: "all", label: "全部文件", extensions: [] },
  { id: "dwg", label: "AutoCAD图纸 (.dwg, .dxf)", extensions: ["dwg", "dxf", "dwt"] },
  { id: "excel", label: "Excel表格 (.xls, .xlsx)", extensions: ["xls", "xlsx", "csv"] },
  { id: "word", label: "Word文档 (.doc, .docx)", extensions: ["doc", "docx", "txt"] },
  { id: "ppt", label: "PowerPoint (.ppt, .pptx)", extensions: ["ppt", "pptx"] },
  { id: "pdf", label: "PDF文档 (.pdf)", extensions: ["pdf"] },
  { id: "image", label: "图片文件 (.jpg, .png, 等)", extensions: ["jpg", "jpeg", "png", "gif", "bmp"] },
];



export function FileList({ searchQuery: propSearchQuery, sourcePath: propSourcePath, onSourcePathChange }: FileListProps) {
  const { isDark } = useAppTheme();
  const { showToast } = useToast();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourcePath, setSourcePath] = useState<string>(propSourcePath || localStorage.getItem("sourcePath") || "");
  const [localPath, setLocalPath] = useState<string>(localStorage.getItem("localPath") || "");
  const [selectedFileType, setSelectedFileType] = useState<FileType>('dwg');
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloneSelectedTypes, setCloneSelectedTypes] = useState<FileType[]>(["all"]);
  const [autoSyncEnabled, setAutoSyncEnabled] = useLocalStorageState<boolean>("filelist:autoSyncEnabled", false);
  const [autoUploadEnabled, setAutoUploadEnabled] = useLocalStorageState<boolean>("filelist:autoUploadEnabled", false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingFiles, setUpdatingFiles] = useState<Set<string>>(new Set());
  const [syncingFiles, setSyncingFiles] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>(propSearchQuery || "");
  const [openMode, setOpenMode] = useState<"edit" | "readonly">("edit");
  const [openingEditFiles, setOpeningEditFiles] = useState<Set<string>>(new Set());
  const [openingReadOnlyFiles, setOpeningReadOnlyFiles] = useState<Set<string>>(new Set());
  const [syncReasonModal, setSyncReasonModal] = useState<{
    isOpen: boolean;
    fileName: string;
    operation: "syncToSource" | "updateFromSource";
  }>({ isOpen: false, fileName: "", operation: "syncToSource" });

  // 同步 sourcePath 到父组件
  useEffect(() => {
    if (propSourcePath !== undefined && propSourcePath !== sourcePath) {
      setSourcePath(propSourcePath);
    }
  }, [propSourcePath]);

  // 保存路径到本地存储
  useEffect(() => {
    if (sourcePath) {
      localStorage.setItem("sourcePath", sourcePath);
      onSourcePathChange?.(sourcePath);
    }
    if (localPath) {
      localStorage.setItem("localPath", localPath);
    }
  }, [sourcePath, localPath, onSourcePathChange]);

  const loadDirectory = useCallback(async (path: string, isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const result = await getElectroView().rpc!.request.listDirectory({ path, sourcePath });
      if (result.success && result.files) {
        const sortedFiles = result.files.sort((a: FileInfo, b: FileInfo) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
        setFiles(sortedFiles);
      } else {
        showToast(result.error || "读取目录失败", "error");
      }
    } catch (err) {
      console.error("加载目录失败:", err);
      showToast("读取目录失败", "error");
    } finally {
      if (isRefresh) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [showToast, sourcePath]);

  // 加载本地目录
  useEffect(() => {
    if (localPath) {
      loadDirectory(localPath);
    }
  }, [localPath, loadDirectory]);

  // 文件变更回调
  const handleFileChange = (data: { fileName: string; isLocalChange?: boolean }) => {
    if (data.isLocalChange) {
      handleSyncFileWithReason(data.fileName);
    } else {
      handleUpdateFile(data.fileName);
    }
  }
  // 启动监听
  const startWatching = async () => {
    try {
      const result = await getElectroView().rpc!.request.startWatchingDirectory({
        sourcePath,
        localPath
      });
      eventBus.on('fileChanged', handleFileChange);
      if (result.success) {
        console.log(`成功启动对源目录 ${sourcePath} 的监听`);
        showToast("已启动自动监听，源目录文件变更将自动同步", "success");
      } else {
        showToast(result.error || "启动监听失败", "error");
      }
    } catch (err) {
      console.error("启动监听失败:", err);
      showToast("启动监听失败", "error");
    }
  };
  const stopWathing = () => {
    getElectroView().rpc!.request.stopWatchingDirectory({ sourcePath })
      .then(result => {
        if (result.success) {
          console.log(`已停止对源目录 ${sourcePath} 的监听`);
          showToast("已停止自动监听", "warning");
          eventBus.off('fileChanged', handleFileChange);
        }
      })
      .catch(err => {
        console.error("停止监听失败:", err);
      });
  }
  // 启动监听本地目录
  const startLocalWatching = async () => {
    try {
      const result = await getElectroView().rpc!.request.startWatchingLocalDirectory({
        sourcePath,
        localPath
      });
      eventBus.on('fileChanged', handleFileChange);
      if (result.success) {
        console.log(`成功启动对本地目录 ${localPath} 的监听`);
        showToast("已启动自动上传监听，本地文件变更将自动同步到共享盘", "success");
      } else {
        showToast(result.error || "启动监听失败", "error");
      }
    } catch (err) {
      console.error("启动监听失败:", err);
      showToast("启动监听失败", "error");
    }
  };
  const stopLocalWathing = () => {
    getElectroView().rpc!.request.stopWatchingLocalDirectory({ localPath })
      .then(result => {
        if (result.success) {
          console.log(`已停止对本地目录 ${localPath} 的监听`);
          showToast("已停止自动监听", "warning");
          eventBus.off('fileChanged', handleFileChange);
        }
      })
      .catch(err => {
        console.error("停止监听失败:", err);
      });
  }
  const watchingRef = useRef(false);
  // 首次开始进行监听
  useEffect(() => {
    if (!sourcePath || !localPath) {
      return;
    }
    if (autoSyncEnabled) {
      startWatching()
      watchingRef.current = true;
    }
    return () => {
      if (watchingRef.current) {
        stopWathing();
        watchingRef.current = false;
      }
    }
    // 清理
  }, [sourcePath, localPath]);

  // 监听本地目录文件变化（自动上传同步）
  useEffect(() => {
    if (!sourcePath || !localPath) {
      return;
    }
    if (autoUploadEnabled) {
      startLocalWatching();
      watchingRef.current = true;
    }
    return () => {
      if (watchingRef.current) {
        stopLocalWathing();
        watchingRef.current = false;
      }
    }
    // 清理
  }, [sourcePath, localPath]);


  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      // 过滤掉 dwl 临时文件（AutoCAD 打开时自动生成）
      if (file.extension.toLowerCase() === "dwl" || file.extension.toLowerCase() === "bak") return false;

      const matchesSearch = searchQuery
        ? fuzzyMatch(file.name, searchQuery)
        : true;

      const matchesType = selectedFileType === "all"
        ? true
        : FILE_TYPE_EXTENSIONS[selectedFileType].includes(file.extension.toLowerCase());

      return matchesSearch && matchesType;
    });
  }, [files, searchQuery, selectedFileType]);

  const syncStatusSummary = useMemo(() => {
    if (!sourcePath || files.length === 0) return null;
    const nonDirFiles = files.filter(f => !f.isDirectory && f.extension.toLowerCase() !== "dwl" && f.extension.toLowerCase() !== "bak");
    if (nonDirFiles.length === 0) return null;

    const synced = nonDirFiles.filter(f => f.syncStatus === "synced").length;
    const modified = nonDirFiles.filter(f => f.syncStatus === "modified").length;
    const newFiles = nonDirFiles.filter(f => f.syncStatus === "new").length;

    return { synced, modified, new: newFiles, total: nonDirFiles.length };
  }, [files, sourcePath]);

  // 选择源目录
  const handleSelectSource = async () => {
    try {
      const result = await getElectroView().rpc!.request.selectSourceDirectory({});
      if (result.success && result.path) {
        setSourcePath(result.path);
        showToast("源目录已设置", "success");
      }
    } catch (err) {
      console.error("选择源目录失败:", err);
      showToast("选择源目录失败", "error");
    }
  };

  // 选择本地目录
  const handleSelectLocal = async () => {
    try {
      const result = await getElectroView().rpc!.request.selectLocalDirectory({});
      if (result.success && result.path) {
        setLocalPath(result.path);
        showToast("本地目录已设置", "success");
      }
    } catch (err) {
      console.error("选择本地目录失败:", err);
      showToast("选择本地目录失败", "error");
    }
  };

  // 克隆源目录到本地（带过滤）
  const handleCloneWithFilter = async () => {
    if (!sourcePath || !localPath) {
      showToast("请先设置源目录和本地目录", "error");
      return;
    }

    // 收集所有允许的文件扩展名
    let allowedExtensions: string[] = [];
    if (!cloneSelectedTypes.includes("all")) {
      cloneSelectedTypes.forEach((type) => {
        allowedExtensions = [...allowedExtensions, ...FILE_TYPE_EXTENSIONS[type]];
      });
      allowedExtensions = [...new Set(allowedExtensions)]; // 去重
    }

    setLoading(true);
    try {
      const result = await getElectroView().rpc!.request.cloneDirectory({
        sourcePath,
        localPath,
        allowedExtensions: allowedExtensions.length > 0 ? allowedExtensions : undefined
      });
      if (result.success) {
        showToast(allowedExtensions.length > 0 ? "过滤后的目录克隆成功" : "目录克隆成功", "success");
        setIsCloneModalOpen(false);
        loadDirectory(localPath);
      } else {
        showToast(result.error || "克隆失败", "error");
      }
    } catch (err) {
      console.error("克隆失败:", err);
      showToast("克隆失败", "error");
    } finally {
      setLoading(false);
    }
  };


  // 执行同步文件操作
  const executeSyncFile = async (fileName: string, reasonType: SyncReasonType, reason: string) => {
    setSyncingFiles(prev => new Set(prev).add(fileName));
    showToast(`正在同步 ${fileName}...`, "info");

    try {
      const cadConfig = readCadConfig();
      const brandKey = cadConfig?.brandKey;
      const result = await getElectroView().rpc!.request.syncToSource({
        sourcePath,
        localPath,
        fileName,
        brandKey,
        logData: {
          fileName,
          reasonType,
          reason,
          sourcePath,
          localPath,
          operation: "syncToSource"
        }
      });
      if (result.success) {
        showToast(`${fileName} 同步成功`, "success");
        loadDirectory(localPath);
      } else {
        showToast(result.error || "同步失败", "error");
      }
    } catch (err) {
      console.error("同步失败:", err);
      showToast("同步失败", "error");
    } finally {
      setSyncingFiles(prev => {
        const next = new Set(prev);
        next.delete(fileName);
        return next;
      });
    }
  };

  // 更新单个文件（从源到本地）
  const handleUpdateFile = async (fileName: string) => {
    if (!sourcePath || !localPath) {
      showToast("请先设置源目录和本地目录", "error");
      return;
    }

    if (updatingFiles.has(fileName)) {
      showToast("正在更新中，请稍候...", "info");
      return;
    }

    setUpdatingFiles((prev) => new Set(prev).add(fileName));
    showToast(`正在更新 ${fileName}...`, "info");

    try {
      const cadConfig = readCadConfig();
      const brandKey = cadConfig?.brandKey;

      const result = await getElectroView().rpc!.request.updateFromSource({
        sourcePath,
        localPath,
        fileName,
        brandKey,
      });
      if (result.success) {
        showToast(`${fileName} 更新成功`, "success",);
        loadDirectory(localPath);
      } else {
        showToast(result.error || "更新失败", "error");
      }
    } catch (err) {
      console.error("更新失败:", err);
      showToast("更新失败", "error");
    } finally {
      setUpdatingFiles((prev) => {
        const next = new Set(prev);
        next.delete(fileName);
        return next;
      });
    }
  };

  // 同步单个文件（从本地到源）
  const handleSyncFile = (fileName: string) => {
    if (!sourcePath || !localPath) {
      showToast("请先设置源目录和本地目录", "error");
      return;
    }

    if (syncingFiles.has(fileName)) {
      showToast("正在同步中，请稍候...", "info");
      return;
    }

    setSyncReasonModal({
      isOpen: true,
      fileName,
      operation: "syncToSource"
    });
  };

  // 自动同步文件（用于监听本地目录变化，无需弹窗）
  const handleSyncFileWithReason = (fileName: string) => {
    if (!sourcePath || !localPath) {
      return;
    }

    if (syncingFiles.has(fileName)) {
      return;
    }

    const reasonType: SyncReasonType = "modify";
    const reason = "图纸修改";
    executeSyncFile(fileName, reasonType, reason);
  };

  // 确认同步原因后的处理
  const handleConfirmSyncReason = (reasonType: SyncReasonType, reason: string) => {
    const { fileName, operation } = syncReasonModal;
    setSyncReasonModal(prev => ({ ...prev, isOpen: false }));

    if (operation === "syncToSource") {
      executeSyncFile(fileName, reasonType, reason);
    }
  };

  const handleOpenDwg = async (file: FileInfo, isReadOnly: boolean) => {
    const setOpening = isReadOnly ? setOpeningReadOnlyFiles : setOpeningEditFiles;
    const openingSet = isReadOnly ? openingReadOnlyFiles : openingEditFiles;
    
    if (openingSet.has(file.path)) {
      return;
    }
    
    setOpening(prev => new Set(prev).add(file.path));
    
    try {
      const isOpenResult = await getElectroView().rpc!.request.isFileOpen({ filePath: file.path });
      if (isOpenResult.isOpen) {
        showToast(`文件已在 ${isOpenResult.brandName} 中打开，正在激活窗口`, "warning");
        return;
      }
      const result = await getElectroView().rpc!.request.openDwg({ filePath: file.path, isReadOnly });
      if (result.success) {
        showToast(`文件打开成功 (${isReadOnly ? "只读" : "编辑"})`, "success");
      } else {
        showToast(result.error || "打开文件失败", "error");
      }
    } catch (err) {
      console.error("打开文件失败:", err);
      showToast("打开文件失败", "error");
    } finally {
      setOpening(prev => {
        const next = new Set(prev);
        next.delete(file.path);
        return next;
      });
    }
  };

  const handleRowDoubleClick = async (params: { row: FileInfo }) => {
    const file = params.row;
    if (file.isDirectory) {
      loadDirectory(file.path);
    } else {
      const ext = file.extension?.toLowerCase() || "";
      if (ext === "dwg" || ext === "dxf") {
        handleOpenDwg(file, openMode === "readonly");
      } else {
        try {
          const isOpenResult = await getElectroView().rpc!.request.isFileOpen({ filePath: file.path });
          if (isOpenResult.isOpen) {
            showToast(`文件已在 ${isOpenResult.brandName} 中打开，正在激活窗口`, "warning");
            return;
          }
          const result = await getElectroView().rpc!.request.openFile({ filePath: file.path });
          if (!result.success) {
            showToast(result.error || "打开文件失败", "error");
          }
        } catch (err) {
          console.error("打开文件失败:", err);
          showToast("打开文件失败", "error");
        }
      }
    }
  };

  const handleOpenInExplorer = async (file: FileInfo) => {
    try {
      const result = await getElectroView().rpc!.request.openInExplorer({ filePath: file.path });
      if (!result.success) {
        showToast(result.error || "在资源管理器中打开失败", "error");
      }
    } catch (err) {
      console.error("在资源管理器中打开失败:", err);
      showToast("在资源管理器中打开失败", "error");
    }
  };

  const toggleCloneType = (type: FileType) => {
    if (type === "all") {
      setCloneSelectedTypes(["all"]);
    } else {
      const newSelected = cloneSelectedTypes.filter(t => t !== "all");
      if (newSelected.includes(type)) {
        // 如果取消选中后没有任何类型被选中，回到"全部文件"
        const filtered = newSelected.filter(t => t !== type);
        if (filtered.length === 0) {
          setCloneSelectedTypes(["all"]);
        } else {
          setCloneSelectedTypes(filtered);
        }
      } else {
        setCloneSelectedTypes([...newSelected, type]);
      }
    }
  };

  const theme = useDataGridTheme(isDark);

  const columns: GridColDef[] = [
    {
      field: "icon",
      headerName: "",
      width: 50,
      sortable: false,
      renderCell: (p: GridRenderCellParams) => (
        p.row.isDirectory ? (
          <Folder className="h-5 w-5 text-yellow-500" />
        ) : (
          <FileText className="h-5 w-5 text-blue-400" />
        )
      ),
    },
    {
      field: "name",
      headerName: "文件名",
      flex: 1,
      minWidth: 150,
      maxWidth: 250,
      renderCell: (p: GridRenderCellParams) => (
        <div
          className="flex items-center gap-1 max-w-full cursor-pointer"
          title={`${p.row.path}\n双击打开${p.row.isDirectory ? "文件夹" : "文件"}`}
          onDoubleClick={() => {
            if (!p.row.isDirectory) {
              getElectroView().rpc!.request.openFile({ filePath: p.row.path });
            } else {
              loadDirectory(p.row.path);
            }
          }}
        >
          <span
            className={`font-medium truncate ${p.row.isDirectory
              ? isDark
                ? "text-yellow-400"
                : "text-yellow-600"
              : ""
              }`}
          >
            {p.value as string}
          </span>
        </div>
      ),
    },
    {
      field: "createdAt",
      headerName: "修改日期",
      width: 160,
      renderCell: (p: GridRenderCellParams) => (
        <span className="text-sm text-slate-500">
          {formatDate(p.value)}
        </span>
      ),
    },
    {
      field: "extension",
      headerName: "文件类型",
      width: 120,
      renderCell: (p: GridRenderCellParams) => (
        <span
          className={`px-2 py-0.5 rounded text-xs ${p.row.isDirectory
            ? isDark
              ? "bg-yellow-500/10 text-yellow-400"
              : "bg-yellow-100 text-yellow-700"
            : isDark
              ? "bg-blue-500/10 text-blue-400"
              : "bg-blue-100 text-blue-700"
            }`}
        >
          {p.row.isDirectory ? "文件夹" : getFileType(p.value)}
        </span>
      ),
    },
    {
      field: "size",
      headerName: "大小",
      width: 100,
      renderCell: (p: GridRenderCellParams) => (
        <span className="text-sm text-slate-500">
          {p.row.isDirectory ? "-" : formatFileSize(p.value)}
        </span>
      ),
    },
    {
      field: "syncStatus",
      headerName: "状态",
      width: 90,
      sortable: false,
      renderCell: (p: GridRenderCellParams) => {
        if (p.row.isDirectory) return null;
        const status = p.row.syncStatus;
        if (!status || status === "unknown") return <span className="text-slate-400 text-sm" >-</span>;
        if (status === "synced") return <span className="text-emerald-500 flex items-center gap-1 text-sm"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>已同步</span>;
        if (status === "modified") return <span className="text-amber-500 flex items-center gap-1 text-sm"><span className="w-2 h-2 rounded-full bg-amber-500"></span>未同步</span>;
        if (status === "new") return <span className="text-blue-500 flex items-center gap-1 text-sm"><span className="w-2 h-2 rounded-full bg-blue-500"></span>新增</span>;
        return null;
      },
    },
    {
      field: "actions",
      headerName: "操作",
      width: 420,
      sortable: false,
      renderHeader: () => (
        <div className="flex items-center gap-2">
          <span>操作</span>
        </div>
      ),
      renderCell: (p: GridRenderCellParams) => {
        if (p.row.isDirectory) return null;
        const isUpdating = updatingFiles.has(p.row.name);
        const isSyncing = syncingFiles.has(p.row.name);
        const isOpeningEdit = openingEditFiles.has(p.row.path);
        const isOpeningReadOnly = openingReadOnlyFiles.has(p.row.path);
        const ext = p.row.extension?.toLowerCase() || "";
        const isDwgFile = ext === "dwg" || ext === "dxf";

        return (
          <div className="flex items-center gap-2 flex-wrap">
            {isDwgFile && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDwg(p.row, false);
                  }}
                  disabled={isOpeningEdit}
                  className={`inline-flex h-8 items-center justify-center gap-1 px-2 rounded text-xs font-medium transition-colors cursor-pointer ${isOpeningEdit
                    ? "bg-blue-500/20 text-blue-400 cursor-not-allowed"
                    : "hover:bg-blue-500/20 text-blue-500"
                    }`}
                  title="编辑模式打开"
                >
                  {isOpeningEdit ? (
                    <>
                      <div className="h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      打开中...
                    </>
                  ) : (
                    <>
                      <Edit className="h-3 w-3" />
                      编辑
                    </>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDwg(p.row, true);
                  }}
                  disabled={isOpeningReadOnly}
                  className={`inline-flex h-8 items-center justify-center gap-1 px-2 rounded text-xs font-medium transition-colors cursor-pointer ${isOpeningReadOnly
                    ? "bg-amber-500/20 text-amber-400 cursor-not-allowed"
                    : "hover:bg-amber-500/20 text-amber-500"
                    }`}
                  title="只读模式打开"
                >
                  {isOpeningReadOnly ? (
                    <>
                      <div className="h-3 w-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      打开中...
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" />
                      只读
                    </>
                  )}
                </button>
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenInExplorer(p.row);
              }}
              className={`inline-flex h-8 items-center justify-center gap-1 px-2 rounded text-xs font-medium transition-colors cursor-pointer text-slate-400 hover:text-slate-600 hover:bg-slate-500/10`}
              title="在资源管理器中显示"
            >
              <FolderSearch className="h-3 w-3" />
              打开
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUpdateFile(p.row.name);
              }}
              disabled={isUpdating || isSyncing}
              className={`inline-flex h-8 items-center justify-center gap-1 px-2 rounded text-xs font-medium transition-colors cursor-pointer ${isUpdating
                ? "bg-blue-100 text-blue-400 cursor-not-allowed"
                : "hover:bg-blue-500/20 text-blue-500"
                }`}
              title="更新（从源目录获取）"
            >
              {isUpdating ? (
                <>
                  <div className="h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  更新中...
                </>
              ) : (
                <>
                  <Download className="h-3 w-3" />
                  更新
                </>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSyncFile(p.row.name);
              }}
              disabled={isUpdating || isSyncing}
              className={`inline-flex h-8 items-center justify-center gap-1 px-2 rounded text-xs font-medium transition-colors cursor-pointer ${isSyncing
                ? "bg-green-100 text-green-400 cursor-not-allowed"
                : "hover:bg-green-500/20 text-green-500"
                }`}
              title="同步（上传到源目录）"
            >
              {isSyncing ? (
                <>
                  <div className="h-3 w-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="h-3 w-3" />
                  同步
                </>
              )}
            </button>
          </div>
        );
      },
    },
  ];

  const rows = useMemo(() => {
    return filteredFiles.map((file, index) => ({
      id: file.path + index,
      ...file,
    }));
  }, [filteredFiles]);

  if (!localPath) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-2xl py-20 border-2 border-dashed ${isDark
          ? "bg-slate-800/30 border-slate-700"
          : "bg-slate-50 border-slate-200"
          }`}
      >
        <Folder className="h-12 w-12 text-slate-600 mb-4 opacity-20" />
        <p className="text-sm text-slate-500 mb-4">请先设置本地目录和源目录</p>
        <div className="flex gap-2">
          <button
            onClick={handleSelectSource}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            选择源目录
          </button>
          <button
            onClick={handleSelectLocal}
            className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
          >
            选择本地目录
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={` rounded-2xl border overflow-hidden ${isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200"
          }`}
      >
        <div
          className={`px-4 py-3 border-b ${isDark ? "border-slate-800 bg-slate-800/30" : "border-slate-200 bg-slate-50"
            }`}
        >
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="flex items-center gap-2 flex-1">
              <FolderOpen className="h-4 w-4 text-yellow-500 flex-shrink-0" />
              <span className="text-xs text-slate-500">源目录:</span>
              <span
                className={`text-sm font-medium truncate flex-1 ${isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                title={sourcePath}
              >
                {sourcePath || "未设置"}
                <button
                  onClick={handleSelectSource}
                  className={`px-2  ml-4 py-1 rounded text-xs font-medium transition-colors ${isDark
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    }`}
                >
                  选择
                </button>
              </span>
              <div className="relative flex-shrink-0">
                <div className="flex gap-2">
                  <IOSInput
                    value={searchQuery}
                    onChange={(value) => setSearchQuery(value)}
                    placeholder="搜索文件名..."
                    className="w-48"
                  />
                  <SelectDropdown
                    value={selectedFileType}
                    onChange={(value) => setSelectedFileType(value as any)}
                    options={[
                      { value: "all", label: "全部类型" },
                      { value: "dwg", label: "DWG (.dwg, .dxf)" },
                      { value: "excel", label: "Excel (.xls, .xlsx)" },
                      { value: "word", label: "Word (.doc, .docx)" },
                      { value: "ppt", label: "PowerPoint (.ppt, .pptx)" },
                      { value: "pdf", label: "PDF (.pdf)" },
                      { value: "image", label: "图片 (.jpg, .png, 等)" },
                    ]}
                  />
                  <SelectDropdown
                    value={openMode}
                    onChange={(value) => setOpenMode(value as any)}
                    options={[
                      { value: "edit", label: "编辑模式" },
                      { value: "readonly", label: "只读模式" },
                    ]}
                  />
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-500" : "text-slate-400"
                      }`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <FolderOpen className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span className="text-xs text-slate-500">本地目录:</span>
              <span
                className={`text-sm font-medium truncate flex-1 ${isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                title={localPath}
              >
                {localPath}
                <button
                  onClick={handleSelectLocal}
                  className={`px-2 py-1 ml-4 rounded text-xs font-medium transition-colors ${isDark
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    }`}
                >
                  选择
                </button>
              </span>

              <button
                onClick={() => setIsCloneModalOpen(true)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${isDark
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : "bg-purple-600 text-white hover:bg-purple-700"
                  }`}
                disabled={!sourcePath}
              >
                克隆源目录
              </button>
              <label
                className={`flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${autoSyncEnabled
                  ? isDark
                    ? "bg-green-500/20 text-green-400"
                    : "bg-green-50 text-green-600"
                  : isDark
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                title="自动更新（监听源目录文件变更并自动同步更新）"
              >
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => {
                    setAutoSyncEnabled(e.target.checked)
                    if (e.target.checked) {
                      startWatching()
                      watchingRef.current = true;
                    } else {
                      stopWathing();
                      watchingRef.current = false;
                    }
                  }}
                  disabled={!sourcePath || !localPath || autoUploadEnabled}
                  className="h-3 w-3 rounded border-current/30 text-green-600 focus:ring-green-500/50"
                />
                <span>{autoSyncEnabled ? "监听中(更新)" : "自动同步更新"}</span>
              </label>
              <label
                className={`flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${autoUploadEnabled
                  ? isDark
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-blue-50 text-blue-600"
                  : isDark
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                title="自动上传（监听本地目录文件变更并自动同步到共享盘）"
              >
                <input
                  type="checkbox"
                  checked={autoUploadEnabled}
                  onChange={(e) => {
                    setAutoUploadEnabled(e.target.checked)
                    if (e.target.checked) {
                      startLocalWatching();
                      watchingRef.current = true;
                    } else {
                      stopLocalWathing();
                      watchingRef.current = false;
                    }
                  }}
                  disabled={!sourcePath || !localPath || autoSyncEnabled}
                  className="h-3 w-3 rounded border-current/30 text-blue-600 focus:ring-blue-500/50"
                />
                <span>{autoUploadEnabled ? "监听中(上传)" : "自动上传同步"}</span>
              </label>
              {syncStatusSummary && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${syncStatusSummary.modified > 0
                  ? "bg-amber-500/20 text-amber-600"
                  : "bg-emerald-500/20 text-emerald-600"
                  }`}>
                  <span>{syncStatusSummary.modified > 0 ? "未同步" : "已同步"}</span>
                  <span className="opacity-60">({syncStatusSummary.synced}/{syncStatusSummary.total})</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadDirectory(localPath, true)}
                disabled={isRefreshing}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isDark
                  ? "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                  : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                  }`}
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Search className="h-12 w-12 text-slate-600 mb-4 opacity-20" />
            <p className="text-sm text-slate-500">
              {searchQuery ? "未找到匹配的文件" : "目录为空"}
            </p>
          </div>
        ) : (
          <ThemeProvider theme={theme}>
            <Box
              sx={{
                height: "calc(100vh - 320px)",
                width: "100%",
                bgcolor: "background.paper",
                borderRadius: "16px",
                overflow: "hidden",
                marginTop: "8px",
              }}
            >
              <DataGrid
                rows={rows}
                columns={columns}
                getRowId={(row) => row.id}
                initialState={{
                  pagination: { paginationModel: { pageSize: 100 } },
                }}
                localeText={zhCN}
                pageSizeOptions={[50, 100, 200]}
                disableRowSelectionOnClick
                rowHeight={48}
                columnHeaderHeight={44}
                onRowDoubleClick={handleRowDoubleClick}
                sx={{
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
                }}
              />
            </Box>
          </ThemeProvider>
        )}

      </div>
      <Modal
        open={isCloneModalOpen}
        onClose={() => setIsCloneModalOpen(false)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Fade timeout={250} in={isCloneModalOpen}>
          <Box sx={{
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: 440,
            outline: 'none',
            p: 0,
          }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            }}>
              <Typography variant="h6" component="h3" sx={{ fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                克隆源目录到本地
              </Typography>
              <Button
                onClick={() => setIsCloneModalOpen(false)}
                sx={{ minWidth: 'auto', p: 0.5, borderRadius: 1, color: isDark ? '#94a3b8' : '#64748b' }}
              >
                <X className="h-5 w-5" />
              </Button>
            </Box>

            <Box sx={{ p: 2 }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                  选择要克隆的文件类型：
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {CLONE_TYPE_OPTIONS.map((option) => {
                    const isSelected = cloneSelectedTypes.includes(option.id);
                    const isAllSelected = cloneSelectedTypes.includes("all");

                    return (
                      <Box
                        key={option.id}
                        onClick={() => toggleCloneType(option.id)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          p: 1.5,
                          borderRadius: 1,
                          border: 1,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          opacity: option.id !== "all" && isAllSelected ? 0.5 : 1,
                          borderColor: isSelected ? '#3b82f6' : isDark ? '#334155' : '#e2e8f0',
                          bgcolor: isSelected ? '#3b82f6' : 'transparent',
                          color: isSelected ? 'white' : isDark ? '#e2e8f0' : '#1e293b',
                          '&:hover': {
                            bgcolor: isSelected ? '#2563eb' : isDark ? '#334155' : '#f1f5f9',
                          },
                        }}
                      >
                        <Box
                          component="input"
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCloneType(option.id)}
                          sx={{
                            width: 16,
                            height: 16,
                            accentColor: '#3b82f6',
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {option.label}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>

            <Box sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1,
              p: 2,
              borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            }}>
              <Button
                variant="outlined"
                onClick={() => setIsCloneModalOpen(false)}
                sx={{
                  color: isDark ? '#e2e8f0' : '#1e293b',
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                  '&:hover': {
                    bgcolor: isDark ? '#334155' : '#f1f5f9',
                    borderColor: isDark ? '#475569' : '#cbd5e1',
                  },
                }}
              >
                取消
              </Button>
              <Button
                variant="contained"
                onClick={handleCloneWithFilter}
                disabled={loading || cloneSelectedTypes.length === 0}
                sx={{
                  bgcolor: '#9333ea',
                  '&:hover': { bgcolor: '#7c3aed' },
                  '&:disabled': { bgcolor: '#64748b', cursor: 'not-allowed' },
                }}
              >
                {loading ? "克隆中..." : "开始克隆"}
              </Button>
            </Box>
          </Box>
        </Fade>
      </Modal>

      <SyncReasonModal
        isOpen={syncReasonModal.isOpen}
        fileName={syncReasonModal.fileName}
        onClose={() => setSyncReasonModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmSyncReason}
      />
    </>
  );
}
