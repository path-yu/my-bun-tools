import { BrowserView, Utils, type RPCSchema } from "electrobun/bun";
import { drawingSql, initializeDb } from "./db";
import {
  fixedCadLocate,
  professionalCadNavigate,
  getZwCadFiles,
  closeZwCadDocument,
  parseDwgPath,
} from "./autoOpen";
import { CadBrand, Drawing, CAD_MAP, FileInfo, SyncLog } from "../lib/types";
import {
  rollingChecksum,
  strongChecksum,
  type ChunkChecksum,
} from "./checksum-utils";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { watch, type FSWatcher } from "node:fs";
import { omitFileChange } from ".";
import * as os from "os";

export type DrawingRPC = {
  bun: RPCSchema<{
    requests: {
      getAll: {
        params: {};
        response: Drawing[];
      };
      add: {
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
          materialCode: string;
          dwgPath: string;
          x: number;
          y: number;
          zoomHeight?: number;
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
        response: {
          success: boolean;
          path?: string;
          error?: string;
          canceled?: boolean;
        };
      };
      selectDirectory: {
        params: {};
        response: {
          success: boolean;
          path?: string;
          error?: string;
          canceled?: boolean;
        };
      };
      listDirectory: {
        params: {
          path: string;
          sourcePath?: string;
        };
        response: {
          success: boolean;
          files?: FileInfo[];
          error?: string;
        };
      };
      selectSourceDirectory: {
        params: {};
        response: {
          success: boolean;
          path?: string;
          error?: string;
          canceled?: boolean;
        };
      };
      selectLocalDirectory: {
        params: {};
        response: {
          success: boolean;
          path?: string;
          error?: string;
          canceled?: boolean;
        };
      };
      updateFromSource: {
        params: {
          sourcePath: string;
          localPath: string;
          fileName: string;
          brandKey: CadBrand;
          logData?: any;
        };
        response: {
          success: boolean;
          error?: string;
          copied?: boolean;
          reason?: string;
        };
      };
      syncToSource: {
        params: {
          sourcePath: string;
          localPath: string;
          fileName: string;
          brandKey: CadBrand;
          logData?: any;
        };
        response: {
          success: boolean;
          error?: string;
          copied?: boolean;
          reason?: string;
        };
      };
      saveSyncLog: {
        params: any;
        response: { success: boolean; error?: string };
      };
      getSyncLogs: {
        params: { sourcePath?: string };
        response: { success: boolean; logs?: any[]; error?: string };
      };
      cloneDirectory: {
        params: {
          sourcePath: string;
          localPath: string;
          allowedExtensions: string[];
        };
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
      startWatchingDirectory: {
        params: {
          sourcePath: string;
          localPath: string;
        };
        response: { success: boolean; error?: string };
      };
      stopWatchingDirectory: {
        params: { sourcePath: string };
        response: { success: boolean };
      };
    };
  }>;
  webview: RPCSchema<{
    requests: {
      fileChange: {
        params: { fileName: string };
        response: void;
      };
    };
    messages: {};
  }>;
};

interface WatcherInfo {
  watcher: FSWatcher;
  localPath: string;
}

const activeWatchers: Map<string, WatcherInfo> = new Map();

// 获取日志文件路径（位于源目录的 .cad-cli/log.json）
async function getLogFilePath(sourcePath?: string): Promise<string> {
  const logDir = sourcePath ? path.join(sourcePath, ".cad-cli") : path.join(os.homedir(), ".cad-cli");
  await fs.mkdir(logDir, { recursive: true });
  const logFilePath = path.join(logDir, "log.json");

  // 确保日志文件存在，如果不存在则创建空的
  try {
    await fs.access(logFilePath);
  } catch {
    await fs.writeFile(logFilePath, "[]", "utf-8");
  }

  return logFilePath;
}

// 读取日志
async function readLogs(sourcePath?: string): Promise<SyncLog[]> {
  try {
    const logFilePath = await getLogFilePath(sourcePath);
    const content = await fs.readFile(logFilePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    // 文件不存在或解析失败，返回空数组
    return [];
  }
}

// 保存日志
async function saveLog(logData: Omit<SyncLog, "id" | "createdAt" | "createdBy">): Promise<boolean> {
  try {
    const log: SyncLog = {
      id: crypto.randomUUID(),
      ...logData,
      createdAt: new Date().toISOString(),
      createdBy: os.userInfo().username,
    };

    const logs = await readLogs(logData.sourcePath);
    logs.unshift(log); // 新日志加在前面

    const logFilePath = await getLogFilePath(logData.sourcePath);
    await fs.writeFile(logFilePath, JSON.stringify(logs, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("保存日志失败:", err);
    return false;
  }
}

async function cloneDirectoryRecursive(
  _fs: typeof import("node:fs/promises"),
  _path: typeof import("node:path"),
  sourcePath: string,
  localPath: string,
  allowedExtensions?: string[],
) {
  await fs.mkdir(localPath, { recursive: true });
  const entries = await fs.readdir(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(sourcePath, entry.name);
    const destPath = path.join(localPath, entry.name);

    if (entry.isDirectory()) {
      await cloneDirectoryRecursive(
        _fs,
        _path,
        srcPath,
        destPath,
        allowedExtensions,
      );
    } else {
      const ext = entry.name.split(".").pop()?.toLowerCase() || "";
      const isAllowed =
        !allowedExtensions ||
        allowedExtensions.length === 0 ||
        allowedExtensions.includes(ext);
      if (isAllowed) {
        await smartCopyFile(srcPath, destPath);
      }
    }
  }
}

export async function computeChunkChecksums(
  filePath: string,
  chunkSize: number,
): Promise<ChunkChecksum[]> {
  const fileHandle = await fs.open(filePath, "r");
  const checksums: ChunkChecksum[] = [];
  let index = 0;
  const buffer = Buffer.alloc(chunkSize);

  try {
    let result = await fileHandle.read(buffer, 0, chunkSize);
    while (result.bytesRead > 0) {
      const chunk =
        result.bytesRead === chunkSize
          ? buffer
          : buffer.slice(0, result.bytesRead);
      checksums.push({
        index,
        weak: rollingChecksum(chunk),
        strong: strongChecksum(chunk),
      });
      index++;
      result = await fileHandle.read(buffer, 0, chunkSize);
    }
  } finally {
    await fileHandle.close();
  }

  return checksums;
}

interface DiffBlock {
  offset: number;
  data: Buffer;
}

export async function findChangedBlocks(
  srcPath: string,
  destChecksums: import("./checksum-utils").ChunkChecksum[],
  chunkSize: number,
): Promise<DiffBlock[]> {
  const srcHandle = await fs.open(srcPath, "r");
  const diffBlocks: DiffBlock[] = [];
  let index = 0;
  const buffer = Buffer.alloc(chunkSize);

  try {
    let { bytesRead } = await srcHandle.read(buffer, 0, chunkSize, null);

    while (bytesRead > 0) {
      const chunk =
        bytesRead === chunkSize ? buffer : buffer.subarray(0, bytesRead);

      const weak = rollingChecksum(chunk);
      const strong = strongChecksum(chunk);

      const destChunk = destChecksums[index];

      if (
        !destChunk ||
        destChunk.weak !== weak ||
        destChunk.strong !== strong
      ) {
        diffBlocks.push({
          offset: index * chunkSize,
          data: Buffer.from(chunk),
        });
      }

      index++;
      const nextRead = await srcHandle.read(buffer, 0, chunkSize, null);
      bytesRead = nextRead.bytesRead;
    }
  } finally {
    await srcHandle.close();
  }

  return diffBlocks;
}

async function incrementalCopy(
  src: string,
  dest: string,
): Promise<{ copied: boolean; reason: string; bytesWritten: number }> {
  const CHUNK_SIZE = 64 * 1024;

  try {
    const srcStat = await fs.stat(src);
    let destStat: Awaited<ReturnType<typeof fs.stat>> | null = null;

    try {
      destStat = await fs.stat(dest);
    } catch {
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(src, dest);
      return {
        copied: true,
        reason: "目标文件不存在，完整复制",
        bytesWritten: srcStat.size,
      };
    }

    if (srcStat.size === destStat.size && srcStat.mtimeMs <= destStat.mtimeMs) {
      return { copied: false, reason: "目标文件已是最新", bytesWritten: 0 };
    }

    if (srcStat.size === destStat.size) {
      const srcContent = await fs.readFile(src);
      const destContent = await fs.readFile(dest);
      if (Buffer.compare(srcContent, destContent) === 0) {
        await fs.utimes(dest, srcStat.atime, srcStat.mtime);
        return {
          copied: false,
          reason: "文件内容相同，仅更新时间",
          bytesWritten: 0,
        };
      }
    }

    if (srcStat.size <= CHUNK_SIZE || destStat.size !== srcStat.size) {
      await fs.copyFile(src, dest);
      return {
        copied: true,
        reason: "文件较小或大小变化，完整复制",
        bytesWritten: srcStat.size,
      };
    }

    const destChecksums = await computeChunkChecksums(dest, CHUNK_SIZE);
    const changedBlocks = await findChangedBlocks(
      src,
      destChecksums,
      CHUNK_SIZE,
    );

    if (changedBlocks.length === 0) {
      await fs.utimes(dest, srcStat.atime, srcStat.mtime);
      return {
        copied: false,
        reason: "所有块都相同，仅更新时间",
        bytesWritten: 0,
      };
    }

    const destHandle = await fs.open(dest, "r+");
    let totalWritten = 0;
    try {
      for (const block of changedBlocks) {
        await destHandle.write(block.data, 0, block.data.length, block.offset);
        totalWritten += block.data.length;
      }
    } finally {
      await destHandle.close();
    }

    await fs.utimes(dest, srcStat.atime, srcStat.mtime);
    const efficiency = (
      ((srcStat.size - totalWritten) / srcStat.size) *
      100
    ).toFixed(1);
    return {
      copied: true,
      reason: `增量更新完成，跳过 ${efficiency}% 数据`,
      bytesWritten: totalWritten,
    };
  } catch (error) {
    throw new Error(
      `增量复制失败: ${error instanceof Error ? error.message : "未知错误"}`,
    );
  }
}

async function smartCopyFile(
  src: string,
  dest: string,
): Promise<{ copied: boolean; reason: string }> {
  const result = await incrementalCopy(src, dest);
  return { copied: result.copied, reason: result.reason };
}

async function syncDirectoryRecursive(
  _fs: typeof import("node:fs/promises"),
  _path: typeof import("node:path"),
  sourcePath: string,
  localPath: string,
) {
  await fs.mkdir(localPath, { recursive: true });
  const entries = await fs.readdir(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(sourcePath, entry.name);
    const destPath = path.join(localPath, entry.name);

    if (entry.isDirectory()) {
      await syncDirectoryRecursive(_fs, _path, srcPath, destPath);
    } else {
      await smartCopyFile(srcPath, destPath);
    }
  }
}
export const drawingRPC = BrowserView.defineRPC<DrawingRPC>({
  maxRequestTime: 6000,
  handlers: {
    requests: {
      getAll: () => {
        const data = drawingSql.getAll();
        return data;
      },
      add: (data) => {
        try {
          return drawingSql.upsert({
            materialCode: data.materialCode || "",
            drawingNumber: data.drawingNumber || "",
            filePath: data.filePath || "",
            fileName: data.fileName || "",
            x: data.x ?? 0,
            y: data.y ?? 0,
            remarks: data.remarks || "",
          });
        } catch (err) {
          console.error("数据库操作失败:", err);
          throw err;
        }
      },
      update: (data) => {
        try {
          console.log("正在更新 ID:", data.id);
          drawingSql.update({
            id: data.id!,
            materialCode: data.materialCode,
            drawingNumber: data.drawingNumber,
            filePath: data.filePath,
            fileName: data.fileName,
            x: data.x,
            y: data.y,
            remarks: data.remarks,
          });
          return data;
        } catch (err) {
          console.error("更新失败:", err);
          throw err;
        }
      },
      delete: ({ id }) => {
        drawingSql.delete(id);
        return { success: true };
      },
      selectDatabaseFile: async () => {
        try {
          const result = await Utils.openFileDialog({
            canChooseFiles: true,
            canChooseDirectory: false,
            allowsMultipleSelection: true,
          });
          console.log("文件选择结果:", result);
          if (!result || result.length === 0) {
            return { success: false, canceled: true };
          }
          return { success: true, path: result[0] };
        } catch (error) {
          return { success: false, error: "无法打开文件选择框" };
        }
      },
      selectDatabase: ({ path: dbPath }) => {
        try {
          initializeDb(dbPath);
          return { success: true };
        } catch (error) {
          console.error("数据库路径切换失败:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      selectDirectory: async () => {
        try {
          const result = await Utils.openFileDialog({
            canChooseFiles: false,
            canChooseDirectory: true,
            allowsMultipleSelection: false,
          });
          if (!result || result.length === 0) {
            return { success: false, canceled: true };
          }
          return { success: true, path: result[0] };
        } catch (error) {
          return { success: false, error: "无法打开目录选择框" };
        }
      },
      listDirectory: async ({ path: dirPath, sourcePath }) => {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          const files: FileInfo[] = await Promise.all(
            entries.map(async (entry) => {
              const fullPath = path.join(dirPath, entry.name);
              let stats: any;
              try {
                stats = await fs.stat(fullPath);
              } catch {
                stats = {
                  size: 0,
                  birthtime: new Date(),
                  mtime: new Date(),
                  mode: 0,
                };
              }

              let syncStatus:
                | "synced"
                | "modified"
                | "new"
                | "deleted"
                | "unknown" = "unknown";
              let sourceModifiedAt: string | undefined;

              if (!entry.isDirectory() && sourcePath) {
                const sourceFilePath = path.join(sourcePath, entry.name);
                try {
                  const sourceStats = await fs.stat(sourceFilePath);
                  sourceModifiedAt = sourceStats.mtime?.toISOString();

                  const timeOk = stats.mtimeMs >= sourceStats.mtimeMs;
                  const sizeOk = stats.size === sourceStats.size;

                  if (timeOk && sizeOk) {
                    syncStatus = "synced";
                  } else {
                    syncStatus = "modified";
                  }
                } catch {
                  syncStatus = "new";
                }
              }

              return {
                name: entry.name,
                path: fullPath,
                isDirectory: entry.isDirectory(),
                size: stats.size || 0,
                createdAt:
                  stats.birthtime?.toISOString() || new Date().toISOString(),
                modifiedAt:
                  stats.mtime?.toISOString() || new Date().toISOString(),
                extension: entry.isDirectory()
                  ? ""
                  : entry.name.split(".").pop() || "",
                isReadOnly: (stats.mode & 0o222) === 0,
                syncStatus,
                sourceModifiedAt,
              };
            }),
          );
          return { success: true, files };
        } catch (error) {
          return { success: false, error: "无法读取目录" };
        }
      },
      selectSourceDirectory: async () => {
        try {
          const result = await Utils.openFileDialog({
            canChooseFiles: false,
            canChooseDirectory: true,
            allowsMultipleSelection: false,
          });
          if (!result || result.length === 0) {
            return { success: false, canceled: true };
          }
          return { success: true, path: result[0] };
        } catch (error) {
          return { success: false, error: "无法打开目录选择框" };
        }
      },
      selectLocalDirectory: async () => {
        try {
          const result = await Utils.openFileDialog({
            canChooseFiles: false,
            canChooseDirectory: true,
            allowsMultipleSelection: false,
          });
          if (!result || result.length === 0) {
            return { success: false, canceled: true };
          }
          return { success: true, path: result[0] };
        } catch (error) {
          return { success: false, error: "无法打开目录选择框" };
        }
      },
      cloneDirectory: async ({ sourcePath, localPath, allowedExtensions }) => {
        try {
          // 确保目标根目录存在
          await fs.mkdir(localPath, { recursive: true });

          const entries = await fs.readdir(sourcePath, { withFileTypes: true });

          for (const entry of entries) {
            const srcPath = path.join(sourcePath, entry.name);
            const destPath = path.join(localPath, entry.name);

            if (entry.isDirectory()) {
              // 如果是子目录，递归调用（注意：确保递归函数也包含同样的占用检查逻辑）
              await cloneDirectoryRecursive(fs, path, srcPath, destPath, allowedExtensions);
            } else {
              // 1. 扩展名过滤
              if (allowedExtensions && allowedExtensions.length > 0) {
                const ext = entry.name.split(".").pop()?.toLowerCase() || "";
                if (!allowedExtensions.includes(ext)) continue;
              }

              // 2. 核心占用检查：尝试打开文件
              let fileHandle;
              try {
                // 尝试以读写权限打开文件。如果文件被 AutoCAD 锁定，这里会抛出 EBUSY
                fileHandle = await fs.open(srcPath, 'r+');
              } catch (err: any) {
                console.warn(`[跳过] 文件正被占用: ${entry.name}`);
                continue; // 关键：跳过当前文件，进入下一次循环
              } finally {
                if (fileHandle) await fileHandle.close(); // 检查完一定要关闭句柄
              }

              // 3. 执行复制（走到这一步说明文件没被锁定）
              try {
                await fs.copyFile(srcPath, destPath);
              } catch (copyErr: any) {
                console.warn(`[跳过] 文件正被占用: ${entry.name}`);
              }
            }
          }
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "克隆目录失败",
          };
        }
      },
      updateFromSource: async ({
        sourcePath,
        localPath,
        fileName,
        brandKey,
        logData,
      }) => {
        try {
          const srcFile = path.join(sourcePath, fileName);
          const destFile = path.join(localPath, fileName);

          await fs.mkdir(localPath, { recursive: true });

          let wasOpen = false;
          let activeBrand: CadBrand | null = null;

          if (brandKey) {
            const openFiles = getZwCadFiles(brandKey);
            const openFile = openFiles.find(
              (f) => f.path === destFile && !f.isReadOnly,
            );
            if (openFile) {
              wasOpen = true;
              activeBrand = brandKey;
              console.log(
                `文件 ${fileName} 在 ${brandKey} 中打开，正在关闭...`,
              );
              // 判断是否为dwg文件
              if (fileName.toLowerCase().endsWith(".dwg")) {
                closeZwCadDocument({
                  fileNameOrPath: destFile,
                  saveChanges: false,
                  cadBrand: brandKey,
                });
              }
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }

          const result = await smartCopyFile(srcFile, destFile);
          // 保存日志
          await saveLog(logData);

          if (wasOpen && activeBrand) {
            if (fileName.toLowerCase().endsWith(".dwg")) {
              Utils.openExternal(destFile);
                await new Promise((resolve) => setTimeout(resolve, 500));
              console.log(
                `重新打开文件 ${fileName} 在 ${CAD_MAP[activeBrand].brandName} 中...`,
              );
            }
          }
          return {
            success: true,
            copied: result.copied,
            reason: result.reason,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "更新文件失败",
          };
        }
      },
      syncToSource: async ({ sourcePath, localPath, fileName, brandKey, logData }) => {
        try {
          const srcFile = path.join(localPath, fileName);
          const destFile = path.join(sourcePath, fileName);

          await fs.mkdir(sourcePath, { recursive: true });

          let wasOpen = false;
          let activeBrand: CadBrand | null = null;
          const openFiles = getZwCadFiles(brandKey);
          const openFile = openFiles.find((f) => f.path === destFile);
          if (openFile) {
            wasOpen = true;
            activeBrand = brandKey;
            //判断是否为自己打开的文件，如果是则直接关闭，否则可能会误伤用户正在编辑的文件
            if (openFile.owner === os.userInfo().username && fileName.toLowerCase().endsWith(".dwg")) {
              closeZwCadDocument({
                fileNameOrPath: destFile,
                saveChanges: false,
                cadBrand: brandKey,
              });
              console.log(
                `文件 ${fileName} 在 ${brandKey} 中打开，正在关闭...`,
              );
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          } else {
          }
          //从共享盘中读取文件的dwl文件,判断是否正在被其他人打开，如果是则不执行覆盖操作，直接返回失败
          let dwgData = parseDwgPath(destFile);
          if (dwgData.isReadOnly) {
            return {
              success: false,
              reason: `文件正在被 ${dwgData.owner} 打开，无法同步到共享盘`,
            };
          }
          const result = await smartCopyFile(srcFile, destFile);
          await saveLog(logData);
          if (wasOpen && activeBrand) {
            if (fileName.toLowerCase().endsWith(".dwg")) {
              Utils.openExternal(destFile);
                await new Promise((resolve) => setTimeout(resolve, 500));
              console.log(
                `重新打开文件 ${fileName} 在 ${CAD_MAP[activeBrand].brandName} 中...`,
              );
            }
          }

          return {
            success: true,
            copied: result.copied,
            reason: result.reason,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "同步文件失败",
          };
        }
      },
      saveSyncLog: async (logData) => {
        try {
          const success = await saveLog(logData);
          return { success };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "保存日志失败",
          };
        }
      },
      getSyncLogs: async ({ sourcePath }) => {
        try {
          const logs = await readLogs(sourcePath);
          return { success: true, logs };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "读取日志失败",
          };
        }
      },
      syncDirectory: async ({ sourcePath, localPath }) => {
        try {
          await fs.mkdir(localPath, { recursive: true });
          const entries = await fs.readdir(sourcePath, { withFileTypes: true });
          let syncCount = 0;

          for (const entry of entries) {
            const srcPath = path.join(sourcePath, entry.name);
            const destPath = path.join(localPath, entry.name);

            if (entry.isDirectory()) {
              await syncDirectoryRecursive(fs, path, srcPath, destPath);
            } else {
              const result = await smartCopyFile(srcPath, destPath);
              if (result.copied) syncCount++;
            }
          }
          return { success: true, syncCount };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "同步目录失败",
          };
        }
      },
      openFile: async ({ filePath }) => {
        try {
          const { spawn } = await import("node:child_process");
          if (process.platform === "win32") {
            spawn("start", ['""', `"${filePath}"`], { shell: true });
          } else {
            spawn("open", [filePath]);
          }
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "打开文件失败",
          };
        }
      },
      locateInCad: ({ cadType, dwgPath, x, y, zoomHeight = 500 }) => {
        return fixedCadLocate(cadType, dwgPath, x, y, zoomHeight);
      },
      professionalCadNavigate: ({
        brand,
        cadPath,
        dwgPath,
        x,
        y,
        zoomHeight = 500,
      }) => {
        return professionalCadNavigate(
          brand,
          cadPath,
          dwgPath,
          x,
          y,
          zoomHeight,
        );
      },
      startWatchingDirectory: async ({ sourcePath, localPath }) => {
        try {
          if (activeWatchers.has(sourcePath)) {
            return { success: true };
          }

          const watcher = watch(
            sourcePath,
            { recursive: true },
            (eventType, filename) => {
              if (filename && typeof filename === "string") {
                // 过滤掉 .dwl 和 .bak 文件
                if (
                  filename.endsWith(".dwl") ||
                  filename.endsWith(".bak") ||
                  filename.endsWith(".tmp") ||
                  filename.startsWith("zwTm")
                ) {
                  return; // 直接忽略
                }

                console.log(`文件 ${filename} 在源目录中 ${eventType}`);
                // 只处理 change 事件
                if (eventType === "change") {
                  console.log(`文件 ${filename} 内容发生变化`);
                  omitFileChange({ fileName: filename });
                }
              }
            },
          );

          watcher.on("error", (error) => {
            console.error(`监听源目录 ${sourcePath} 出错:`, error);
          });

          activeWatchers.set(sourcePath, { watcher, localPath });
          console.log(`开始监听源目录: ${sourcePath}, 本地目录: ${localPath}`);

          return { success: true };
        } catch (error) {
          console.error("启动监听失败:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "启动监听失败",
          };
        }
      },
      stopWatchingDirectory: async ({ sourcePath }) => {
        try {
          const watcherInfo = activeWatchers.get(sourcePath);
          if (watcherInfo) {
            watcherInfo.watcher.close();
            activeWatchers.delete(sourcePath);
            console.log(`停止监听源目录: ${sourcePath}`);
          }
          return { success: true };
        } catch (error) {
          console.error("停止监听失败:", error);
          return { success: false };
        }
      },
    },
  },
});
