import { Elysia, t } from 'elysia';
import { drawingSql } from './db'; // 确保引入了数据库操作对象

const PORT = 3003;

/**
 * 创建并启动服务
 */
export const startCadServer = () => {
    const app = new Elysia()
        .post('/upload', ({ body }) => {
            const { materialCode, drawingNumber, fileName, filePath, x, y } = body;

            console.log(`\n--- 收到来自中望CAD的物料提取 ---`);
            console.log(`编码: ${materialCode} | 图号: ${drawingNumber}`);
            console.log(`文件: ${fileName} | 坐标: (${x}, ${y})`);
            console.log(`文件路径: ${filePath}`);

            try {
                // 执行数据库插入操作
                // 对应字段顺序：materialCode, dwg, volume, pressure, filePath, fileName, x, y
                const newRecord = drawingSql.insert.get(
                    materialCode,
                    drawingNumber,
                    filePath,
                    fileName,
                    x,
                    y,
                    "" // 备注字段暂时留空
                );

                console.log(`[数据库] 插入成功，ID: ${newRecord.id}`);

                return { 
                    status: 'success', 
                    message: 'Data saved to database', 
                    data: newRecord 
                };
            } catch (error) {
                console.error(`[数据库] 插入失败:`, error);
                return { 
                    status: 'error', 
                    message: 'Failed to save data to database' 
                };
            }
        }, {
            // 使用 Elysia 的强类型校验
            body: t.Object({
                materialCode: t.String(),
                drawingNumber: t.String(),
                fileName: t.String(),
                filePath: t.String(),
                x: t.Number(),
                y: t.Number()
            })
        })
        .listen(PORT);

    console.log(`[Electrobun] CAD 协作服务已在 http://localhost:${PORT} 启动`);
};