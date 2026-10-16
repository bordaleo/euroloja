import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { workbookTemplate } from "@/server/spreadsheet";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const buffer = await workbookTemplate();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=modelo-produtos.xlsx",
    },
  });
}
