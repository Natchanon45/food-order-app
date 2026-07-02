import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve(import.meta.dirname, "..");
const outputDir = path.join(root, "outputs", "pos-product-import-template");
const publicDir = path.join(root, "public", "assets", "templates");
const outputPath = path.join(outputDir, "pos-product-import-template.xlsx");
const publicPath = path.join(publicDir, "pos-product-import-template.xlsx");

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("นำเข้าสินค้า");
const guide = workbook.worksheets.add("คำแนะนำ");
sheet.showGridLines = false;
guide.showGridLines = false;

sheet.getRange("A1:L1").merge();
sheet.getRange("A1").values = [["แบบฟอร์มนำเข้าสินค้า POS"]];
sheet.getRange("A2:L2").merge();
sheet.getRange("A2").values = [["กรอกข้อมูลตั้งแต่แถวที่ 5 • ห้ามแก้ชื่อหัวคอลัมน์ • ช่องที่มี * จำเป็นต้องกรอก"]];
sheet.getRange("A4:L6").values = [
  ["รหัสสินค้า", "บาร์โค้ด*", "ชื่อสินค้า*", "หมวดหมู่*", "แบรนด์", "ราคาขาย*", "ราคาทุน", "หน่วยนับ*", "สต็อกเริ่มต้น*", "จุดแจ้งเตือน", "แสดงบน POS", "รายละเอียด"],
  ["P000000001", "8850000000001", "น้ำดื่ม 600 มล.", "น้ำดื่ม", "ตัวอย่าง", 10, 6, "ขวด", 24, 5, "ใช่", "ตัวอย่างสินค้า"],
  ["P000000002", "8850000000002", "ขนมตัวอย่าง", "ขนม", "", 20, 12, "ชิ้น", 10, 3, "ไม่", "ลบแถวตัวอย่างได้ก่อนอัปโหลด"]
];

sheet.getRange("A1:L1").format = { fill: "#0B6B3D", font: { bold: true, color: "#FFFFFF", size: 18 }, horizontalAlignment: "center", verticalAlignment: "center" };
sheet.getRange("A2:L2").format = { fill: "#EAF7EE", font: { color: "#28543A", size: 11 }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true };
sheet.getRange("A4:L4").format = { fill: "#159447", font: { bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true, borders: { preset: "outside", style: "thin", color: "#0B6B3D" } };
sheet.getRange("A5:L6").format = { fill: "#FFFFFF", font: { color: "#17211B" }, verticalAlignment: "center", borders: { insideHorizontal: { style: "thin", color: "#DDE8E1" }, bottom: { style: "thin", color: "#DDE8E1" } } };
sheet.getRange("F5:G200").format.numberFormat = "#,##0.00";
sheet.getRange("I5:J200").format.numberFormat = "#,##0";
sheet.getRange("A5:B200").format.numberFormat = "@";
sheet.getRange("K5:K200").dataValidation = { rule: { type: "list", values: ["ใช่", "ไม่"] } };
sheet.freezePanes.freezeRows(4);
sheet.getRange("A1:L6").format.autofitRows();
const widths = [118, 135, 210, 135, 120, 90, 90, 95, 105, 105, 105, 240];
widths.forEach((width, index) => { sheet.getRangeByIndexes(0, index, 200, 1).format.columnWidthPx = width; });
sheet.getRange("A1:L1").format.rowHeightPx = 38;
sheet.getRange("A2:L2").format.rowHeightPx = 34;
sheet.getRange("A4:L4").format.rowHeightPx = 42;

guide.getRange("A1:D1").merge();
guide.getRange("A1").values = [["คำแนะนำการกรอกข้อมูล"]];
guide.getRange("A3:D12").values = [
  ["คอลัมน์", "จำเป็น", "รูปแบบ", "ตัวอย่าง"],
  ["รหัสสินค้า", "ไม่", "เว้นว่างให้ระบบสร้าง หรือใช้ P ตามด้วยตัวเลข 9 หลัก", "P000000001"],
  ["บาร์โค้ด", "ใช่", "ตัวเลข/ตัวอักษร ไม่ซ้ำ", "8850000000001"],
  ["ชื่อสินค้า", "ใช่", "ข้อความไม่เกิน 120 ตัวอักษร", "น้ำดื่ม 600 มล."],
  ["หมวดหมู่", "ใช่", "ชื่อหมวดที่ต้องการแสดงใน POS", "น้ำดื่ม"],
  ["ราคาขาย", "ใช่", "ตัวเลข 0 ขึ้นไป", "10"],
  ["ราคาทุน", "ไม่", "ตัวเลข 0 ขึ้นไป", "6"],
  ["หน่วยนับ", "ใช่", "เช่น ชิ้น ขวด ซอง", "ขวด"],
  ["สต็อกเริ่มต้น", "ใช่", "จำนวนเต็ม 0 ขึ้นไป", "24"],
  ["จุดแจ้งเตือน", "ไม่", "จำนวนเต็ม 0 ขึ้นไป ค่าเริ่มต้น 5", "5"]
];
guide.getRange("A14:D14").merge();
guide.getRange("A14").values = [["หมายเหตุ: ระบบจะแสดง Preview และแจ้งแถวที่ผิดก่อนบันทึกลง Firebase ทุกครั้ง"]];
guide.getRange("A1:D1").format = { fill: "#0B6B3D", font: { bold: true, color: "#FFFFFF", size: 18 }, horizontalAlignment: "center", verticalAlignment: "center" };
guide.getRange("A3:D3").format = { fill: "#159447", font: { bold: true, color: "#FFFFFF" }, horizontalAlignment: "center" };
guide.getRange("A4:D12").format = { borders: { insideHorizontal: { style: "thin", color: "#DDE8E1" } }, verticalAlignment: "center", wrapText: true };
guide.getRange("A14:D14").format = { fill: "#FFF8E8", font: { bold: true, color: "#7A4D00" }, wrapText: true };
[150, 90, 270, 170].forEach((width, index) => { guide.getRangeByIndexes(0, index, 20, 1).format.columnWidthPx = width; });
guide.getRange("A1:D14").format.autofitRows();
guide.getRange("A1:D1").format.rowHeightPx = 38;

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(publicDir, { recursive: true });
const file = await SpreadsheetFile.exportXlsx(workbook);
await file.save(outputPath);
await fs.copyFile(outputPath, publicPath);

const inspection = await workbook.inspect({ kind: "table", range: "นำเข้าสินค้า!A1:L6", include: "values,formulas", tableMaxRows: 8, tableMaxCols: 12 });
console.log(inspection.ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 50 }, summary: "formula error scan" });
console.log(errors.ndjson);
const preview = await workbook.render({ sheetName: "นำเข้าสินค้า", range: "A1:L6", scale: 1, format: "png" });
await fs.writeFile(path.join(outputDir, "preview.png"), new Uint8Array(await preview.arrayBuffer()));
console.log(outputPath);
