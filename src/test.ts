import * as XLSX from "xlsx";
import { writeFileSync } from "fs";
import * as fs from "node:fs/promises";


const src =
  "C:\\Users\\19746\\Desktop\\TestShare\\my-cli\\碳钢固规非标罐新标准.dwg";

const dest =
  "C:\\Users\\19746\\Desktop\\TestShare\\my-cli\\test\\碳钢固规非标罐新标准.dwg";

await fs.copyFile(src, dest);

console.log("复制成功");
/**
 * 核心逻辑：解析冯工提供的业务规则
 * YQG=氧气罐, CQG=储气罐, BCQG=不锈钢, 数字/数字=容积/压力
 */
function parseSpecLogic(name: string, spec: string) {
  let material = "碳钢";
  let category = "标准储气罐";
  let notice = "执行标准压力容器制造工艺。";

  if (name.includes("BCQG")) {
    material = "不锈钢";
    category = "不锈钢储气罐";
    notice = "核心注意：必须选用不锈钢配套附件，严禁混入碳钢件。";
  } else if (name.includes("YQG")) {
    material = "碳钢 (脱脂)";
    category = "氧气罐";
    notice = "核心注意：氧气专用，BOM需包含脱脂工序，附件须禁油。";
  }

  // 提取 5/0.6 这种格式
  const match = spec.match(/(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)/);
  const vol = match ? match[1] : "非标";
  const pres = match ? match[2] : "非标";

  return { material, category, vol, pres, notice };
}

async function convertBOM() {
  // 1. 加载文件
  const workbook = XLSX.readFile(
    "C:\\Users\\19746\\Downloads\\物料清单20260508205210.xlsx",
  );
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // 2. 转换为 JSON 对象数组 (直接获取每一行的数据)
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

  // 3. 按父项产品编号分组
  // 注意：xlsx 默认会将第一行作为 key，请确保 Excel 第一行标题与下面匹配
  const groups = new Map<string, any[]>();
  rows.forEach((row) => {
    const pCode = row["父项产品编号"]?.toString().trim();
    if (!pCode) return;
    if (!groups.has(pCode)) groups.set(pCode, []);
    groups.get(pCode)?.push(row);
  });

  const trainingData: any[] = [];

  for (const [pCode, items] of groups) {
    const main = items[0];
    const logic = parseSpecLogic(main["父项产品名称"], main["父项产品规格"]);

    // --- 模式 1：深度逻辑问答 ---
    trainingData.push({
      instruction: `分析产品 ${main["父项产品名称"]} (${pCode}) 的规格并生成BOM清单。`,
      input: `产品规格: ${main["父项产品规格"]}`,
      output: `【技术解析】：\n- 类型：${logic.category}\n- 材质：${logic.material}\n- 参数：容积 ${logic.vol}m³ / 设计压力 ${logic.pres}MPa。\n- 备注：${main["备注"]}\n\n【BOM清单】：\n${items
        .map(
          (i) =>
            `- ${i["子项产品名称"]} [${i["子项产品编号"]}] | 规格:${i["子项产品规格"]} | 用量:${i["单位用量"]}${i["子项单位"]}`,
        )
        .join("\n")}`,
    });

    // --- 模式 2：压力预警逻辑 ---
    if (logic.pres !== "非标") {
      const warningPres = (parseFloat(logic.pres) + 0.2).toFixed(1);
      trainingData.push({
        instruction: `对于型号 ${main["父项产品规格"]}，如果实际工作压力波动到 ${warningPres}MPa 会有风险吗？`,
        output: `有风险。该产品设计压力仅为 ${logic.pres}MPa。虽然受压元件有安全系数，但长期在 ${warningPres}MPa 下运行不符合压力容器安全规范。建议核查BOM中的安全阀开启压力设置，并确认法兰等级是否需要从 PN1.6 升级。`,
      });
    }

    // --- 模式 3：子项反查记忆 ---
    const randomItem = items[Math.floor(Math.random() * items.length)];
    trainingData.push({
      instruction: `在生产 ${main["父项产品规格"]} 时，所需的“${randomItem["子项产品名称"]}”对应 U8 编码是什么？`,
      output: `该产品的“${randomItem["子项产品名称"]} (${randomItem["子项产品规格"]})”对应的物料编码为：${randomItem["子项产品编号"]}。`,
    });
  }

  // 4. 保存为 LLaMA-Factory 格式
  writeFileSync(
    "my_bom_data.json",
    JSON.stringify(trainingData, null, 2),
    "utf-8",
  );
  console.log(`✨ 成功！已使用 xlsx 库处理 ${groups.size} 个父项产品。`);
}

// convertBOM().catch(console.error);
