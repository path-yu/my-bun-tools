// src/components/ConfigContext.tsx
import React, { createContext, useContext, useState } from 'react';
import { getElectroView } from "@/lib/rpc";

interface ConfigContextType {
  dbPath: string;
  setDbPath: (path: string) => void;
  saveConfig: (newPath: string) => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider = ({ children }: { children: React.ReactNode }) => {
  const [dbPath, setDbPath] = useState(localStorage.getItem("dbPath") || "");

  // 保存并应用配置的统一入口
  const saveConfig = async (newPath: string) => {
    try {
      // 1. 持久化到本地
      localStorage.setItem("dbPath", newPath);
      setDbPath(newPath);

      // 2. 通知后端主进程切换数据库连接
      const res = await getElectroView().rpc?.request.selectDatabase({ path: newPath });
      if (res?.success) {
        console.log("[Context] 数据库连接已切换");
      }
    } catch (err) {
      console.error("[Context] 保存配置失败:", err);
    }
  };

  return (
    <ConfigContext.Provider value={{ dbPath, setDbPath, saveConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) throw new Error("useConfig must be used within ConfigProvider");
  return context;
};