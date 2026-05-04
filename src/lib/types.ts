import { RPCSchema } from "electrobun/bun";

export type DrawingCategory = "不锈钢" | "碳钢" | "真空罐"|'卧式储气罐';

export interface Drawing {
  id?: any; // 数据库是 INTEGER PRIMARY KEY，前端对应 number
  materialCode: string; // 数据库是 INTEGER PRIMARY KEY，前端对应 number
  drawingNumber: string; // 对应数据库 materialCode (物料编码/产品编号)
  filePath: string; // 对应数据库 filePath
  fileName: string; // 对应数据库 fileName
  // category: string;  // 对应数据库 category
  x?: number; // 坐标 X
  y?: number; // 坐标 Y
  // category: DrawingCategory; // 如果数据库里有这个字段就保留
  created_at?: string; // 数据库默认返回的是 ISO 字符串
  // 备注
  remarks?: string;
}
export interface DrawingFormData {
  materialCode: string;
  drawingNumber: string;
  filePath: string;
  //备注
  remarks?: string;
  // category: DrawingCategory
}
export interface Product {
  id?: number;
  unit: string;
  productName: string;
  processRoute: string;
  productCode: string;
  productSpec: string;
  productAttribute: string;
  created_at?: string;
}
export type CADType = "AutoCAD" | "浩辰CAD" | "中望CAD";

export interface CADConfig {
  type: CADType |"";
  path: string;
}
export type DrawingRPC = {
  bun: RPCSchema<{
    requests: {
      // getDbPath 获取当前数据库路径
      getDbPath: {
        params: {};
        response: string;
      };
      // 获取当前用户的cad配置
      getCadConfig: {
        params: {};
        response: {path:string,type:CADType};
      };
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
          isReadOnly?: boolean;
        };
        response: any;
      };
      professionalCadNavigate: {
        params: {
          brand: CadBrand;
          cadPath: string;
          dwgPath: string;
          x: number;
          y: number;
          zoomHeight?: number;
          isReadOnly?: boolean;
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
        response: { success: boolean; path?: string; error?: string; canceled?: boolean };
      };
      selectDirectory: {
        params: {};
        response: { success: boolean; path?: string; error?: string; canceled?: boolean };
      };
      listDirectory: {
        params: { path: string; sourcePath?: string };
        response: { success: boolean; files?: FileInfo[]; error?: string };
      };
      selectSourceDirectory: {
        params: {};
        response: { success: boolean; path?: string; error?: string; canceled?: boolean };
      };
      selectLocalDirectory: {
        params: {};
        response: { success: boolean; path?: string; error?: string; canceled?: boolean };
      };
      updateFromSource: {
        params: { sourcePath: string; localPath: string; fileName: string , brandKey: CadBrand, logData?: Omit<SyncLog, "id" | "createdAt" | "createdBy"> };
        response: { success: boolean; error?: string };
      };
      syncToSource: {
        params: { sourcePath: string; localPath: string; fileName: string , brandKey: CadBrand, logData?: Omit<SyncLog, "id" | "createdAt" | "createdBy"> };
        response: { success: boolean; error?: string };
      };
      cloneDirectory: {
        params: { sourcePath: string; localPath: string; allowedExtensions?: string[] };
        response: { success: boolean; error?: string };
      };
      syncDirectory: {
        params: { sourcePath: string; localPath: string };
        response: { success: boolean; error?: string; syncCount?: number };
      };
      openFile: {
        params: { filePath: string };
        response: { success: boolean; error?: string };
      };
      openInExplorer: {
        params: { filePath: string };
        response: { success: boolean; error?: string };
      };
      startWatchingDirectory: {
        params: { sourcePath: string; localPath: string };
        response: { success: boolean; error?: string };
      };
      stopWatchingDirectory: {
        params: { sourcePath: string };
        response: { success: boolean };
      };
      startWatchingLocalDirectory: {
        params: { sourcePath: string; localPath: string };
        response: { success: boolean; error?: string };
      };
      stopWatchingLocalDirectory: {
        params: { localPath: string };
        response: { success: boolean };
      };
      saveSyncLog: {
        params: Omit<SyncLog, "id" | "createdAt" | "createdBy">;
        response: { success: boolean; error?: string };
      };
      getSyncLogs: {
        params: { sourcePath?: string };
        response: { success: boolean; logs?: SyncLog[]; error?: string };
      };
      isFileOpen: {
        params: { filePath: string };
        response: { isOpen: boolean; brandName?: string };
      };
      openDwg: {
        params: { filePath: string; isReadOnly: boolean };
        response: { success: boolean; error?: string };
      };
       getProducts: {
        params: {};
        response: Product[];
      };
      searchProducts: {
        params: { productCode?: string; productSpec?: string };
        response: Product[];
      };
      filterProductsByAttribute: {
        params: { attribute: string };
        response: Product[];
      };
      getProductsByCodePrefix: {
        params: { prefix: string };
        response: Product[];
      };
      addProduct: {
        params: Product;
        response: { success: boolean; product?: Product; error?: string };
      };
      importProductsFromExcel: {
        params: { filePath: string };
        response: { success: boolean; count?: number; error?: string };
      };
      deleteProduct: {
        params: { id: number };
        response: { success: boolean; error?: string };
      };
      getAllCodePrefixes: {
        params: {};
        response: string[];
      };
      selectExcelFile: {
        params: {};
        response: {
          success: boolean;
          path?: string;
          error?: string;
          canceled?: boolean;
        };
      };
      updateProduct: {
        params: Product;
        response: { success: boolean; error?: string };
      };  
    };
    messages: {
      fileChanged: {
        data: { fileName: string; isLocalChange: boolean };
      };
    };
  }>;
  webview: RPCSchema<{ requests: {
    fileChange:{
      params: { fileName: string;isLocalChange: boolean };
      response: void;
    },
  }; messages: {
    
  } }>;
};


// 定义支持的 CAD 类型
export type CadBrand = "ZWCAD" | "AutoCAD" | "GstarCAD";

export interface CadConfig {
  progId: string; // COM 接口标识符
  scriptFlag: string; // 脚本启动参数，通常是 /b
  brandName: string; // 显示名称
}

export const CAD_MAP: Record<CadBrand, CadConfig> = {
  ZWCAD: {
    progId: "ZWCAD.Application", // 新版本可能需要 ZWCAD.Application.26
    scriptFlag: "/b",
    brandName: "中望CAD",
  },
  AutoCAD: {
    progId: "AutoCAD.Application",
    scriptFlag: "/b",
    brandName: "AutoCAD",
  },
  GstarCAD: {
    progId: "GstarCAD.Application",
    scriptFlag: "/b",
    brandName: "浩辰CAD",
  },
};

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  createdAt: string;
  modifiedAt: string;
  extension: string;
  isReadOnly: boolean;
  syncStatus?: "synced" | "modified" | "new" | "deleted" | "unknown";
  sourceModifiedAt?: string;
}

export type SyncReasonType = "modify" | "new" | "delete" | "custom";

export interface SyncLog {
  id: string;
  fileName: string;
  reasonType: SyncReasonType;
  reason: string;
  createdAt: string;
  createdBy: string;
  sourcePath: string;
  localPath: string;
  operation: "syncToSource" | "updateFromSource";
}
