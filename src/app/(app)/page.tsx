import type { ReactNode } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { addDaysIso, formatControl, formatDate, formatDateTime, formatMoney, parseIsoDate, saoPauloDayEnd, saoPauloDayStart, saoPauloTodayDate, todayIsoInSaoPaulo } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const user = await requireUser();
  const todayIso = todayIsoInSaoPaulo();
  const monthStart = saoPauloDayStart(`${todayIso.slice(0, 7)}-01`);
  const todayStart = saoPauloDayStart(todayIso);
  const todayEnd = saoPauloDayEnd(todayIso);
  const today = saoPauloTodayDate();
  const horizon = parseIsoDate(addDaysIso(todayIso, 7));
  const sellerFilter = user.role === "VENDEDOR" ? { sellerId: user.id } : {};

  const [monthSales, todaySales, deliveries, waitingDelivery, products, overdue, overdueCount, openReceivables] = await Promise.all([
    prisma.sale.findMany({
      where: { issuedAt: { gte: monthStart!, lt: todayEnd! }, status: { not: "CANCELADA" }, ...sellerFilter },
      include: { customer: true, commission: true },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.sale.findMany({
      where: { issuedAt: { gte: todayStart!, lt: todayEnd! }, status: { not: "CANCELADA" }, ...sellerFilter },
      include: { customer: true },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.sale.findMany({
      where: {
        status: "FATURADA",
        deliveryDate: { gte: today, lte: horizon! },
        ...sellerFilter,
      },
      include: { customer: true },
      orderBy: { deliveryDate: "asc" },
      take: 6,
    }),
    prisma.sale.count({ where: { status: "FATURADA", ...sellerFilter } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.receivable.findMany({
      where: { status: "ABERTA", dueDate: { lt: today } },
      include: { sale: { include: { customer: true } } },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
    prisma.receivable.count({ where: { status: "ABERTA", dueDate: { lt: today } } }),
    prisma.receivable.aggregate({ where: { status: "ABERTA" }, _sum: { amount: true } }),
  ]);

  const monthRevenue = monthSales.reduce((sum, sale) => sum + sale.closedAmount, 0);
  const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.closedAmount, 0);
  const low = products.filter((product) => product.stockQty - product.reservedQty <= product.minStock);

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Painel</h1>
          <p className="mt-1 text-base text-muted">O que a loja precisa resolver hoje.</p>
        </div>
        <Link href="/vendas/nova" className="inline-flex h-12 items-center rounded-lg bg-teal px-5 text-base font-semibold text-white">
          Criar nota
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Hoje" value={formatMoney(todayRevenue)} hint={`${todaySales.length} pedidos`} />
        <Stat label="Mês" value={formatMoney(monthRevenue)} hint={`${monthSales.length} pedidos`} />
        <Stat label="A entregar" value={String(waitingDelivery)} hint="vendas faturadas sem baixa" />
        {user.role === "ADMIN" ? (
          <Stat label="A receber" value={formatMoney(openReceivables._sum.amount ?? 0)} hint={`${overdueCount} vencidas`} />
        ) : (
          <Stat label="Estoque curto" value={String(low.length)} hint="no mínimo ou abaixo" />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Queue title="Entregas em 7 dias" empty="Nenhuma entrega marcada.">
          {deliveries.map((sale) => (
            <QueueRow
              key={sale.id}
              href={`/vendas/${sale.id}`}
              title={sale.customer.name}
              meta={`${formatControl(sale.number)} · ${sale.deliveryDate ? formatDate(sale.deliveryDate) : ""}`}
              value="Entregar"
            />
          ))}
        </Queue>
        <Queue title="Parcelas vencidas" empty="Nenhuma parcela atrasada.">
          {overdue.map((item) => (
            <QueueRow
              key={item.id}
              href={`/vendas/${item.saleId}`}
              title={item.sale.customer.name}
              meta={formatDate(item.dueDate)}
              value={formatMoney(item.amount)}
            />
          ))}
        </Queue>
        <Queue title="Repor estoque" empty="Nenhum item no limite.">
          {low.slice(0, 6).map((product) => (
            <QueueRow
              key={product.id}
              href="/estoque"
              title={product.name}
              meta={product.code}
              value={String(product.stockQty - product.reservedQty)}
            />
          ))}
        </Queue>
      </div>

      <section className="overflow-x-auto rounded-xl border border-line bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-ink">Pedidos do mês</h2>
        <table className="mt-3 w-full min-w-[640px] text-left text-base">
          <thead>
            <tr>
              <th className="py-2 font-semibold text-ink">Controle</th>
              <th className="py-2 font-semibold text-ink">Cliente</th>
              <th className="py-2 font-semibold text-ink">Quando</th>
              <th className="py-2 text-right font-semibold text-ink">Valor</th>
            </tr>
          </thead>
          <tbody>
            {monthSales.slice(0, 8).map((sale) => (
              <tr key={sale.id} className="border-t border-line">
                <td className="py-3">
                  <Link href={`/vendas/${sale.id}`} className="font-semibold text-teal">
                    {formatControl(sale.number)}
                  </Link>
                </td>
                <td className="py-3 text-ink">{sale.customer.name}</td>
                <td className="py-3 text-muted">{formatDateTime(sale.issuedAt)}</td>
                <td className="py-3 text-right font-semibold text-ink">{formatMoney(sale.closedAmount)}</td>
              </tr>
            ))}
            {monthSales.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-muted">O mês ainda não tem venda.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      <p className="text-sm text-muted">{hint}</p>
    </article>
  );
}

function Queue({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  const visible = items.filter(Boolean);
  return (
    <section className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-3 grid gap-2">{visible.length ? children : <p className="text-base text-muted">{empty}</p>}</div>
    </section>
  );
}

function QueueRow({ href, title, meta, value }: { href: string; title: string; meta: string; value: string }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-3 hover:bg-[#e7eef5]">
      <span>
        <span className="block text-base font-medium text-ink">{title}</span>
        <span className="text-sm text-muted">{meta}</span>
      </span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </Link>
  );
}
