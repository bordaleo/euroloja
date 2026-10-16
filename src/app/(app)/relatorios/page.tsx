import Link from "next/link";
import { payCommissionAction } from "@/actions/app";
import { SubmitButton } from "@/components/submit-button";
import { Flash, inputClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatControl, formatDate, formatMoney, formatPercent, parseIsoDate, saoPauloDayEnd, saoPauloDayStart, saoPauloTodayDate, todayIsoInSaoPaulo } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const fieldClass = `${inputClass} h-12 text-base`;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; ok?: string; erro?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const today = todayIsoInSaoPaulo();
  const from = query.from || `${today.slice(0, 7)}-01`;
  const to = query.to || today;
  const start = saoPauloDayStart(from);
  const end = saoPauloDayEnd(to);
  const todayDate = saoPauloTodayDate();
  const fromLabel = formatDate(parseIsoDate(from)!);
  const toLabel = formatDate(parseIsoDate(to)!);

  const [sales, payables, entries, products, overdue, openCommissions] = await Promise.all([
    prisma.sale.findMany({
      where: { issuedAt: { gte: start!, lt: end! }, status: { not: "CANCELADA" } },
      include: { seller: true, items: true, commission: true },
    }),
    prisma.payable.findMany({ where: { status: "PAGA", paidAt: { gte: start!, lt: end! } } }),
    prisma.cashEntry.findMany({ where: { date: { gte: start!, lt: end! } }, orderBy: { date: "asc" } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.receivable.findMany({
      where: { status: "ABERTA", dueDate: { lt: todayDate } },
      include: { sale: { include: { customer: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.commission.findMany({
      where: { status: "ABERTA", amount: { gt: 0 }, sale: { status: { not: "CANCELADA" } } },
      include: { seller: true, sale: true },
      orderBy: { sale: { number: "desc" } },
      take: 20,
    }),
  ]);

  const revenue = sales.reduce((sum, sale) => sum + sale.closedAmount, 0);
  const cmv = sales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitCost, 0), 0);
  const commissions = sales.reduce((sum, sale) => sum + (sale.commission && sale.commission.status !== "CANCELADA" ? sale.commission.amount : 0), 0);
  const expenses = payables.reduce((sum, item) => sum + item.amount, 0);
  const result = revenue - cmv - commissions - expenses;
  const cashIn = entries.filter((entry) => entry.direction === "ENTRADA").reduce((sum, entry) => sum + entry.amount, 0);
  const cashOut = entries.filter((entry) => entry.direction === "SAIDA").reduce((sum, entry) => sum + entry.amount, 0);

  const bySeller = new Map<string, { name: string; count: number; revenue: number; commission: number }>();
  for (const sale of sales) {
    const current = bySeller.get(sale.sellerId) ?? { name: sale.seller.name, count: 0, revenue: 0, commission: 0 };
    current.count += 1;
    current.revenue += sale.closedAmount;
    current.commission += sale.commission?.status === "CANCELADA" ? 0 : sale.commission?.amount ?? 0;
    bySeller.set(sale.sellerId, current);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <div>
        <h1 className="text-3xl font-semibold text-ink">Relatórios</h1>
        <p className="mt-1 text-base text-muted">
          Período de {fromLabel} até {toLabel}. Receita e comissão pela data da venda. Despesas pela data do pagamento.
        </p>
      </div>
      <Flash ok={query.ok} erro={query.erro} />

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-5 shadow-sm">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-ink">De</span>
          <input type="date" name="from" defaultValue={from} className={fieldClass} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-ink">Até</span>
          <input type="date" name="to" defaultValue={to} className={fieldClass} />
        </label>
        <button className="h-12 rounded-lg bg-teal px-5 text-base font-semibold text-white">Atualizar período</button>
      </form>

      <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-ink">Resultado do período</h2>
        <dl className="mt-4 grid gap-2 text-base">
          <Row label="Faturamento" value={formatMoney(revenue)} />
          <Row label="Custo da mercadoria" value={formatMoney(cmv)} />
          <Row label="Comissões" value={formatMoney(commissions)} />
          <Row label="Despesas pagas" value={formatMoney(expenses)} />
          <div className="mt-2 flex items-end justify-between border-t border-line pt-3">
            <dt className="text-lg font-semibold text-ink">Resultado</dt>
            <dd className="text-2xl font-semibold text-ink">{formatMoney(result)}</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-muted">Entradas no caixa</p>
          <p className="mt-1 text-2xl font-semibold text-ok">{formatMoney(cashIn)}</p>
        </article>
        <article className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-muted">Saídas no caixa</p>
          <p className="mt-1 text-2xl font-semibold text-danger">{formatMoney(cashOut)}</p>
        </article>
        <article className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-muted">Saldo do período</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatMoney(cashIn - cashOut)}</p>
        </article>
      </section>

      <section className="overflow-x-auto rounded-xl border border-line bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-ink">Vendas por vendedor</h2>
        <table className="mt-3 w-full min-w-[560px] text-left text-base">
          <thead>
            <tr>
              <th className="py-2 font-semibold text-ink">Vendedor</th>
              <th className="py-2 font-semibold text-ink">Pedidos</th>
              <th className="py-2 font-semibold text-ink">Faturamento</th>
              <th className="py-2 font-semibold text-ink">Comissão</th>
            </tr>
          </thead>
          <tbody>
            {[...bySeller.values()].map((row) => (
              <tr key={row.name} className="border-t border-line">
                <td className="py-3 font-medium text-ink">{row.name}</td>
                <td className="py-3 text-ink">{row.count}</td>
                <td className="py-3 font-semibold text-ink">{formatMoney(row.revenue)}</td>
                <td className="py-3 text-ink">{formatMoney(row.commission)}</td>
              </tr>
            ))}
            {bySeller.size === 0 ? (
              <tr>
                <td className="py-8 text-muted" colSpan={4}>Sem vendas no período.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-xl border border-line bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-ink">Comissões em aberto</h2>
        <table className="mt-3 w-full min-w-[640px] text-left text-base">
          <thead>
            <tr>
              <th className="py-2 font-semibold text-ink">Vendedor</th>
              <th className="py-2 font-semibold text-ink">Venda</th>
              <th className="py-2 font-semibold text-ink">Percentual</th>
              <th className="py-2 font-semibold text-ink">Valor</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {openCommissions.map((item) => (
              <tr key={item.id} className="border-t border-line">
                <td className="py-3 text-ink">{item.seller.name}</td>
                <td className="py-3">
                  <Link href={`/vendas/${item.saleId}`} className="font-semibold text-teal">
                    {formatControl(item.sale.number)}
                  </Link>
                </td>
                <td className="py-3 text-ink">{formatPercent(item.bps)}</td>
                <td className="py-3 font-semibold text-ink">{formatMoney(item.amount)}</td>
                <td className="py-3 text-right">
                  <form action={payCommissionAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <SubmitButton tone="quiet">Pagar</SubmitButton>
                  </form>
                </td>
              </tr>
            ))}
            {openCommissions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-muted">Nenhuma comissão em aberto.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-xl border border-line bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-ink">Parcelas vencidas</h2>
        <table className="mt-3 w-full min-w-[520px] text-left text-base">
          <thead>
            <tr>
              <th className="py-2 font-semibold text-ink">Cliente</th>
              <th className="py-2 font-semibold text-ink">Vencimento</th>
              <th className="py-2 text-right font-semibold text-ink">Valor</th>
            </tr>
          </thead>
          <tbody>
            {overdue.map((item) => (
              <tr key={item.id} className="border-t border-line bg-[#fdecea]">
                <td className="py-3 text-ink">{item.sale.customer.name}</td>
                <td className="py-3 text-ink">{formatDate(item.dueDate)}</td>
                <td className="py-3 text-right font-semibold text-danger">{formatMoney(item.amount)}</td>
              </tr>
            ))}
            {overdue.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 text-muted">Nenhuma parcela vencida.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-xl border border-line bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-ink">Posição de estoque</h2>
        <table className="mt-3 w-full min-w-[560px] text-left text-base">
          <thead>
            <tr>
              <th className="py-2 font-semibold text-ink">Produto</th>
              <th className="py-2 font-semibold text-ink">Físico</th>
              <th className="py-2 font-semibold text-ink">Reservado</th>
              <th className="py-2 font-semibold text-ink">Disponível</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const available = product.stockQty - product.reservedQty;
              const low = available <= product.minStock;
              return (
                <tr key={product.id} className={`border-t border-line ${low ? "bg-[#fdecea]" : ""}`}>
                  <td className="py-3 text-ink">{product.name}</td>
                  <td className="py-3 text-ink">{product.stockQty}</td>
                  <td className="py-3 text-ink">{product.reservedQty}</td>
                  <td className={`py-3 font-semibold ${low ? "text-danger" : "text-ink"}`}>{available}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2">
      <dt className="text-ink">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}
