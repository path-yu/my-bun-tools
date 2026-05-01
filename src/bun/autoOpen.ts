import { exec, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { CAD_MAP, type CadBrand } from "../lib/types";
import * as os from "os";
import { spawnSync } from "bun";
import { join, dirname, basename } from "node:path";
import { existsSync, readFileSync } from "node:fs";

function writeLog(message: string) {
  const logPath = path.join(os.tmpdir(), "cad-debug.log"); // 也可以指定固定目录
  const timestamp = new Date().toLocaleString();
  const logContent = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(logPath, logContent, "utf8");
  } catch (err) {
    console.error("无法写入日志文件:", err);
  }
}
function validatePaths(
  cadPath?: string,
  dwgPath?: string,
): { valid: boolean; msg: string } {
  if (cadPath !== undefined) {
    const cleanCad = sanitizePath(cadPath);
    const exists = fs.existsSync(cleanCad);
    writeLog(`[CAD校验] 路径: ${cleanCad} | 是否存在: ${exists}`);

    if (!exists) {
      return {
        valid: false,
        msg: `[启动失败]: CAD 程序路径不存在: ${cleanCad}`,
      };
    }
  }

  if (dwgPath !== undefined) {
    const cleanDwg = sanitizePath(dwgPath);
    const exists = fs.existsSync(cleanDwg);

    // 关键日志：记录原始路径、清洗后路径和权限测试
    writeLog(`[DWG校验] 原始输入: ${dwgPath}`);
    writeLog(`[DWG校验] 清洗后: ${cleanDwg}`);
    writeLog(`[DWG校验] 是否存在: ${exists}`);

    if (!exists) {
      // 尝试列出父目录内容，判断是网络断开还是权限问题
      try {
        const parent = path.dirname(cleanDwg);
        if (fs.existsSync(parent)) {
          writeLog(
            `[DWG校验] 父目录存在，内容: ${fs.readdirSync(parent).join(", ")}`,
          );
        } else {
          writeLog(`[DWG校验] 无法访问父目录: ${parent}`);
        }
      } catch (e: any) {
        writeLog(`[DWG校验] 权限检查错误: ${e.message}`);
      }

      return { valid: false, msg: `[路径错误]: 目标图纸不存在: ${cleanDwg}` };
    }
  }
  return { valid: true, msg: "OK" };
}
function sanitizePath(rawPath: string): string {
  if (!rawPath) return "";

  // 1. 统一正斜杠
  let p = rawPath.replace(/\//g, "\\");

  // 2. 检查是否为 UNC 路径 (\\Server\Share)
  const isUNC = p.startsWith("\\\\");

  // 3. 规范化
  p = path.normalize(p);

  // 4. 修复 normalize 可能吃掉 UNC 开头的问题
  if (isUNC && !p.startsWith("\\\\")) {
    // 如果被变成了 \Server\Share，则补回一个 \
    if (p.startsWith("\\")) {
      p = "\\" + p;
    } else {
      p = "\\\\" + p;
    }
  }

  return p;
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
      (error, stdout) => {
        if (error || stdout.includes("PS_ERROR")) {
          writeLog(`[PS执行失败]: ${stdout || error?.message}`);
          resolve(`[${failMsg}]: ${stdout}`);
        }
        if (error) {
          resolve(`[${failMsg}]: CAD 实例未就绪或图纸被独占`);
        } else {
          resolve(`[${successMsg}]`);
        }
      },
    );
  });
}
// 扩展接口，增加 ReadOnly 字段
interface ZwDocument {
  name: string;
  path: string;
  isReadOnly: boolean;
  owner: string;
}
export function parseDwgPath(filePath: string) {
  const dir = dirname(filePath);
  const dwlPath = join(dir, basename(filePath).replace(/\.dwg$/i, ".dwl"));

  // 判断 .dwl 是否存在
  const hasDwl = existsSync(dwlPath);
  let owner = "";
  let isReadOnly = false; // 默认先假设不是只读
  if (hasDwl) {
    try {
      const content = readFileSync(dwlPath, "utf8").split("\n");
      owner = content[0]?.trim() || "未知";
      // 如果 .dwl 存在，说明文件被打开了。通常情况下，只有打开文件的用户才有写权限。
      isReadOnly = true; // 只要有 .dwl，就先标记为只读，后续可以根据 owner 进一步判断
    } catch (e) {
      owner = "正在访问...";
    }
  } else {
    // 如果没有 .dwl 文件，说明这个文件在 CAD 里虽然列出来了，但并没有被真正锁定
    isReadOnly = false; // 或者你可以选择在 map 里过滤掉这类数据
  }
  return {
    name: basename(filePath),
    path: filePath,
    isReadOnly: isReadOnly,
    owner: owner,
  };
}

export function getZwCadFiles(cadBrand: CadBrand): ZwDocument[] {
  const psCommand = `
    try {
      $zwcad = [Runtime.InteropServices.Marshal]::GetActiveObject("${cadBrand}.Application")
      if ($zwcad -and $zwcad.Documents.Count -gt 0) {
        $zwcad.Documents | Where-Object { $_.FullName -ne "" } | ForEach-Object { 
          [PSCustomObject]@{ 
            Name = $_.Name; 
            Path = $_.FullName;
            # 依然保留原始 ReadOnly 供参考
            ComReadOnly = [bool]$_.ReadOnly 
          } 
        } | ConvertTo-Json
      } else { "[]" }
    } catch { "[]" }
  `;

  const { stdout } = spawnSync(["powershell", "-Command", psCommand]);
  const output = new TextDecoder().decode(stdout).trim();
  if (!output || output === "[]") return [];

  const data = JSON.parse(output);
  const rawList = Array.isArray(data) ? data : [data];

  return rawList.map((item: any) => {
    const filePath = item.Path;
    const dir = dirname(filePath);
    const dwlPath = join(dir, basename(filePath).replace(/\.dwg$/i, ".dwl"));

    // 判断 .dwl 是否存在
    const hasDwl = existsSync(dwlPath);
    let owner = "";
    let isReadOnly = item.ComReadOnly; // 默认先取 COM 的值

    if (hasDwl) {
      try {
        const content = readFileSync(dwlPath, "utf8").split("\n");
        owner = content[0]?.trim() || "未知";

        // --- 核心逻辑变更 ---
        // 如果存在 .dwl，说明文件被打开了。
        // 如果 owner 不是当前用户，那对你来说肯定是 ReadOnly。
        const currentUser = process.env.USERNAME || "";
        if (owner !== currentUser) {
          isReadOnly = true;
        } else {
          // 如果 owner 是你，通常是可写的，除非文件本身被系统设为了只读属性
          isReadOnly = false;
        }
      } catch (e) {
        owner = "正在访问...";
      }
    } else {
      // 如果没有 .dwl 文件，说明这个文件在 CAD 里虽然列出来了，但并没有被真正锁定
      isReadOnly = false; // 或者你可以选择在 map 里过滤掉这类数据
    }

    return {
      name: item.Name,
      path: item.Path,
      isReadOnly: isReadOnly,
      owner: owner,
    };
  }); // 进一步过滤：没有 owner 的（没 dwl 的）通常是无效残留记录
}
/**
 * 切换中望CAD当前激活的图纸窗口
 * @param fileNameOrPath 想要激活的文件名（如 "A.dwg"）或完整路径
 */
export function activateZwCadDocument(
  cadBrand: CadBrand,
  fileNameOrPath: string,
): boolean {
  // PowerShell 逻辑：
  // 1. 获取 ZWCAD 实例
  // 2. 遍历 Documents 集合寻找匹配项
  // 3. 调用 .Activate() 方法
  const psCommand = `
    try {
      $zwcad = [Runtime.InteropServices.Marshal]::GetActiveObject("${cadBrand}.Application")
      $target = $null

      # 寻找匹配的文档 (支持文件名或全路径匹配)
      foreach ($doc in $zwcad.Documents) {
        if ($doc.Name -eq "${fileNameOrPath}" -or $doc.FullName -eq "${fileNameOrPath}") {
          $target = $doc
          break
        }
      }

      if ($target -ne $null) {
        $target.Activate()
        # 强制 CAD 窗口到前台（可选）
        # $zwcad.WindowState = 3 # 3 代表最大化/正常显示
        return $true
      }
      return $false
    } catch {
      return $false
    }
  `;

  const { stdout } = spawnSync(["powershell", "-Command", psCommand]);
  const result = new TextDecoder().decode(stdout).trim();

  return result.toLowerCase() === "true";
}
/**
 * 关闭中望CAD指定的图纸窗口
 * @param fileNameOrPath 文件名或完整路径
 * @param saveChanges 是否保存更改（默认为 false，即放弃更改直接关闭）
 */
export function closeZwCadDocument(data: {
  fileNameOrPath: string;
  saveChanges?: boolean;
  cadBrand: CadBrand;
}): boolean {
  const { fileNameOrPath, saveChanges = true, cadBrand } = data;
  // PowerShell 逻辑：
  // 1. 找到匹配的 Document 对象
  // 2. 调用 .Close($saveChanges)
  // 注意：PowerShell 调用 COM 方法时，布尔值需要转为 [System.Boolean]
  const psCommand = `
    try {
      $zwcad = [Runtime.InteropServices.Marshal]::GetActiveObject("${cadBrand}.Application")
      $target = $null

      foreach ($doc in $zwcad.Documents) {
        if ($doc.Name -eq "${fileNameOrPath}" -or $doc.FullName -eq "${fileNameOrPath}") {
          $target = $doc
          break
        }
      }

      if ($target -ne $null) {
        # Close 方法第一个参数是 SaveChanges
        # $true = 保存并关闭, $false = 不保存直接关闭
        $save = if ("${saveChanges}" -eq "true") { $true } else { $false }
        $target.Close($save)
        return $true
      }
      return $false
    } catch {
      return $false
    }
  `;

  const { stdout } = spawnSync(["powershell", "-Command", psCommand]);
  const result = new TextDecoder().decode(stdout).trim();

  return result.toLowerCase() === "true";
}
