import { Elysia, t } from "elysia";
import { drawingSql } from "./db";

const PORT = 3003;

export const startCadServer = () => {
  const app = new Elysia()
    .post(
      "/uploadDrawings",
      ({ body, set }) => {
        const { filePath, data } = body;
        try {
          const count = drawingSql.batchInsert(filePath, data);
          return { status: "success", count };
        } catch (error) {
          console.error(`[事务失败] 数据已回滚:`, error);

          set.status = 500; // 关键：显式设置 HTTP 状态码为 500

          return {
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Database Transaction failed",
          };
        }
      },
      {
        body: t.Object({
          filePath: t.String(),
          data: t.Array(
            t.Object({
              materialCode: t.String(),
              drawingNumber: t.String(),
              x: t.String(),
              y: t.String(),
            }),
          ),
        }),
      },
    )
    .listen(PORT);
};
