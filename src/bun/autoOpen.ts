import { exec, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
// 建议 1: 改为相对路径
import { CAD_MAP, type CadBrand } from "../lib/types";


/**
 * 强行定位到具体 DWG 文件的指定坐标
 * @param brand CAD品牌 (AutoCAD, ZWCAD 等)
 * @param dwgPath DWG文件的绝对路径 (例如: C:\\Projects\\Floor1.dwg)
 * @param x X坐标
 * @param y Y坐标
 * @param zoomHeight 缩放高度，默认500
 */
export async function fixedCadLocate(
  brand: CadBrand,
  dwgPath: string,
  x: number,
  y: number,
  zoomHeight: number = 500,
) {
  if (isNaN(x) || isNaN(y)) return;
  const config = CAD_MAP[brand];
  if (!config) return;

  // 【关键修改】PowerShell 内部字符串处理
  // 1. 获取绝对路径并规范化
  const absolutePath = path.resolve(dwgPath);
  // 2. 对于 PowerShell 脚本块，我们需要将路径中的单反斜杠转为双反斜杠
  // 以便在 '$doc.FullName -eq ...' 比较时能正确匹配
  const psSafePath = absolutePath.replace(/\\/g, "\\\\");
  const fileName = path.basename(dwgPath);
  // --- 新增：Node 层面初检 ---
  if (!fs.existsSync(psSafePath)) {
    console.error(`[定位取消]: 目标文件不存在: ${psSafePath}`);
    return `[定位取消]: 目标文件不存在: ${psSafePath}`;
  }
  const psCommands = [
    `$ErrorActionPreference = 'Stop'`,
    `try {`,
    // 获取 COM 对象
    `  $cad = [Runtime.InteropServices.Marshal]::GetActiveObject('${config.progId}')`,
    `  $targetDoc = $null`,
    `  foreach ($doc in $cad.Documents) {`,
    // 增加 ToLower() 比较以忽略大小写差异
    `    if ($doc.FullName.ToLower() -eq '${psSafePath.toLowerCase()}' -or $doc.Name -eq '${fileName}') {`,
    `      $targetDoc = $doc`,
    `      break`,
    `    }`,
    `  }`,
    // 如果没找到则打开
    `  if ($targetDoc -eq $null) {`,
    // 注意：PowerShell 判断 UNC 路径存在需要 Test-Path
    `    if (Test-Path '${psSafePath}') {`,
    `      $targetDoc = $cad.Documents.Open('${psSafePath}')`,
    `    } else {`,
    `      throw "无法访问网络路径: ${psSafePath}"`,
    `    }`,
    `  }`,
    `  $targetDoc.Activate()`,
    // 置顶逻辑
    `  $process = Get-Process | Where-Object { $_.ProcessName -match '${brand}' } | Select-Object -First 1`,
    `  if ($process) {`,
    `    $wshell = New-Object -ComObject WScript.Shell`,
    `    $wshell.AppActivate($process.Id)`,
    `  }`,
    // 发送命令
    `  $esc = [char]27`,
    `  $cmd = "$esc$esc._UCS _W ._ZOOM _C ${x},${y} ${zoomHeight} "`,
    `  $targetDoc.SendCommand($cmd)`,
    `  Write-Host 'Success'`,
    `} catch {`,
    `  Write-Error $_.Exception.Message`,
    `  exit 1`,
    `}`,
  ].join("\r\n"); // 使用换行符提高可读性

  // 使用 EncodedCommand 避免复杂的引号转义问题
  const buffer = Buffer.from(psCommands, "utf16le");
  const base64Str = buffer.toString("base64");
  const fullCommand = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${base64Str}`;

  exec(fullCommand, { timeout: 15000 }, (error, stdout, stderr) => {
    if (error) {
      console.error(`[定位失败]: 检查文件是否在共享服务器上且有权限访问。`);
      return `[定位失败]: 检查文件是否在共享服务器上且有权限访问。`;
    } else {
      console.log(`[定位成功]: 网络文件已置顶并跳转。`);
    }
  });
}

/**
 * 核心逻辑：智能启动并定位
 * 1. 立即纯净启动 CAD
 * 2. 异步轮询检测 CAD 是否加载就绪
 * 3. 就绪后通过 PowerShell 发送 COM 指令定位
 */
export async function professionalCadNavigate(
  brand: CadBrand,
  cadPath: string,
  dwgPath: string,
  x: number,
  y: number,
  zoomHeight: number = 500
) {
    const config = CAD_MAP[brand]
  if (!config) return "[错误]: 未定义的 CAD 品牌配置";

  // --- 第一阶段：纯净启动 ---
  // 不带任何 /b 脚本参数，彻底避免 EBUSY 和启动卡死
  const safeDwgPath = path.resolve(dwgPath);
  
  try {
    const child = spawn(`"${cadPath}"`, [`"${safeDwgPath}"`, "/nologo"], {
      detached: true,
      stdio: "ignore",
      shell: true,
      windowsVerbatimArguments: true,
    });
    child.unref(); 
    console.log(`[启动] 已发起 CAD 启动指令，正在打开: ${path.basename(dwgPath)}`);
  } catch (err) {
    return `[启动失败]: ${err}`;
  }

  // --- 第二阶段：异步追击定位 ---
  // 启动后每 2.5 秒探测一次 CAD 状态，直到定位成功或超时
  let attempts = 0;
  const maxAttempts = 20; // 最多等待 60 秒

  const timer = setInterval(() => {
    attempts++;
    console.log(`[探测] 正在尝试连接 CAD 实例 (${attempts}/${maxAttempts})...`);

    // 调用执行 PowerShell 定位逻辑
    runPowerShellLocate(config.progId, safeDwgPath, x, y, zoomHeight, (success, msg) => {
      if (success) {
        clearInterval(timer);
        console.log(`[定位成功]: ${msg}`);
      } else if (attempts >= maxAttempts) {
        clearInterval(timer);
        console.error(`[定位超时]: CAD 响应过慢或权限受阻。`);
        return `[定位超时]: CAD 响应过慢或权限受阻。`;
      }
    });
  }, 3000);

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
  callback: (success: boolean, msg: string) => void
) {
  const psSafePath = dwgPath.replace(/\\/g, "\\\\").toLowerCase();
  const fileName = path.basename(dwgPath).toLowerCase();

  const psCommands = [
    `$ErrorActionPreference = 'Stop'`,
    `try {`,
    // 获取当前运行中的 CAD 实例
    `  $cad = [Runtime.InteropServices.Marshal]::GetActiveObject('${progId}')`,
    `  $targetDoc = $null`,
    `  foreach ($doc in $cad.Documents) {`,
    `    if ($doc.FullName.ToLower() -eq '${psSafePath}' -or $doc.Name.ToLower() -eq '${fileName}') {`,
    `      $targetDoc = $doc; break`,
    `    }`,
    `  }`,
    // 如果还没加载到这个文档，返回失败触发下一次轮询
    `  if ($targetDoc -eq $null) { throw 'Wait' }`,
    
    // 执行定位指令
    `  $targetDoc.Activate()`,
    `  $esc = [char]27`,
    `  $cmd = "$esc$esc._UCS _W ._ZOOM _C ${x},${y} ${zoomHeight} "`,
    `  $targetDoc.SendCommand($cmd)`,
    `  Write-Host 'OK'`,
    `} catch { exit 1 }`
  ].join("\r\n");

  const buffer = Buffer.from(psCommands, "utf16le");
  const base64Str = buffer.toString("base64");
  const fullCommand = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${base64Str}`;

  exec(fullCommand, { timeout: 5000 }, (error, stdout) => {
    if (!error && stdout.trim() === "OK") {
      callback(true, "坐标已跳转");
    } else {
      callback(false, "等待就绪");
    }
  });
}