import { RPCSchema } from "electrobun/bun";

export type DrawingCategory = "不锈钢" | "碳钢" | "真空罐";

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

export type CADType = "AutoCAD" | "浩辰CAD" | "中望CAD";

export interface CADConfig {
  type: CADType |"";
  path: string;
}
//   bun: RPCSchema<{
//     requests: {
//       getAll: {
//         params: {};
//         response: Drawing[];
//       };
//       add: {
//         params: Omit<Drawing, "id" | "created_at">;
//         response: Drawing;
//       };
//       update: {
//         params: Drawing;
//         response: Drawing;
//       };
//       delete: {
//         params: { id: number };
//         response: { success: boolean };
//       };
//       locateInCad: {
//         params: { cadType: CADType; x: number; y: number };
//         response: void;
//       };
//       professionalCadNavigate: {
//         params: {
//           brand: CadBrand;
//           cadPath: string;
//           materialCode: string;
//           dwgPath: string;
//           x: number;
//           y: number;
//           zoomHeight?: number;
//         };
//         response: void;
//       };
//     };
//     messages: {};
//   }>;
//   webview: RPCSchema<{ requests: {}; messages: {} }>;
// };
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
          dwgPath: string;
          x: number;
          y: number;
          zoomHeight?: number;
        };
        response:any;
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

    };
    messages: {};
  }>;
  webview: RPCSchema<{ requests: {}; messages: {} }>;
};

//  export type DrawingRPC = {
// 	 bun: RPCSchema<{
// 		 requests: {
// 			 getAll: {
// 				 params: {};
// 				 response: Drawing[];
// 			 };
// 			 add: {
// 				 // 排除自动生成的字段，其余字段作为参数
// 				 params: Omit<Drawing, "id" | "created_at">;
// 				 response: Drawing;
// 			 };
// 			 update: {
// 				 params: Drawing;
// 				 response: Drawing;
// 			 };
// 			 delete: {
// 				 params: { id: number };
// 				 response: { success: boolean };
// 			 };
// 			 locateInCad: {
// 				 params: {
// 					 cadType: CadBrand;
// 					 dwgPath: string;
// 					 x: number;
// 					 y: number;
// 					 zoomHeight?: number;
// 				 };
// 				 response: void;
// 			 };
// 			 professionalCadNavigate: {
// 				 params: {
// 					 brand: CadBrand;
// 					 cadPath: string;
// 					 materialCode: string;
// 					 dwgPath: string;
// 					 x: number;
// 					 y: number;
// 					 zoomHeight?: number;
// 				 };
// 				 response: void;
// 			 };
// 		 };
// 		 messages: {};
// 	 }>;
// 	 webview: RPCSchema<{ requests: {}; messages: {} }>;
//  };
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
