import { BrowserView, type RPCSchema } from "electrobun/bun";
import { drawingSql, type Drawing } from "./db";
import { fixedCadLocate, professionalCadNavigate } from "./autoOpen";
import { CadBrand } from "@/lib/types";

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
        response: void;
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
        response: void;
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
      // drawingRPC.ts
      getAll: () => {
        const data = drawingSql.getAll.all();
        return data;
      },

      // 修改点：解构变量名必须与 Drawing 类型以及数据库字段名完全一致
      add: (data) => {
        try {
          return drawingSql.upsert.get(
            data.materialCode,
            data.drawingNumber,
            data.filePath,
            data.fileName,
            data.x ?? 0,
            data.y ?? 0,
            data.remarks ?? "",
          );
        } catch (err) {
          console.error("数据库操作失败:", err);
          throw err;
        }
      },
      update: ({
        id,
        materialCode,
        drawingNumber,
        filePath,
        fileName,
        x,
        y,
        remarks,
      }) => {
        try {
          console.log("正在更新 ID:", id);
          return drawingSql.update.get(
            materialCode,
            drawingNumber,
            filePath,
            fileName,
            x ?? 0,
            y ?? 0,
            remarks ?? "",
            id, // 对应 UPDATE ... WHERE id=?
          );
        } catch (err) {
          console.error("数据库操作失败:", err);
          throw err;
        }
      },

      delete: ({ id }) => {
        drawingSql.delete.run(id);
        return { success: true };
      },
      // 前端点击“定位”按钮调用的 RPC
      locateInCad: ({
        cadType,
        dwgPath,
        x,
        y,
        zoomHeight = 500,
      }: {
        cadType: CadBrand;
        dwgPath: string;
        x: number;
        y: number;
        zoomHeight?: number;
      }) => {
        return fixedCadLocate(cadType, dwgPath, x, y, zoomHeight);
      },
      professionalCadNavigate: ({
        brand,
        cadPath,
        materialCode,
        dwgPath,
        x,
        y,
        zoomHeight = 500,
      }) => {
        return professionalCadNavigate(
          brand,
          cadPath,
          materialCode,
          dwgPath,
          x,
          y,
          zoomHeight,
        );
      },
    },
  },
});
