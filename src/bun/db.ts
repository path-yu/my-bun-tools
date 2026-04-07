import Database from "bun:sqlite";
import { join } from "path";
import { Utils } from "electrobun/bun";
import { resolve, isAbsolute } from "path";
import { existsSync } from "fs";
// --- 1. 类型定义 ---
export type Drawing = {
  id?: number;
  materialCode: string;
  drawingNumber: string;
  filePath: string;
  fileName: string;
  created_at?: string;
  x?: number;
  y?: number;
  remarks?: string;
};

// --- 2. 数据库句柄持有者 ---
// 初始指向默认路径
let _db: Database = new Database(join(Utils.paths.userData, "drawings.db"), { create: true });

// --- 3. 初始化与切换逻辑 ---
export const initializeDb = (customPath?: string) => {
  // 1. 确保拿到的是绝对路径
  let targetPath: string;
  
  if (customPath) {
    // 如果是相对路径，强行基于当前执行目录转为绝对路径
    targetPath = isAbsolute(customPath) ? customPath : resolve(process.cwd(), customPath);
  } else {
    targetPath = join(Utils.paths.userData, "drawings.db");
  }

  try {
    if (_db) _db.close();
    
    // 2. 在连接前检查一下
    const fileExists = existsSync(targetPath);
    _db = new Database(targetPath, { create: true });
    
    console.log(`[DB] 成功连接!`);
    console.log(`[DB] 物理路径: ${_db.filename}`); // 这是 SQLite 真正打开的文件地址

    if (!fileExists) {
      console.warn("注意：指定路径的文件不存在，SQLite 已创建新空库。");
    }

    // 3. 执行初始化
    _db.exec(`
      CREATE TABLE IF NOT EXISTS drawings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        materialCode TEXT UNIQUE,
        drawingNumber TEXT,
        filePath TEXT,
        fileName TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        x REAL,
        y REAL,
        remarks TEXT
      );
    `);

    // 4. 关键：立即检查一次数量
    const count = _db.prepare("SELECT COUNT(*) as c FROM drawings").get() as {c: number};
    if (count.c > 0) {
      console.log(`[DB] 数据验证通过，当前记录数: ${count.c}`);
    } else {
      console.log(`[DB] 警告：当前数据库是一张白纸（0条记录）。`);
    }

  } catch (err) {
    console.error('[DB] 初始化流程崩溃:', err);
  }
};

// --- 4. 动态 SQL 操作方法 ---
// 重点：不再使用 export const sql = _db.prepare(...)
// 而是通过函数实时 prepare，规避闭包问题
export const drawingSql = {
 getAll: (): Drawing[] => {
  const count = _db.prepare(`SELECT COUNT(*) as c FROM drawings`).get() as {c: number};
  console.log(`[检查] 当前数据库路径: ${_db.filename}`); 
  console.log(`[检查] 数据库内记录总数: ${count.c}`);
  return _db.prepare(`SELECT * FROM drawings ORDER BY id DESC`).all() as Drawing[];
},

  search: (keyword: string): Drawing[] => {
    const safeKey = `%${keyword}%`;
    return _db.prepare(`
      SELECT * FROM drawings 
      WHERE materialCode LIKE ? OR drawingNumber LIKE ? OR remarks LIKE ?
      ORDER BY id DESC
    `).all(safeKey, safeKey, safeKey) as Drawing[];
  },

  upsert: (item: Drawing) => {
    return _db.prepare(`
      INSERT INTO drawings (materialCode, drawingNumber, filePath, fileName, x, y, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(materialCode) DO UPDATE SET
        x = excluded.x,
        y = excluded.y,
        drawingNumber = CASE WHEN excluded.drawingNumber != '' THEN excluded.drawingNumber ELSE drawings.drawingNumber END,
        filePath = CASE WHEN excluded.filePath != '' THEN excluded.filePath ELSE drawings.filePath END,
        remarks = CASE WHEN excluded.remarks != '' THEN excluded.remarks ELSE drawings.remarks END,
        created_at = datetime('now')
      RETURNING *
    `).get(
      item.materialCode,
      item.drawingNumber || "",
      item.filePath || "",
      item.fileName || "",
      item.x || 0,
      item.y || 0,
      item.remarks || ""
    ) as Drawing;
  },

  delete: (id:number) => {
    return _db.prepare(`DELETE FROM drawings WHERE id = ?`).run(id);
  },
 // ✅ 正确的代码：需要更新所有业务字段
update: (item: Drawing) => {
  return _db.prepare(`
    UPDATE drawings 
    SET materialCode = ?, drawingNumber = ?, filePath = ?, fileName = ?, x = ?, y = ?, remarks = ?
    WHERE id = ?
  `).run(
    item.materialCode,
    item.drawingNumber,
    item.filePath,
    item.fileName,
    item.x || 0,
    item.y || 0,
    item.remarks || "",
    item.id || 0
  );
},
  // 批量事务处理
  batchInsert: (filePath: string, data: any[]) => {
    const tx = _db.transaction((items) => {
      for (const item of items) {
        drawingSql.upsert({
          materialCode: item.materialCode,
          drawingNumber: item.drawingNumber,
          filePath: filePath,
          fileName: item.fileName || "",
          x: parseFloat(item.x),
          y: parseFloat(item.y),
          remarks: ""
        });
      }
      return items.length;
    });
    return tx(data);
  }
};

// 启动执行一次初始化
initializeDb();