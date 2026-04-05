import { exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';


/**
 * 工业级中望CAD定位方案 (产品编码唯一标识版)
 * 逻辑：根据产品编码生成固定脚本，存在则直接调用，不存在则创建。
 */
export async function professionalCadNavigate(
    materialCode: string, // 新增：产品编码，用于唯一标识
    dwgPath: string, 
    x: number, 
    y: number, 
    zoomHeight: number = 500
) {
    // --- 1. 配置脚本存放路径 ---
    const scriptDir = "D:/cad_scripts"; 
    if (!fs.existsSync(scriptDir)) {
        fs.mkdirSync(scriptDir, { recursive: true });
    }

    // 使用产品编码拼接文件名，确保唯一性
    const lispPath = path.join(scriptDir, `logic_${materialCode}.lsp`).replace(/\\/g, '/');
    const scrPath = path.join(scriptDir, `boot_${materialCode}.scr`).replace(/\\/g, '/');

    // --- 2. 检查脚本是否已存在 ---
    if (!fs.existsSync(lispPath) || !fs.existsSync(scrPath)) {
        console.log(`[系统] 正在为产品 ${materialCode} 生成新的定位脚本...`);
        
        const lispContent = [
            '(vl-load-com)',
            '(defun c:smart_zoom (/ old_os)',
            '  (setvar "CMDECHO" 0)',
            '  (command "_.DELAY" 5000)',          // 5秒延时避开启动高峰
            '  (setq old_os (getvar "OSMODE"))',
            '  (setvar "OSMODE" 0)',
            '  (if (vl-cmdf "._UCS" "_W") (princ "\\n[UCS OK]"))',
            `  (if (vl-cmdf "._ZOOM" "_C" (list ${x} ${y} 0) "${zoomHeight}")`,
            `    (princ "\\n[定位成功] 产品: ${materialCode}")`,
            '    (princ "\\n[错误] vl-cmdf 执行失败")',
            '  )',
            '  (setvar "OSMODE" old_os)',
            '  (princ)',
            ')',
            '(c:smart_zoom)',
            '(princ)'
        ].join('\r\n');

        try {
            // 写入 Lisp (GBK编码)
            fs.writeFileSync(lispPath, iconv.encode(lispContent, 'gbk'));
            // 写入 SCR 脚本
            const scrContent = [`(load "${lispPath}")`, ' '].join('\r\n');
            fs.writeFileSync(scrPath, iconv.encode(scrContent, 'gbk'));
        } catch (err) {
            console.error(`[错误] 无法生成脚本文件: ${err}`);
            return;
        }
    } else {
        console.log(`[系统] 检测到已有脚本，正在直接调用产品 ${materialCode} 的定位逻辑...`);
    }

    // --- 3. 启动中望 CAD ---
    const zwcadStart = `D:\\CAD2026中望\\Zwcadm\\ZwcadmStart.exe`;

    try {
        const child = spawn(zwcadStart, [
            `"${dwgPath}"`, 
            '/nologo', 
            '/b', 
            `"${scrPath}"`
        ], { 
            detached: true, 
            stdio: 'ignore',
            shell: true 
        });

        child.unref();
    } catch (err) {
        console.error(`[错误] CAD 启动失败: ${err}`);
    }
}

export async function fixedCadLocate(x: number, y: number, zoomHeight: number = 500) {
    // 1. 预校验坐标
    if (isNaN(x) || isNaN(y)) return console.error("坐标数值无效");

    // 2. 构造 PowerShell 指令字符串 (去除中文注释，防止编码干扰)
    // 使用 [char]27 代表 ESC 键
    const psCommands = [
        `$ErrorActionPreference = 'Stop'`,
        `try {`,
        `  $cad = [Runtime.InteropServices.Marshal]::GetActiveObject('ZWCAD.Application')`,
        `  $esc = [char]27`,
        `  $cmd = "$esc$esc._UCS _W ._ZOOM _C ${x},${y} ${zoomHeight} "`,
        `  $cad.ActiveDocument.SendCommand($cmd)`,
        `  Write-Host 'Success'`,
        `} catch {`,
        `  exit 1`,
        `}`
    ].join('; ');

    // 3. 将指令转换为 Base64 (这是处理 PowerShell 字符编码最稳健的工业方法)
    const buffer = Buffer.from(psCommands, 'utf16le');
    const base64Str = buffer.toString('base64');

    // 4. 执行 (使用 -EncodedCommand 避开所有引号乱码问题)
    const fullCommand = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${base64Str}`;

    exec(fullCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`[定位失败]: 请确认中望CAD已打开，且 ProgID 为 'ZWCAD.Application'`);
            console.log("提示：如果CAD版本较新，请尝试将代码中的 ZWCAD.Application 改为 ZWCAD.Application.26");
        } else {
            console.log(`[成功]: 已通过 COM 接口发送跳转指令 (${x}, ${y})`);
        }
    });
}

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