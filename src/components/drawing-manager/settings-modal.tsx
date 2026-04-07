import { X, FolderOpen, Check, Database, FileSearch, Info } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { CADConfig, CADType } from "@/lib/types";
import { useAppTheme } from "@/components/ThemeContext";
import { getElectroView } from "@/lib/rpc";
import { useConfig } from "../useConfig";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cadConfig: CADConfig;
  onSaveCADConfig: (config: CADConfig) => void;
  // 新增：数据库路径状态与保存回调
  dbPath?: string;
  onSaveDBPath?: (path: string) => void;
}

const CAD_TYPES: CADType[] = ["AutoCAD", "浩辰CAD", "中望CAD"];

const CAD_DEFAULT_PATHS: Record<CADType, string> = {
  AutoCAD: "C:\\Program Files\\Autodesk\\AutoCAD 2024\\acad.exe",
  浩辰CAD: "C:\\Program Files\\GstarCAD\\GstarCAD 2024\\gcad.exe",
  中望CAD: "C:\\Program Files\\ZWSOFT\\ZWCAD 2024\\ZWCAD.exe",
};

export function SettingsModal({
  isOpen,
  onClose,
  cadConfig,
  onSaveCADConfig,
  onSaveDBPath,
}: SettingsModalProps) {
  const { isDark } = useAppTheme();
  const [selectedType, setSelectedType] = useState<CADType>(
    cadConfig.type as unknown as CADType,
  );
  const [cadPath, setCadPath] = useState(cadConfig.path);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const { dbPath, saveConfig } = useConfig(); // 使用 Context
  const [currentDbPath, setCurrentDbPath] = useState(dbPath);


  useEffect(() => {
    setSelectedType(cadConfig.type as any);
    setCadPath(cadConfig.path);
    setCurrentDbPath(dbPath);
  }, [cadConfig, dbPath, isOpen]);

  useEffect(() => {
    const dbPath = localStorage.getItem("dbPath");
    if (dbPath) {
      setCurrentDbPath(dbPath);
    }
  }, []);

  // 修复：点击 Modal 外部关闭逻辑
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // 处理 CAD 类型下拉菜单的关闭
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsTypeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTypeChange = (type: CADType) => {
    setSelectedType(type);
    setCadPath(CAD_DEFAULT_PATHS[type]);
    setIsTypeDropdownOpen(false);
  };

  const handleSelectDbFile = () => {
    getElectroView()
      .rpc!.request.selectDatabaseFile({})
      .then((res) => {
        if (res.success && res.path) {
          setCurrentDbPath(res.path);
          console.log(res);
        } else if (res.canceled) {
          console.log("用户取消了文件选择");
        }
      })
      .catch((err) => {
        console.error("调用 selectDatabase RPC 失败:", err);
      });
  };

  // settings-modal.tsx

  const handleSave = async () => {
    // 1. 保存 CAD 配置 (原有逻辑)
    onSaveCADConfig({ type: selectedType as any, path: cadPath });
    // 2. 调用 Context 的统一保存逻辑
    await saveConfig(currentDbPath);
    // 3. (可选) 通知后端主进程切换数据库连接
    getElectroView()
      .rpc?.request.selectDatabase({ path: currentDbPath })
      .then((res) => {
        if (!res.success) {
          console.error("后端数据库切换失败:", res.error);
        }
      });

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose} // 点击遮罩层关闭
    >
      <div
        ref={modalRef}
        className={`w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl transition-all border animate-in zoom-in-95 duration-200 ${
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        }`}
        onClick={(e) => e.stopPropagation()} // 阻止冒泡，防止点击内容区关闭
      >
        {/* 标题栏 */}
        <div
          className={`flex items-center justify-between border-b px-6 py-4 ${
            isDark
              ? "border-slate-800 bg-slate-900/50"
              : "border-slate-100 bg-slate-50/50"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <h2
              className={`text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-800"}`}
            >
              系统偏好设置
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              isDark
                ? "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* 1. CAD 软件配置部分 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  isDark ? "bg-blue-500/10" : "bg-blue-50"
                }`}
              >
                <FolderOpen className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3
                  className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}
                >
                  CAD 软件交互
                </h3>
                <p className="text-xs text-slate-500">
                  指定用于解析和定位图纸的可执行文件
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 ml-2 pl-11 border-l-2 border-slate-100 dark:border-slate-800">
              {/* CAD 类型 */}
              <div className="space-y-2">
                <label
                  className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  软件品牌
                </label>
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                    className={`flex h-10 w-full items-center justify-between rounded-xl border px-4 text-sm transition-all ${
                      isDark
                        ? "bg-slate-800/50 border-slate-700 text-slate-200"
                        : "bg-slate-50/50 border-slate-200 text-slate-800"
                    }`}
                  >
                    <span>{selectedType}</span>
                    <Info className="h-3.5 w-3.5 opacity-40" />
                  </button>

                  {isTypeDropdownOpen && (
                    <div
                      className={`absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl shadow-xl border animate-in fade-in zoom-in-95 duration-200 ${
                        isDark
                          ? "bg-slate-800 border-slate-700"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      {CAD_TYPES.map((type) => (
                        <button
                          key={type}
                          onClick={() => handleTypeChange(type)}
                          className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                            selectedType === type
                              ? isDark
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-blue-50 text-blue-600"
                              : isDark
                                ? "text-slate-300 hover:bg-slate-700"
                                : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{type}</span>
                          {selectedType === type && (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* CAD 路径 */}
              <div className="space-y-2">
                <label
                  className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  程序安装路径
                </label>
                <input
                  type="text"
                  value={cadPath}
                  onChange={(e) => setCadPath(e.target.value)}
                  className={`h-10 w-full rounded-xl border px-4 text-sm transition-all focus:ring-2 focus:ring-blue-500/20 ${
                    isDark
                      ? "bg-slate-800/50 border-slate-700 text-slate-200 placeholder:text-slate-600"
                      : "bg-slate-50/50 border-slate-200 text-slate-800 placeholder:text-slate-400"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* 2. 数据库配置部分 (新增) */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  isDark ? "bg-emerald-500/10" : "bg-emerald-50"
                }`}
              >
                <Database className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <h3
                  className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}
                >
                  数据存储配置
                </h3>
                <p className="text-xs text-slate-500">
                  选择本地 SQLite 数据库文件以同步图纸元数据
                </p>
              </div>
            </div>

            <div className="ml-2 pl-11 border-l-2 border-slate-100 dark:border-slate-800 space-y-3">
              <div className="space-y-2">
                <label
                  className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  当前数据库路径 (.db)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentDbPath}
                    readOnly
                    placeholder="尚未选择数据库文件..."
                    className={`h-10 flex-1 rounded-xl border px-4 text-sm transition-all ${
                      isDark
                        ? "bg-slate-800/50 border-slate-700 text-slate-300"
                        : "bg-slate-50/50 border-slate-200 text-slate-600"
                    }`}
                  />
                  <button
                    onClick={handleSelectDbFile}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all active:scale-95 ${
                      isDark
                        ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                    title="选择文件"
                  >
                    <FileSearch className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div
          className={`flex justify-end gap-3 px-6 py-4 border-t ${isDark ? "border-slate-800 bg-slate-900/30" : "border-slate-100 bg-slate-50/30"}`}
        >
          <button
            onClick={onClose}
            className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${
              isDark
                ? "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saved}
            className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${
              saved
                ? "bg-emerald-500 text-white"
                : "bg-blue-600 text-white hover:bg-blue-500 hover:shadow-blue-500/20"
            }`}
          >
            {saved ? (
              <>
                <Check className="h-4 w-4" />
                保存成功
              </>
            ) : (
              "保存并应用"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
