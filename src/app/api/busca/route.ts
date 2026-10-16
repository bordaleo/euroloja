import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ products: [], customers: [], sales: [] });
  }

  const digits = query.replace(/\D/g, "");
  const number = /^\d+$/.test(query) ? Number(query) : undefined;
  const [products, customers, sales] = await Promise.all([
    prisma.product.findMany({
      where: {
        active: true,
        OR: [
          { code: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 6,
      select: { id: true, code: true, name: true },
    }),
    prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          ...(digits.length >= 3 ? [{ cpf: { contains: digits } }] : []),
        ],
      },
      take: 6,
      select: { id: true, name: true, cpf: true },
    }),
    prisma.sale.findMany({
      where: {
        OR: [
          { customer: { name: { contains: query, mode: "insensitive" } } },
          ...(number != null ? [{ number }] : []),
        ],
      },
      take: 6,
      orderBy: { number: "desc" },
      select: { id: true, number: true, customer: { select: { name: true } } },
    }),
  ]);

  return NextResponse.json({ products, customers, sales });
}
