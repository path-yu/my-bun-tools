import { FolderOpen, Database, History } from "lucide-react";

type TabKey = "drawing" | "file" | "log";

interface TabItem {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

interface IOSTabBarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

const tabs: TabItem[] = [
  { key: "drawing", label: "数据库", icon: <Database className="h-5 w-5" /> },
  { key: "file", label: "文件", icon: <FolderOpen className="h-5 w-5" /> },
  { key: "log", label: "日志", icon: <History className="h-5 w-5" /> },
];

export function IOSTabBar({ activeTab, onTabChange }: IOSTabBarProps) {
  return (
    <div className="relative w-full flex items-center rounded-2xl overflow-hidden bg-black/10 dark:bg-white/10 border border-black/5 dark:border-white/10">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className="relative flex-1 flex flex-row items-center justify-center gap-2 px-4 py-3 transition-colors duration-200"
        >
          {activeTab === tab.key && (
            <div className="absolute inset-1 bg-white dark:bg-slate-700 rounded-xl shadow-sm" />
          )}
          <span className={`relative z-10 text-sm font-medium transition-colors ${
            activeTab === tab.key 
              ? "text-blue-500" 
              : "text-slate-500 dark:text-slate-400"
          }`}>
            {tab.icon}
          </span>
          <span className={`relative z-10 text-xs font-medium transition-colors ${
            activeTab === tab.key 
              ? "text-blue-500" 
              : "text-slate-500 dark:text-slate-400"
          }`}>
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  );
}

interface IOSSlideViewProps {
  activeTab: TabKey;
  children: React.ReactNode[];
}

export function IOSSlideView({ activeTab, children }: IOSSlideViewProps) {
  const activeIndex = tabs.findIndex((t) => t.key === activeTab);

  return (
    <div className="relative min-h-[calc(100vh-200px)] overflow-hidden rounded-2xl">
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {children}
      </div>
    </div>
  );
}

export { tabs };
export type { TabKey };
