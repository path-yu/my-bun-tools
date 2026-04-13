import { useState, useMemo, useEffect } from "react";
import { Plus } from "lucide-react";
import { Header } from "@/components/drawing-manager/header";
import { SearchFilters } from "@/components/drawing-manager/search-filters";
import { DrawingTable } from "@/components/drawing-manager/drawing-table";
import { DrawingForm } from "@/components/drawing-manager/drawing-form";
import { StatsCards } from "@/components/drawing-manager/stats-cards";
import { SettingsModal } from "@/components/drawing-manager/settings-modal";
import {
  Drawing,
  DrawingCategory,
  DrawingFormData,
  CADConfig,
} from "@/lib/types";
import { getElectroView } from "@/lib/rpc";

const DEFAULT_CAD_CONFIG: CADConfig = {
  type: "",
  path: "",
};

export default function DrawingManagerPage() {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [drawingNumber, setDrawingNumber] = useState("");
  const [materialCode, setMaterialCode] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    DrawingCategory | ""
  >("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDrawing, setEditingDrawing] = useState<Drawing | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [cadConfig, setCadConfig] = useState<CADConfig>(DEFAULT_CAD_CONFIG);

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
    console.log(processedList,3);

    setDrawings(processedList);
  };
  // 初始化主题和CAD配置
  useEffect(() => {
    console.log("render");

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
  // 筛选图纸
  const filteredDrawings = useMemo(() => {
    return drawings.filter((drawing) => {
      const matchesDrawingNumber = drawingNumber
        ? drawing.drawingNumber
            .toLowerCase()
            .includes(drawingNumber.toLowerCase())
        : true;
      const matchesMaterialCode = materialCode
        ? drawing.materialCode
            .toLowerCase()
            .includes(materialCode.toLowerCase())
        : true;
      const matchesCategory = selectedCategory
        ? drawing.fileName.includes(selectedCategory)
        : true;
      return matchesDrawingNumber && matchesMaterialCode && matchesCategory;
    });
  }, [drawings, drawingNumber, materialCode, selectedCategory]);

  // 统计数据
  const stats = useMemo(() => {
    return {
      total: drawings.length,
      stainless: drawings.filter((d) => d.fileName === "不锈钢").length,
      carbon: drawings.filter((d) => d.fileName === "碳钢").length,
      vacuum: drawings.filter((d) => d.fileName === "真空罐").length,
      // 卧式储气罐新标准
      horizontalVacuum: drawings.filter((d) =>
        d.fileName?.includes("卧式储气罐新标准"),
      ).length,
    };
  }, [drawings]);

  // 搜索处理
  const handleSearch = () => {
    // 当前已通过 useMemo 实时筛选，此处可添加额外逻辑如日志记录
    load();
  };

  // 重置筛选
  const handleReset = () => {
    setDrawingNumber("");
    setMaterialCode("");
    setSelectedCategory("");
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

  // 打开添加表单
  const handleOpenAdd = () => {
    setEditingDrawing(null);
    setIsFormOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* 统计卡片 */}
          <StatsCards
            totalDrawings={stats.total}
            stainlessCount={stats.stainless}
            carbonCount={stats.carbon}
            vacuumCount={stats.vacuum}
          />

          {/* 搜索筛选 */}
          <SearchFilters
            drawingNumber={drawingNumber}
            materialCode={materialCode}
            selectedCategory={selectedCategory}
            onDrawingNumberChange={setDrawingNumber}
            onMaterialCodeChange={setMaterialCode}
            onCategoryChange={setSelectedCategory}
            onSearch={handleSearch}
            onReset={handleReset}
          />

          {/* 表格标题和添加按钮 */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                图纸列表
              </h2>
              <p className="text-sm text-muted-foreground">
                共 {filteredDrawings.length} 条记录
              </p>
            </div>
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              添加图纸
            </button>
          </div>

          {/* 图纸表格 */}
          <DrawingTable
            drawings={filteredDrawings}
            onEdit={handleOpenEdit}
            cadConfig={cadConfig}
            onDelete={() => {
              load();
            }}
          />
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
