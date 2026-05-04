import * as fs from "node:fs/promises";
import * as XLSX from "xlsx";

const filePath = "C:\\Users\\19746\\Downloads\\产品定义20260504101959.xlsx";

async function test() {
  try {
    console.log("开始测试Excel导入...");
    console.log(`文件路径: ${filePath}`);

    const fileBuffer = await fs.readFile(filePath);
    console.log(`文件大小: ${fileBuffer.length} bytes`);

    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    console.log(`工作表数量: ${workbook.SheetNames.length}`);
    console.log(`工作表名称: ${workbook.SheetNames.join(", ")}`);

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // let jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  let jsonData = XLSX.utils.sheet_to_json(worksheet, { header: ["sort","unit", "productName", "processRoute", "productCode", "productSpec", "productAttribute"] });
    console.log(`总行数(含标题): ${jsonData.length}`);
    console.log(`数据行数(不含标题): ${jsonData.length - 1}`);

    if (jsonData.length > 0) {
      console.log("\n第一行(标题行):");
      console.log(JSON.stringify(jsonData[0], null, 2));

      if (jsonData.length > 1) {
        console.log("\n第二行(第一行数据):");
        console.log(JSON.stringify(jsonData[1], null, 2));

        console.log("\n第三行(第二行数据):");
        console.log(JSON.stringify(jsonData[2], null, 2));
      }
    }
  
     jsonData = jsonData.slice(1, jsonData.length - 1);
      console.log(jsonData[0]);
    const products: any[] = [];
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as Record<string, string>;
      products.push({
        unit: row[1] !== undefined ? String(row[1]).trim() : "",
        productName: row[2] !== undefined ? String(row[2]).trim() : "",
        processRoute: row[3] !== undefined ? String(row[3]).trim() : "",
        productCode: row[4] !== undefined ? String(row[4]).trim() : "",
        productSpec: row[5] !== undefined ? String(row[5]).trim() : "",
        productAttribute: row[6] !== undefined ? String(row[6]).trim() : "",
      });
    }

    console.log(`\n解析出的有效数据条数: ${products.length}`);
    console.log("\n前5条数据:");
    // for (let i = 0; i < Math.min(5, products.length); i++) {
    //   console.log(JSON.stringify(products[i], null, 2));
    // }

    // console.log("\n后5条数据:");
    // for (let i = Math.max(0, products.length - 5); i < products.length; i++) {
    //   console.log(JSON.stringify(products[i], null, 2));
    // }

    console.log("\n测试完成!");
  } catch (error) {
    console.error("测试失败:", error);
  }
}

test();