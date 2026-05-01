import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { CadConfig } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// 读取本地cad配置
export function readCadConfig() {
  const cadConfig = localStorage.getItem("cadConfig");
   const data = cadConfig ? JSON.parse(cadConfig) : {} as CadConfig;
  //  格式化数据将type 中望CAD AutoCAD 浩辰CAD转换为CadBrand类型
  let brandKey = data.type ;
  if(data.type === "中望CAD"){
    brandKey = "ZWCAD";
  }
  if(data.type === "AutoCAD"){
    brandKey = "AutoCAD";
  }
  if(data.type === "浩辰CAD"){
    brandKey = "GstarCAD";
  }
  return {
    brandKey,
    path: data.path
  }
}
