import { exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';
// 建议 1: 改为相对路径
import { CAD_MAP, type CadBrand } from '../lib/types';

/**
 * 工业级多 CAD 启动导航方案
 */
export async function professionalCadNavigate(
    brand: CadBrand,      // 传入品牌
    cadPath: string,      // 传入用户设置中的 exe 路径
    materialCode: string, 
    dwgPath: string, 
    x: number, 
    y: number, 
    zoomHeight: number = 500
) {
    const config = CAD_MAP[brand];
    const scriptDir = path.join(process.cwd(), "cad_scripts");
    if (!fs.existsSync(scriptDir)) fs.mkdirSync(scriptDir, { recursive: true });
    // 文件名逻辑保持唯一
    const lispPath = path.join(scriptDir, `logic_${materialCode}.lsp`).replace(/\\/g, '/');
    const scrPath = path.join(scriptDir, `boot_${materialCode}.scr`).replace(/\\/g, '/');

    // 1. 生成 Lisp 定位脚本
    const lispContent = [
        '(vl-load-com)',
        '(defun c:smart_zoom ()',
        '  (setvar "CMDECHO" 0)',
        '  (command "_.DELAY" 3000)', // 缩短延时，3秒通常足够
        '  (command "._UCS" "_W")',
        `  (command "._ZOOM" "_C" (list ${x} ${y} 0) "${zoomHeight}")`,
        '  (princ)',
        ')',
        '(c:smart_zoom)'
    ].join('\r\n');

    try {
        fs.writeFileSync(lispPath, iconv.encode(lispContent, 'gbk'));
        fs.writeFileSync(scrPath, iconv.encode(`(load "${lispPath}")\r\n `, 'gbk'));
    } catch (err) {
        console.error(`[脚本错误] 写入失败: ${err}`);
        return;
    }

    // 2. 启动进程
    try {
        // 使用双引号包裹路径以处理空格
        const child = spawn(`"${cadPath}"`, [
            `"${dwgPath}"`, 
            '/nologo', 
            config.scriptFlag, 
            `"${scrPath}"`
        ], { 
            detached: true, 
            stdio: 'ignore',
            shell: true 
        });

        child.unref();
        console.log(`[系统] 正在启动 ${config.brandName} 并定位产品: ${materialCode}`);
    } catch (err) {
        console.error(`[启动错误] ${config.brandName} 启动失败: ${err}`);
    }
}

/**
 * 基于 COM 接口的热跳转方案
 */
// export async function fixedCadLocate(
//     brand: CadBrand, 
//     x: number, 
//     y: number, 
//     zoomHeight: number = 500
// ) {
//     if (isNaN(x) || isNaN(y)) return console.error("坐标数值无效");

//     const config = CAD_MAP[brand];

//     // 构造 PowerShell 指令
//     const psCommands = [
//         `$ErrorActionPreference = 'Stop'`,
//         `try {`,
//         // 动态获取对应品牌的 COM 对象
//         `  $cad = [Runtime.InteropServices.Marshal]::GetActiveObject('${config.progId}')`,
//         `  $esc = [char]27`,
//         // 连续发送两个 ESC 确保退出当前正在执行的 CAD 命令
//         `  $cmd = "$esc$esc._UCS _W ._ZOOM _C ${x},${y} ${zoomHeight} "`,
//         `  $cad.ActiveDocument.SendCommand($cmd)`,
//         `  Write-Host 'Success'`,
//         `} catch {`,
//         `  exit 1`,
//         `}`
//     ].join('; ');

//     const buffer = Buffer.from(psCommands, 'utf16le');
//     const base64Str = buffer.toString('base64');
//     const fullCommand = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${base64Str}`;

//     exec(fullCommand, (error) => {
//         if (error) {
//             console.error(`[定位失败]: 请确认 ${config.brandName} 已打开`);
//             console.log(`当前尝试的 ProgID: ${config.progId}`);
//         } else {
//             console.log(`[成功]: 已向运行中的 ${config.brandName} 发送跳转指令 (${x}, ${y})`);
//         }
//     });
// }
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
    zoomHeight: number = 500
) {
    if (isNaN(x) || isNaN(y)) {
        console.error("坐标数值无效");
        return;
    }
    const config = CAD_MAP[brand];
    if (!config) {
        console.error("不支持的 CAD 品牌");
        return;
    }

    const formattedPath = path.resolve(dwgPath).replace(/\\/g, '\\\\');
    const fileName = path.basename(dwgPath);

    const psCommands = [
        `$ErrorActionPreference = 'Stop'`,
        `try {`,
        // 1. 获取 CAD 对象
        `  $cad = [Runtime.InteropServices.Marshal]::GetActiveObject('${config.progId}')`,
        `  $targetDoc = $null`,
        `  foreach ($doc in $cad.Documents) {`,
        `    if ($doc.FullName -eq '${formattedPath}' -or $doc.Name -eq '${fileName}') {`,
        `      $targetDoc = $doc`,
        `      break`,
        `    }`,
        `  }`,
        // 2. 如果没找到则打开
        `  if ($targetDoc -eq $null) {`,
        `    if (Test-Path '${formattedPath}') {`,
        `      $targetDoc = $cad.Documents.Open('${formattedPath}')`,
        `    } else {`,
        `      throw "找不到文件: ${formattedPath}"`,
        `    }`,
        `  }`,
        // 3. 文档级激活 (内部切换)
        `  $targetDoc.Activate()`,
        
        // --- 核心置顶逻辑开始 ---
        // 4. 获取进程并强制置顶主窗口
        `  $process = Get-Process | Where-Object { $_.ProcessName -match '${brand}' } | Select-Object -First 1`,
        `  if ($process) {`,
        `    $wshell = New-Object -ComObject WScript.Shell`,
        `    $wshell.AppActivate($process.Id)`, // 唤醒窗口
        `  }`,
        // --- 核心置顶逻辑结束 ---

        `  $esc = [char]27`,
        `  $cmd = "$esc$esc._UCS _W ._ZOOM _C ${x},${y} ${zoomHeight} "`,
        `  $targetDoc.SendCommand($cmd)`,
        `  Write-Host 'Success'`,
        `} catch {`,
        `  Write-Error $_.Exception.Message`,
        `  exit 1`,
        `}`
    ].join('; ');

    const buffer = Buffer.from(psCommands, 'utf16le');
    const base64Str = buffer.toString('base64');
    const fullCommand = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${base64Str}`;

    exec(fullCommand, { timeout: 15000 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[定位失败]: ${config.brandName} 操作异常`);
            if (stderr.includes('0x800401E3')) {
                console.warn(`建议: 请确保 ${config.brandName} 程序已在运行。`);
            }
        } else {
            console.log(`[定位成功]: 已强行跳转并置顶 ${fileName}`);
        }
    });
}