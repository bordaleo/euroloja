import ExcelJS from "exceljs";
import { AppError } from "@/lib/errors";

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(".", ",");
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("text" in value && value.text != null) return String(value.text).trim();
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
  }
  return String(value).trim();
}

export async function readXlsx(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Xlsx["load"]>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new AppError("A planilha não tem nenhuma aba.");

  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const values = (row.values as ExcelJS.CellValue[]).slice(1).map(cellText);
    if (values.some((cell) => cell !== "")) rows.push(values);
  });
  if (!rows.length) throw new AppError("A planilha está vazia.");
  return rows;
}

export async function workbookTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Produtos");
  sheet.addRow(["codigo", "descricao", "categoria", "preco", "custo", "estoque", "minimo", "medida", "densidade"]);
  sheet.addRow(["EXEMPLO", "Colchão de exemplo", "Colchão", "1899,00", "910,00", "4", "1", "138x188", "D33"]);
  sheet.columns.forEach((column) => {
    column.width = 28;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as unknown as Uint8Array);
}
