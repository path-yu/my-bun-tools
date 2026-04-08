import { BrowserView, Utils, type RPCSchema } from "electrobun/bun";
import { drawingSql, initializeDb } from "./db";
import { fixedCadLocate, professionalCadNavigate } from "./autoOpen";
import { CadBrand, Drawing } from "@/lib/types";

export type DrawingRPC = {
  bun: RPCSchema<{
    requests: {
      getAll: {
        params: {};
        response: Drawing[];
      };
      add: {
        // 排除自动生成的字段，其余字段作为参数
        params: Omit<Drawing, "id" | "created_at">;
        response: Drawing;
      };
      update: {
        params: Drawing;
        response: Drawing;
      };
      delete: {
        params: { id: number };
        response: { success: boolean };
      };
      locateInCad: {
        params: {
          cadType: CadBrand;
          dwgPath: string;
          x: number;
          y: number;
          zoomHeight?: number;
        };
        response: any;
      };
      professionalCadNavigate: {
        params: {
          brand: CadBrand;
          cadPath: string;
          materialCode: string;
          dwgPath: string;
          x: number;
          y: number;
          zoomHeight?: number;
        };
        response: any;
      };
      selectDatabase: {
        params: {
          path: string;
        };
        response: { success: boolean; error?: string };
      };
      selectDatabaseFile: {
        params: {};
        response: {
          success: boolean;
          path?: string;
          error?: string;
          canceled?: boolean;
        };
      };
    };
    messages: {};
  }>;
  webview: RPCSchema<{ requests: {}; messages: {} }>;
};

export const drawingRPC = BrowserView.defineRPC<DrawingRPC>({
  maxRequestTime: 6000,
  handlers: {
    requests: {
      // 1. 获取所有数据：注意现在 getAll 是个函数
      getAll: () => {
        // 之前是 .all()，现在直接执行函数
        const data = drawingSql.getAll();
        return data;
      },

      // 2. 新增/更新：由于 upsert 内部已经封装了 SQL 逻辑，直接传对象即可
      add: (data) => {
        try {
          // 适配你最新的 getDrawingSql 结构，或者直接调用封装好的函数
          return drawingSql.upsert({
            materialCode: data.materialCode || "",
            drawingNumber: data.drawingNumber || "",
            filePath: data.filePath || "",
            fileName: data.fileName || "",
            x: data.x ?? 0,
            y: data.y ?? 0,
            remarks: data.remarks || "",
          });
        } catch (err) {
          console.error("数据库操作失败:", err);
          throw err;
        }
      },

      // 3. 修改
      update: (data) => {
        try {
          console.log("正在更新 ID:", data.id);
          // 确保 ID 传到了最后
          drawingSql.update({
            id: data.id!,
            materialCode: data.materialCode,
            drawingNumber: data.drawingNumber,
            filePath: data.filePath,
            fileName: data.fileName,
            x: data.x,
            y: data.y,
            remarks: data.remarks,
          });
          return data;
        } catch (err) {
          console.error("更新失败:", err);
          throw err;
        }
      },

      delete: ({ id }) => {
        drawingSql.delete(id);
        return { success: true };
      },

      selectDatabaseFile: async () => {
        try {
          const result = await Utils.openFileDialog({
            canChooseFiles: true,
            canChooseDirectory: false,
            allowsMultipleSelection: true,
          });
          console.log("文件选择结果:", result);
          // 用户取消
          if (!result || result.length === 0) {
            return { success: false, canceled: true };
          }

          return {
            success: true,
            path: result[0], // 单选
          };
        } catch (error) {
          return {
            success: false,
            error: "无法打开文件选择框",
          };
        }
      },

      // 5. 切换数据库并重新初始化
      selectDatabase: ({ path }) => {
        try {
          // 这里会执行 _db.close() 并重新 new Database(path)
          initializeDb(path);
          return { success: true };
        } catch (error) {
          console.error("数据库路径切换失败:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },

      // --- CAD 交互保持不变 ---
      locateInCad: ({ cadType, dwgPath, x, y, zoomHeight = 500 }) => {
        return fixedCadLocate(cadType, dwgPath, x, y, zoomHeight);
      },

      professionalCadNavigate: ({
        brand,
        cadPath,
        dwgPath,
        x,
        y,
        zoomHeight = 500,
      }) => {
        return professionalCadNavigate(
          brand,
          cadPath,
          dwgPath,
          x,
          y,
          zoomHeight,
        );
      },
    },
  },
});
