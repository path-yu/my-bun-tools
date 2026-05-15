import { useState,  useEffect } from "react";
import { Header } from "@/components/drawing-manager/header";
import { DrawingTable } from "@/components/drawing-manager/drawing-table";
import { DrawingForm } from "@/components/drawing-manager/drawing-form";
import { SettingsModal } from "@/components/drawing-manager/settings-modal";
import { FileList } from "@/components/file-list/file-list";
import { LogList } from "@/components/log-list";
import { ProductList } from "@/components/product-list/product-list";
import { Drawing, DrawingFormData, CADConfig } from "@/lib/types";
import { getElectroView } from "@/lib/rpc";
import { IOSTabBar, IOSSlideView, TabKey } from "@/components/IOSTabBar";

const DEFAULT_CAD_CONFIG: CADConfig = {
  type: "",
  path: "",
};

type ViewMode = TabKey;

export default function DrawingManagerPage() {
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
     localStorage.setItem("cadConfig", JSON.stringify(config));
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
    loadDefaultCadConfig();
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


          {/* iOS 风格标签栏 */}
          <IOSTabBar activeTab={viewMode} onTabChange={(tab) => setViewMode(tab)} />

          {/* 内容区域 - iOS 滑动视图 */}
          <IOSSlideView activeTab={viewMode}>
            <div className="w-full flex-shrink-0">
              <DrawingTable
                drawings={drawings}
                onEdit={handleOpenEdit}
                cadConfig={cadConfig}
                onDelete={() => {
                  load();
                }}
              />
            </div>
            <div className="w-full flex-shrink-0">
              <FileList
                searchQuery={fileSearchQuery}
                sourcePath={sourcePath}
                onSourcePathChange={setSourcePath}
              />
            </div>
            <div className="w-full flex-shrink-0">
              <LogList sourcePath={sourcePath} />
            </div>
            <div className="w-full flex-shrink-0">
              <ProductList />
            </div>
          </IOSSlideView>
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
