import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatControl, formatDateTime, formatMoney } from "@/lib/format";
import { saleStatusLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { SearchBar } from "@/components/search-bar";
import { Badge, PageHeader } from "@/components/ui";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q } = await searchParams;
  const query = q?.trim();
  const number = query && /^\d+$/.test(query) ? Number(query) : undefined;
  const sales = await prisma.sale.findMany({
    where: query
      ? {
          OR: [
            { customer: { name: { contains: query, mode: "insensitive" } } },
            ...(number != null ? [{ number }] : []),
          ],
        }
      : undefined,
    include: { customer: true, seller: true },
    orderBy: { number: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader eyebrow="Vendas" title="Pedidos">
        <Link href="/vendas/nova" className="inline-flex h-10 items-center rounded-lg bg-brass px-4 text-sm font-semibold text-white">
          Nova venda
        </Link>
      </PageHeader>
      <div className="mb-4">
        <SearchBar value={query ?? ""} placeholder="Cliente ou número do controle" clearHref="/vendas" />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Controle</th>
              <th className="font-medium">Cliente</th>
              <th className="font-medium">Vendedor</th>
              <th className="font-medium">Emissão</th>
              <th className="font-medium">Situação</th>
              <th className="px-4 font-medium text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link href={`/vendas/${sale.id}`} className="font-semibold text-teal">{formatControl(sale.number)}</Link>
                </td>
                <td>{sale.customer.name}</td>
                <td>{sale.seller.name}</td>
                <td>{formatDateTime(sale.issuedAt)}</td>
                <td>
                  <Badge tone={sale.status === "CANCELADA" ? "muted" : sale.status === "ENTREGUE" ? "ok" : "brass"}>
                    {saleStatusLabel[sale.status]}
                  </Badge>
                </td>
                <td className="px-4 text-right font-medium">{formatMoney(sale.closedAmount)}</td>
              </tr>
            ))}
            {sales.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-muted">Nenhuma venda encontrada.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
