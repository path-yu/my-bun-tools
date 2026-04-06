import { exec, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as iconv from "iconv-lite";
// 建议 1: 改为相对路径
import { CAD_MAP, type CadBrand } from "../lib/types";

/**
 * 工业级多 CAD 启动导航方案
 */
export async function professionalCadNavigate(
  brand: CadBrand,
  cadPath: string,
  materialCode: string,
  dwgPath: string,
  x: number,
  y: number,
  zoomHeight: number = 500,
) {
  const config = CAD_MAP[brand];
  const scriptDir = path.join(process.cwd(), "cad_scripts");
  if (!fs.existsSync(scriptDir)) fs.mkdirSync(scriptDir, { recursive: true });

  // 【关键修改】Lisp 路径必须使用正斜杠，否则 UNC 路径会因转义失败
  // 例如 \\SJWL\图纸.dwg -> //SJWL/图纸.dwg
  const safeLispPath = path
    .join(scriptDir, `logic_${materialCode}.lsp`)
    .replace(/\\/g, "/");
  const safeScrPath = path
    .join(scriptDir, `boot_${materialCode}.scr`)
    .replace(/\\/g, "/");
  const safeDwgPath = dwgPath.replace(/\\/g, "/");
  // --- 新增：文件存在性预检 ---
  if (!fs.existsSync(safeDwgPath)) {
    console.error(
      `[启动取消]: 找不到图纸文件，请检查路径是否正确: ${safeDwgPath}`,
    );
    // 这里可以弹出你之前的 MUI 提示或通知
    return  `[启动取消]: 找不到图纸文件，请检查路径是否正确: ${safeDwgPath}`
  }
  const lispContent = [
    "(vl-load-com)",
    "(defun c:smart_zoom ()",
    '  (setvar "CMDECHO" 0)',
    '  (command "_.DELAY" 3000)',
    '  (command "._UCS" "_W")',
    // 使用 rtos 确保 zoomHeight 转换为字符串，避免坐标列表中出现类型错误
    `  (command "._ZOOM" "_C" (list ${x} ${y} 0) (rtos ${zoomHeight} 2 2))`,
    "  (princ)",
    ")",
    "(c:smart_zoom)",
  ].join("\r\n");

  try {
    // 必须使用 GBK 编码，AutoCAD 命令行不识别 UTF-8 的中文路径
    fs.writeFileSync(
      safeLispPath.replace(/\//g, "\\"),
      iconv.encode(lispContent, "gbk"),
    );
    fs.writeFileSync(
      safeScrPath.replace(/\//g, "\\"),
      iconv.encode(`(load "${safeLispPath}")\r\n `, "gbk"),
    );
  } catch (err) {
    console.error(`[脚本错误] 写入失败: ${err}`);
    return `[脚本错误] 写入失败: ${err}`
  }

  try {
    // spawn 启动时，dwgPath 必须保留原始反斜杠并加双引号包裹
    const child = spawn(
      `"${cadPath}"`,
      [
        `"${safeDwgPath}"`,
        "/nologo",
        config.scriptFlag,
        `"${safeScrPath.replace(/\//g, "\\")}"`,
      ],
      {
        detached: true,
        stdio: "ignore",
        shell: true,
        windowsVerbatimArguments: true,
      },
    );

    child.unref();
    console.log(`[系统] 正在启动并定位网络路径: ${safeDwgPath}`);
  } catch (err) {
    return `[启动错误] ${err}`
  }
}
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
