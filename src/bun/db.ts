import Database from "bun:sqlite";
import { join } from "path";
import { Utils } from "electrobun/bun";

export const db = new Database(join(Utils.paths.userData, "drawings.db"), {
  create: true,
});

export type Drawing = {
  id?: number;
  materialCode: string;
  drawingNumber: string;
  filePath: string;
  created_at: string;
  // 文件名
  fileName: string;
  x?: number; // 可选，CAD 发送的数据里可能没这个
  y?: number; // 可选，CAD 发送的数据里可能没这个
  // 备注
  remarks?: string;
};

// 修改后的建表语句，给 materialCode 增加 UNIQUE 约束
db.exec(`
CREATE TABLE IF NOT EXISTS drawings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  materialCode TEXT UNIQUE, -- 重点：这里必须是 UNIQUE
  drawingNumber TEXT,
  filePath TEXT,
  fileName TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  x REAL,
  y REAL,
  remarks TEXT
)
`);

function stmt<T>(sql: string) {
  const s = db.prepare(sql);
  return {
    all: (...args: any[]) => s.all(...args) as T[],
    get: (...args: any[]) => s.get(...args) as T,
    run: (...args: any[]) => s.run(...args),
  };
}

export const drawingSql = {
  getAll: stmt<Drawing>(`
    SELECT * FROM drawings ORDER BY id DESC
  `),

  // 核心方法：存在冲突（materialCode 已存在）时更新坐标和备注
  upsert: stmt<Drawing>(`
    INSERT INTO drawings (materialCode, drawingNumber, filePath, fileName, x, y, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(materialCode) DO UPDATE SET
      x = excluded.x,
      y = excluded.y,
      remarks = CASE WHEN excluded.remarks != '' THEN excluded.remarks ELSE drawings.remarks END,
      drawingNumber = excluded.drawingNumber,
      filePath = excluded.filePath,
      fileName = excluded.fileName
    RETURNING *
  `),

  // 根据物料编码查询单个记录
  getByCode: stmt<Drawing>(`
    SELECT * FROM drawings WHERE materialCode = ?
  `),

  insert: stmt<Drawing>(`
    INSERT INTO drawings (materialCode, drawingNumber, filePath, fileName, x, y, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `),

  update: stmt<Drawing>(`
    UPDATE drawings 
    SET materialCode=?, drawingNumber=?, filePath=?, fileName=?, x=?, y=?, remarks=?
    WHERE id=?
    RETURNING *
  `),

  delete: stmt<any>(`
    DELETE FROM drawings WHERE id=?
  `),
};
