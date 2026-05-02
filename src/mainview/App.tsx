import { useState, useMemo, useEffect } from "react";
import { FolderOpen, Database, X, History } from "lucide-react";
import { Header } from "@/components/drawing-manager/header";
import { DrawingTable } from "@/components/drawing-manager/drawing-table";
import { DrawingForm } from "@/components/drawing-manager/drawing-form";
import { SettingsModal } from "@/components/drawing-manager/settings-modal";
import { FileList } from "@/components/file-list/file-list";
import { LogList } from "@/components/log-list";
import { Drawing, DrawingFormData, CADConfig } from "@/lib/types";
import { getElectroView } from "@/lib/rpc";
import { useAppTheme } from "@/components/ThemeContext";

const DEFAULT_CAD_CONFIG: CADConfig = {
  type: "",
  path: "",
};

type ViewMode = "drawing" | "file" | "log";

export default function DrawingManagerPage() {
  const { isDark } = useAppTheme();
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDrawing, setEditingDrawing] = useState<Drawing | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [cadConfig, setCadConfig] = useState<CADConfig>(DEFAULT_CAD_CONFIG);
  const [viewMode, setViewMode] = useState<ViewMode>("drawing");
  const [fileSearchQuery, setFileSearchQuery] = useState("");
  const [sourcePath, setSourcePath] = useState<string>(localStorage.getItem("sourcePath") || "");

  const load = async () => {
    const electrobun = getElectroView();
    const list = await electrobun.rpc!.request.getAll({});

    // 处理 list，从 filePath 中提取 fileName 并存入新字段
    const processedList = list.map((drawing: any) => {
      // 兼容 Windows (\) 和 Unix (/) 的路径分隔符
      const fullFileName = drawing.filePath.split(/[/\\]/).pop() || "";
      const lastDotIndex = fullFileName.lastIndexOf(".");
      const fileName =
        lastDotIndex !== -1
          ? fullFileName.substring(0, lastDotIndex)
          : fullFileName;

      return {
        ...drawing,
        fileName: fileName, // 动态添加 fileName 字段
      };
    });
    setDrawings(processedList);
  };
  const loadDefaultCadConfig = async () => {
    const electrobun = getElectroView();
    const config = await electrobun.rpc!.request.getCadConfig({});
    setCadConfig(config);

  };
  const loadDbPath = async () => {
    const electrobun = getElectroView();
    const defaultDbPath = await electrobun.rpc!.request.getDbPath({});
    localStorage.setItem("dbPath", defaultDbPath);
  };
  // 初始化主题和CAD配置
  useEffect(() => {
    // 加载主题
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    getElectroView(); // 初始化ElectroView单例
    const shouldBeDark = savedTheme === "dark" || (!savedTheme && prefersDark);
    if (shouldBeDark) {
      document.documentElement.classList.add("dark");
    }
    // 加载CAD配置
    const savedCADConfig = localStorage.getItem("cadConfig");
    const savedDbPath = localStorage.getItem("dbPath");
    if (!savedCADConfig) {
      loadDefaultCadConfig();
    }
    if (savedDbPath) {
      getElectroView()
        .rpc!.request.selectDatabase({ path: savedDbPath })
        .then((res) => {
          if (res.success) {
            console.log("数据库路径已更新:", savedDbPath);
            load(); // 刷新数据以反映新的数据库内容
          } else {
            console.error("数据库路径更新失败:", res.error);
          }
        })
        .catch((err) => {
          console.error("调用 selectDatabase RPC 失败:", err);
        });

    } else {
      loadDbPath();
      load(); // 没有保存的数据库路径，直接加载默认数据
    }
    if (savedCADConfig) {
      try {
        const config = JSON.parse(savedCADConfig) as CADConfig;
        setCadConfig(config);
      } catch {
        console.error("加载CAD配置失败");
      }
    }
  }, []);

  // 保存CAD配置
  const handleSaveCADConfig = (config: CADConfig) => {
    setCadConfig(config);
    localStorage.setItem("cadConfig", JSON.stringify(config));
    console.log("CAD配置已保存:", config);
  };
  const handleSaveDbPath = (path: string) => {
    // 保存数据库路径到本地存储
    localStorage.setItem("dbPath", path);
    load(); // 刷新数据以反映新的数据库内容
  };


  // 添加图纸
  const handleAddDrawing = (data: DrawingFormData) => {
    const newDrawing: Drawing = {
      // id: Date.now().toString(),
      ...data,
      id: 0,
      materialCode: "",
      drawingNumber: "",
      filePath: "",
      fileName: "",
      created_at: "",
    };
    setDrawings([newDrawing, ...drawings]);
    setIsFormOpen(false);
  };

  // 编辑图纸
  const handleEditDrawing = (data: DrawingFormData) => {
    if (!editingDrawing) return;
    const updatedDrawings = drawings.map((d) =>
      d.id === editingDrawing.id ? { ...d, ...data, updatedAt: new Date() } : d,
    );
    setDrawings(updatedDrawings);
    setEditingDrawing(null);
    setIsFormOpen(false);
    getElectroView().rpc!.request.update({
      id: editingDrawing.id,
      ...data,
      fileName: "",
    });
    console.log(data, "111");
    load(); // 刷新列表以获取最新数据
  };

  // 打开编辑表单
  const handleOpenEdit = (drawing: Drawing) => {
    setEditingDrawing(drawing);
    setIsFormOpen(true);
  };


  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">


          {/* 视图切换和操作栏 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`inline-flex rounded-xl p-1 ${isDark ? "bg-slate-800" : "bg-slate-100"
                  }`}
              >
                <button
                  onClick={() => setViewMode("drawing")}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${viewMode === "drawing"
                      ? isDark
                        ? "bg-blue-500 text-white shadow"
                        : "bg-white text-blue-600 shadow"
                      : isDark
                        ? "text-slate-400 hover:text-slate-200"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                  <Database className="h-4 w-4" />
                  数据库视图
                </button>
                <button
                  onClick={() => setViewMode("file")}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${viewMode === "file"
                      ? isDark
                        ? "bg-blue-500 text-white shadow"
                        : "bg-white text-blue-600 shadow"
                      : isDark
                        ? "text-slate-400 hover:text-slate-200"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                  <FolderOpen className="h-4 w-4" />
                  文件列表
                </button>
                <button
                  onClick={() => setViewMode("log")}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${viewMode === "log"
                      ? isDark
                        ? "bg-blue-500 text-white shadow"
                        : "bg-white text-blue-600 shadow"
                      : isDark
                        ? "text-slate-400 hover:text-slate-200"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                  <History className="h-4 w-4" />
                  同步日志
                </button>
              </div>

              {/* 搜索筛选 - 根据视图显示不同的搜索框 */}
              {viewMode === "drawing" ? (
                null
              ) : viewMode === "file" ? (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="搜索文件名..."
                    value={fileSearchQuery}
                    onChange={(e) => setFileSearchQuery(e.target.value)}
                    className={`h-10 w-64 rounded-lg border px-4 pr-10 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isDark
                        ? "bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
                        : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"
                      }`}
                  />
                  {fileSearchQuery && (
                    <button
                      onClick={() => setFileSearchQuery("")}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-500" : "text-slate-400"
                        }`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* 内容区域 */}
          <div className="relative min-h-[400px]">
            <div
              className={`absolute inset-0 transition-all duration-300 ease-in-out ${viewMode === "drawing"
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 -translate-y-4 pointer-events-none"
                }`}
            >
              <DrawingTable
                drawings={drawings}
                onEdit={handleOpenEdit}
                cadConfig={cadConfig}
                onDelete={() => {
                  load();
                }}
              />
            </div>

            <div
              className={`absolute inset-0 transition-all duration-300 ease-in-out ${viewMode === "file"
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 -translate-y-4 pointer-events-none"
                }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    文件列表
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    管理本地和共享目录的文件
                  </p>
                </div>
              </div>
              <FileList
                searchQuery={fileSearchQuery}
                sourcePath={sourcePath}
                onSourcePathChange={setSourcePath}
              />
            </div>

            <div
              className={`absolute inset-0 transition-all duration-300 ease-in-out ${viewMode === "log"
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 -translate-y-4 pointer-events-none"
                }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    同步日志
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    查看文件同步的历史记录
                  </p>
                </div>
              </div>
              <LogList
                sourcePath={sourcePath}
              />
            </div>
          </div>
        </div>
      </main>

      {/* 添加/编辑表单弹窗 */}
      <DrawingForm
        isOpen={isFormOpen}
        drawing={editingDrawing}
        onClose={() => {
          setIsFormOpen(false);
          setEditingDrawing(null);
        }}
        onSubmit={editingDrawing ? handleEditDrawing : handleAddDrawing}
      />

      {/* 设置弹窗 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        cadConfig={cadConfig}
        onSaveCADConfig={handleSaveCADConfig}
        onSaveDBPath={handleSaveDbPath}
      />
    </div>
  );
}
