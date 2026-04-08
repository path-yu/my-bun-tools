import Database from "bun:sqlite";
import { Utils } from "electrobun/bun";
import { join, resolve, isAbsolute } from "path";
 import fs from "fs";
import { Drawing } from "@/lib/types";
// --- 1. 类型定义 ---

// --- 2. 安全数据库实例 ---
let _db: Database | null = null;

// --- 3. 初始化 / 切换数据库 ---
export const  initializeDb = async (customPath?: string) => {
  try {
    // 关闭旧连接（防止句柄泄漏）
    if (_db) {
      _db.close();
      _db = null;
    }

    // 路径统一处理
    let targetPath: string;
    if (customPath) {
      targetPath = isAbsolute(customPath) 
        ? customPath 
        : resolve(process.cwd(), customPath);
    } else {
      targetPath = join(Utils.paths.userData, "drawings.db");
    }

    // ✅ Electrobun 正确判断文件是否存在
    const fileExists =  await fs.existsSync(targetPath);

    // 打开数据库
    _db = new Database(targetPath, { create: true });

    console.log(`[DB] 连接成功：${_db.filename}`);
    if (!fileExists) console.log(`[DB] 新建空数据库`);

    // 创建表
    _db.exec(`
      CREATE TABLE IF NOT EXISTS drawings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        materialCode TEXT UNIQUE,
        drawingNumber TEXT,
        filePath TEXT,
        fileName TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        x REAL DEFAULT 0,
        y REAL DEFAULT 0,
        remarks TEXT
      );
    `);

    // 计数验证
    const count = _db.prepare("SELECT COUNT(*) as c FROM drawings").get() as { c: number };
    console.log(`[DB] 当前记录数：${count.c}`);

  } catch (err) {
    console.error("[DB] 初始化失败", err);
    _db = null;
  }
};

// --- 4. 安全 SQL 工具 ---
const getDb = (): Database => {
  if (!_db) throw new Error("数据库未初始化");
  return _db;
};

export const drawingSql = {
  getAll: (): Drawing[] => {
    const db = getDb();
    return db.prepare(`SELECT * FROM drawings ORDER BY id DESC`).all() as Drawing[];
  },

  search: (keyword: string): Drawing[] => {
    const db = getDb();
    const key = `%${keyword}%`;
    return db.prepare(`
      SELECT * FROM drawings 
      WHERE materialCode LIKE ? OR drawingNumber LIKE ? OR remarks LIKE ?
      ORDER BY id DESC
    `).all(key, key, key) as Drawing[];
  },

  // 插入或更新（安全不空值覆盖）
  upsert: (item: Drawing) => {
    const db = getDb();
    return db.prepare(`
      INSERT INTO drawings (materialCode, drawingNumber, filePath, fileName, x, y, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(materialCode) DO UPDATE SET
        drawingNumber = COALESCE(excluded.drawingNumber, drawings.drawingNumber),
        filePath      = COALESCE(excluded.filePath, drawings.filePath),
        fileName      = COALESCE(excluded.fileName, drawings.fileName),
        x             = COALESCE(excluded.x, drawings.x),
        y             = COALESCE(excluded.y, drawings.y),
        remarks       = COALESCE(excluded.remarks, drawings.remarks),
        created_at    = datetime('now')
      RETURNING *
    `).get(
      item.materialCode,
      item.drawingNumber || null,
      item.filePath || null,
      item.fileName || null,
      item.x ?? 0,
      item.y ?? 0,
      item.remarks || null
    ) as Drawing;
  },

  // 更新（安全不空值覆盖）
  update: (item: Drawing) => {
    const db = getDb();
    return db.prepare(`
      UPDATE drawings 
      SET 
        materialCode  = ?,
        drawingNumber = COALESCE(?, drawingNumber),
        filePath      = COALESCE(?, filePath),
        fileName      = COALESCE(?, fileName),
        x             = COALESCE(?, x),
        y             = COALESCE(?, y),
        remarks       = COALESCE(?, remarks)
      WHERE id = ?
    `).run(
      item.materialCode,
      item.drawingNumber || null,
      item.filePath || null,
      item.fileName || null,
      item.x ?? null,
      item.y ?? null,
      item.remarks || null,
      item.id || 0
    );
  },

  delete: (id: number) => {
    const db = getDb();
    return db.prepare(`DELETE FROM drawings WHERE id = ?`).run(id);
  },

  // 批量事务（安全）
  batchInsert: (baseFilePath: string, items: Partial<Drawing>[]) => {
    const db = getDb();
    const tx = db.transaction((list) => {
      let count = 0;
      for (const it of list) {
        if (!it.materialCode) continue;
        drawingSql.upsert({
          materialCode: it.materialCode,
          drawingNumber: it.drawingNumber || "",
          filePath: baseFilePath,
          fileName: it.fileName || "",
          x: it.x ?? 0,
          y: it.y ?? 0,
          remarks: it.remarks || "",
        });
        count++;
      }
      return count;
    });
    return tx(items);
  }
};

// 初始化
initializeDb();