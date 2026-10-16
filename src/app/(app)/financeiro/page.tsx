import Link from "next/link";
import { payPayableAction, payableAction, receiveAction } from "@/actions/app";
import { SubmitButton } from "@/components/submit-button";
import { SearchBar } from "@/components/search-bar";
import { Field, Flash, inputClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatControl, formatDate, formatDateTime, formatMoney, saoPauloTodayDate, todayIsoInSaoPaulo } from "@/lib/format";
import { payStatusLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

const fieldClass = `${inputClass} h-12 text-base`;

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; ok?: string; erro?: string; q?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const tab = query.aba === "pagar" || query.aba === "caixa" ? query.aba : "receber";
  const q = query.q?.trim() ?? "";
  const number = /^\d+$/.test(q) ? Number(q) : undefined;
  const today = saoPauloTodayDate();
  const textMatch = { contains: q, mode: "insensitive" as const };
  const [receivables, payables, entries, inflow, outflow, openReceivable, openPayable] = await Promise.all([
    prisma.receivable.findMany({
      where: {
        status: { not: "CANCELADA" },
        ...(q
          ? {
              OR: [
                { sale: { customer: { name: textMatch } } },
                ...(number != null ? [{ sale: { number } }] : []),
              ],
            }
          : {}),
      },
      include: { sale: { include: { customer: true } } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 80,
    }),
    prisma.payable.findMany({
      where: q ? { OR: [{ description: textMatch }, { category: textMatch }] } : undefined,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 80,
    }),
    prisma.cashEntry.findMany({
      where: q ? { description: textMatch } : undefined,
      orderBy: { date: "desc" },
      take: 40,
    }),
    prisma.cashEntry.aggregate({ where: { direction: "ENTRADA" }, _sum: { amount: true } }),
    prisma.cashEntry.aggregate({ where: { direction: "SAIDA" }, _sum: { amount: true } }),
    prisma.receivable.aggregate({ where: { status: "ABERTA" }, _sum: { amount: true } }),
    prisma.payable.aggregate({ where: { status: "ABERTA" }, _sum: { amount: true } }),
  ]);
  const openIn = openReceivable._sum.amount ?? 0;
  const openOut = openPayable._sum.amount ?? 0;
  const balance = (inflow._sum.amount ?? 0) - (outflow._sum.amount ?? 0);
  const tabs = [
    ["receber", "A receber"],
    ["pagar", "A pagar"],
    ["caixa", "Fluxo de caixa"],
  ] as const;

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <div>
        <h1 className="text-3xl font-semibold text-ink">Financeiro</h1>
        <p className="mt-1 text-base text-muted">Parcelas das notas, contas da loja e o movimento do caixa.</p>
      </div>
      <Flash ok={query.ok} erro={query.erro} />

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-muted">A receber</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatMoney(openIn)}</p>
        </article>
        <article className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-muted">A pagar</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatMoney(openOut)}</p>
        </article>
        <article className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-muted">Saldo do caixa</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatMoney(balance)}</p>
        </article>
      </div>

      <SearchBar
        value={q}
        placeholder={tab === "receber" ? "Cliente ou número do pedido" : tab === "pagar" ? "Descrição ou categoria" : "Descrição do lançamento"}
        hidden={[{ name: "aba", value: tab }]}
        clearHref={`/financeiro?aba=${tab}`}
      />

      <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-line bg-white">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            href={`/financeiro?aba=${key}`}
            className={`flex h-12 items-center justify-center text-base font-semibold ${tab === key ? "bg-teal text-white" : "text-ink hover:bg-[#e7eef5]"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "receber" ? (
        <section className="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-base">
            <thead>
              <tr>
                <th className="px-4 py-3 font-semibold text-ink">Pedido</th>
                <th className="py-3 font-semibold text-ink">Cliente</th>
                <th className="py-3 font-semibold text-ink">Vencimento</th>
                <th className="py-3 font-semibold text-ink">Situação</th>
                <th className="py-3 font-semibold text-ink">Valor</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {receivables.map((item) => {
                const late = item.status === "ABERTA" && item.dueDate < today;
                return (
                  <tr key={item.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <Link href={`/vendas/${item.saleId}`} className="font-semibold text-teal">
                        {formatControl(item.sale.number)} · {item.number}ª
                      </Link>
                    </td>
                    <td className="py-3 text-ink">{item.sale.customer.name}</td>
                    <td className="py-3 text-ink">{formatDate(item.dueDate)}</td>
                    <td className="py-3">
                      <Status late={late} status={item.status} />
                    </td>
                    <td className="py-3 font-semibold text-ink">{formatMoney(item.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      {item.status === "ABERTA" ? (
                        <form action={receiveAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="back" value="/financeiro?aba=receber" />
                          <SubmitButton tone="quiet">Receber</SubmitButton>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {receivables.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">Nenhuma parcela gerada.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === "pagar" ? (
        <div className="grid gap-4">
          <form action={payableAction} className="grid gap-4 rounded-xl border border-line bg-white p-5 shadow-sm md:grid-cols-4">
            <h2 className="text-xl font-semibold text-ink md:col-span-4">Nova conta</h2>
            <Field label="Descrição">
              <input name="description" className={fieldClass} required />
            </Field>
            <Field label="Categoria">
              <input name="category" list="categorias-conta" defaultValue="Fornecedor" className={fieldClass} />
              <datalist id="categorias-conta">
                {["Fornecedor", "Aluguel", "Imposto", "Folha", "Outros"].map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Field>
            <Field label="Vencimento">
              <input type="date" name="dueDate" defaultValue={todayIsoInSaoPaulo()} className={fieldClass} required />
            </Field>
            <Field label="Valor">
              <input name="amount" placeholder="0,00" className={fieldClass} required />
            </Field>
            <div className="md:col-span-4">
              <SubmitButton>Lançar conta</SubmitButton>
            </div>
          </form>
          <section className="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-left text-base">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-semibold text-ink">Descrição</th>
                  <th className="py-3 font-semibold text-ink">Categoria</th>
                  <th className="py-3 font-semibold text-ink">Vencimento</th>
                  <th className="py-3 font-semibold text-ink">Situação</th>
                  <th className="py-3 font-semibold text-ink">Valor</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {payables.map((item) => {
                  const late = item.status === "ABERTA" && item.dueDate < today;
                  return (
                    <tr key={item.id} className="border-t border-line">
                      <td className="px-4 py-3 font-medium text-ink">{item.description}</td>
                      <td className="py-3 text-ink">{item.category}</td>
                      <td className="py-3 text-ink">{formatDate(item.dueDate)}</td>
                      <td className="py-3">
                        <Status late={late} status={item.status} />
                      </td>
                      <td className="py-3 font-semibold text-ink">{formatMoney(item.amount)}</td>
                      <td className="px-4 py-3 text-right">
                        {item.status === "ABERTA" ? (
                          <form action={payPayableAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <SubmitButton tone="quiet">Pagar</SubmitButton>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {payables.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted">Nenhuma conta lançada.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}

      {tab === "caixa" ? (
        <section className="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-base">
            <thead>
              <tr>
                <th className="px-4 py-3 font-semibold text-ink">Lançamento</th>
                <th className="py-3 font-semibold text-ink">Quando</th>
                <th className="px-4 py-3 text-right font-semibold text-ink">Valor</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-line">
                  <td className="px-4 py-3 text-ink">{entry.description}</td>
                  <td className="py-3 text-muted">{formatDateTime(entry.date)}</td>
                  <td className={`px-4 py-3 text-right text-lg font-semibold ${entry.direction === "ENTRADA" ? "text-ok" : "text-danger"}`}>
                    {entry.direction === "ENTRADA" ? "+" : "−"} {formatMoney(entry.amount)}
                  </td>
                </tr>
              ))}
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-muted">
                    O caixa começa a se mover quando uma parcela é recebida.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

function Status({ late, status }: { late: boolean; status: "ABERTA" | "PAGA" | "CANCELADA" }) {
  const label = late ? "Atrasada" : payStatusLabel[status];
  const tone = status === "PAGA" ? "bg-[#e7f6ef] text-ok" : late ? "bg-[#fdecea] text-danger" : "bg-[#e7eef5] text-ink";
  return <span className={`rounded-lg px-3 py-1 text-sm font-semibold ${tone}`}>{label}</span>;
}
