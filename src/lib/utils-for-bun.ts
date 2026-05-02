import { spawnSync } from "bun";
import { CADType } from "./types";
/**
 * 获取当前电脑 .dwg 文件的默认打开程序路径
 */
export function getDefaultDwgApp(): { type: CADType; path: string } | null {
  try {
    // 1. 查找 .dwg 关联的 ProgID
    // 优先查找当前用户的关联，如果没有则查找系统关联
    const extQuery = spawnSync(["reg", "query", "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.dwg\\UserChoice", "/v", "ProgId"]);

    let progId = "";
    if (extQuery.success) {
      const match = extQuery.stdout.toString().match(/ProgId\s+REG_SZ\s+(.*)/);
      progId = match ? match[1].trim() : "";
    }

    // 如果 UserChoice 没搜到，去根路径搜
    if (!progId) {
      const rootQuery = spawnSync(["reg", "query", "HKEY_CLASSES_ROOT\\.dwg", "/ve"]);
      if (rootQuery.success) {
        const match = rootQuery.stdout.toString().match(/\(Default\)\s+REG_SZ\s+(.*)/);
        progId = match ? match[1].trim() : "";
      }
    }

    if (!progId) return null;

    // 2. 根据 ProgID 查找打开命令
    const cmdQuery = spawnSync(["reg", "query", `HKEY_CLASSES_ROOT\\${progId}\\shell\\open\\command`, "/ve"]);
    if (!cmdQuery.success) return null;

    const cmdMatch = cmdQuery.stdout.toString().match(/\(Default\)\s+REG_SZ\s+(.*)/);
    if (!cmdMatch) return null;

    // 3. 提取路径（处理带引号的情况）
    const rawPath = cmdMatch[1].trim();
    // 匹配 "C:\...\exe" 或者 C:\...\exe 
    const exePathMatch = rawPath.match(/^"([^"]+)"/) || rawPath.match(/^([^\s]+)/);

    const exePath = exePathMatch ? exePathMatch[1] : rawPath;
    let cadType:CADType="AutoCAD";
    // 识别是哪家的
    const lowerPath = exePath.toLowerCase();
    if (lowerPath.includes("autocad") || lowerPath.includes("acad.exe")) {
      cadType = 'AutoCAD';
    }
    if (lowerPath.includes("zw")) {
      cadType = '中望CAD';
    }
    if (lowerPath.includes("gs")) {
      cadType = '浩辰CAD';
    }
    return {
      type: cadType as CADType,
      path: exePath
    }
  } catch (error) {
    console.error("查找默认程序失败:", error);
    return null;
  }
}



