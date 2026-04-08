import { exec, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { CAD_MAP, type CadBrand } from "../lib/types";

function validatePaths(
  cadPath?: string,
  dwgPath?: string,
): { valid: boolean; msg: string } {
  if (cadPath !== undefined) {
    const cleanCad = sanitizePath(cadPath); // 清洗路径
    if (!fs.existsSync(cleanCad)) {
      return {
        valid: false,
        msg: `[启动失败]: CAD 程序路径不存在: ${cleanCad}`,
      };
    }
    // ...
  }

  if (dwgPath !== undefined) {
    const cleanDwg = sanitizePath(dwgPath); // 清洗路径
    if (!fs.existsSync(cleanDwg)) {
      return { valid: false, msg: `[路径错误]: 目标图纸不存在: ${cleanDwg}` };
    }
    // ...
  }
  return { valid: true, msg: "OK" };
}

/**
 * 强行定位到具体 DWG 文件的指定坐标
 */
export async function fixedCadLocate(
  brand: CadBrand,
  dwgPath: string,
  x: number,
  y: number,
  zoomHeight: number = 500,
) {
  if (isNaN(x) || isNaN(y)) return "[参数错误]: 坐标值无效";
  const config = CAD_MAP[brand];
  if (!config) return "[错误]: 未定义的 CAD 品牌配置";

  // --- 路径校验 ---
  const check = validatePaths(undefined, dwgPath);
  if (!check.valid) {
    console.error(check.msg);
    return check.msg; // 返回给前端的错误提示
  }

  // 核心：清洗并获取绝对路径
  const absolutePath = path.resolve(sanitizePath(dwgPath));

  // 对于 PowerShell COM 接口，路径中的单反斜杠需要转义成双反斜杠
  // 但 UNC 开头的 \\ 不需要额外变成 \\\\，除非你在构建 PowerShell 字符串字面量
  const psSafePath = absolutePath.replace(/'/g, "''");
  const fileName = path.basename(absolutePath).replace(/'/g, "''");

  const psCommands = `
    $ErrorActionPreference = 'Stop'
    try {
        $cad = [Runtime.InteropServices.Marshal]::GetActiveObject('${config.progId}')
        $targetDoc = $cad.Documents | Where-Object { 
            $_.FullName.ToLower() -eq '${psSafePath.toLowerCase()}' -or $_.Name.ToLower() -eq '${fileName.toLowerCase()}' 
        } | Select-Object -First 1

        if (-not $targetDoc) {
            $targetDoc = $cad.Documents.Open('${psSafePath}')
        }
        $targetDoc.Activate()
        $cmd = [char]27 + [char]27 + "._UCS _W ._ZOOM _C ${x},${y} ${zoomHeight} "
        $targetDoc.SendCommand($cmd)
        Write-Host 'Success'
    } catch {
        Write-Error $_.Exception.Message
        exit 1
    }
  `;

  return executePowerShell(psCommands, "定位成功", "定位失败");
}

/**
 * 核心逻辑：智能启动并定位
 */
export async function professionalCadNavigate(
  brand: CadBrand,
  cadPath: string,
  dwgPath: string,
  x: number,
  y: number,
  zoomHeight: number = 500,
) {
  const config = CAD_MAP[brand];
  if (!config) return "[错误]: 未定义的 CAD 品牌配置";

  // --- 路径校验：同时校验 CAD 程序和 DWG 文件 ---
  const check = validatePaths(cadPath, dwgPath);
  if (!check.valid) {
    console.error(check.msg);
    return check.msg; // 立即向前端报错
  }

  const safeDwgPath = path.resolve(dwgPath);

  try {
    // 使用 spawn 启动程序，捕获可能的同步错误
    const child = spawn(`"${cadPath}"`, [`"${safeDwgPath}"`, "/nologo"], {
      detached: true,
      stdio: "ignore",
      shell: true,
      windowsVerbatimArguments: true,
    });

    child.on("error", (err) => {
      console.error(`[系统执行错误]: ${err.message}`);
    });

    child.unref();
  } catch (err) {
    return `[权限错误]: 无法启动 CAD 程序，请检查管理员权限。`;
  }

  // --- 异步追击定位 ---
  let attempts = 0;
  const maxAttempts = 15; // 缩短探测次数，提高反馈效率

  const timer = setInterval(() => {
    attempts++;
    runPowerShellLocate(
      config.progId,
      safeDwgPath,
      x,
      y,
      zoomHeight,
      (success) => {
        if (success) {
          clearInterval(timer);
          console.log(`[定位成功]`);
        } else if (attempts >= maxAttempts) {
          clearInterval(timer);
          console.error(
            `[定位超时]: CAD 启动后响应过慢，请手动点击 CAD 窗口。`,
          );
        }
      },
    );
  }, 3000);

  return `[启动中]: 正在尝试唤起 CAD...`;
}

/**
 * 内部函数：通过 PowerShell 操控已打开的 CAD
 */
function runPowerShellLocate(
  progId: string,
  dwgPath: string,
  x: number,
  y: number,
  zoomHeight: number,
  callback: (success: boolean, msg: string) => void,
) {
  const psSafePath = dwgPath.replace(/'/g, "''").toLowerCase();
  const fileName = path.basename(dwgPath).replace(/'/g, "''").toLowerCase();

  const psCommands = `
    try {
        $cad = [Runtime.InteropServices.Marshal]::GetActiveObject('${progId}')
        $targetDoc = $cad.Documents | Where-Object { 
            $_.FullName.ToLower() -eq '${psSafePath}' -or $_.Name.ToLower() -eq '${fileName}' 
        } | Select-Object -First 1
        if ($targetDoc) {
            $targetDoc.Activate()
            $targetDoc.SendCommand([char]27 + [char]27 + "._UCS _W ._ZOOM _C ${x},${y} ${zoomHeight} ")
            Write-Host 'OK'
        } else { exit 1 }
    } catch { exit 1 }
  `;

  const base64Str = Buffer.from(psCommands, "utf16le").toString("base64");
  exec(
    `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${base64Str}`,
    (error, stdout) => {
      if (!error && stdout.trim() === "OK") {
        callback(true, "OK");
      } else {
        callback(false, "Wait");
      }
    },
  );
}

/**
 * 辅助执行器
 */
function executePowerShell(
  script: string,
  successMsg: string,
  failMsg: string,
): Promise<string> {
  const base64Str = Buffer.from(script, "utf16le").toString("base64");
  return new Promise((resolve) => {
    exec(
      `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${base64Str}`,
      { timeout: 10000 },
      (error) => {
        if (error) {
          resolve(`[${failMsg}]: CAD 实例未就绪或图纸被独占`);
        } else {
          resolve(`[${successMsg}]`);
        }
      },
    );
  });
}

/**
 * 路径清洗工具：处理多余的斜杠并规范化
 */
function sanitizePath(rawPath: string): string {
  if (!rawPath) return "";

  // 1. 将所有正斜杠 / 统一替换为反斜杠 \
  let p = rawPath.replace(/\//g, "\\");

  // 2. 处理重复的开头斜杠
  // 如果路径以 4 个反斜杠开头，收缩为 2 个 (UNC 标准)
  if (p.startsWith("\\\\\\\\")) {
    p = "\\\\" + p.slice(4);
  }

  // 3. 使用 path.normalize 处理中间的多余斜杠（如 a\\\b -> a\b）
  // 并处理相对路径符号
  return path.normalize(p);
}
