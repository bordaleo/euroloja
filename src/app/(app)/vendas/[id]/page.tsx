import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelAction, deliverAction, payCommissionAction, receiveAction } from "@/actions/app";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatCpf } from "@/lib/cpf";
import { formatControl, formatDate, formatDateTime, formatMoney, formatPercent, saoPauloTodayDate } from "@/lib/format";
import { payStatusLabel, saleStatusLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export default async function SalePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      seller: true,
      items: true,
      receivables: { orderBy: { number: "asc" } },
      commission: true,
    },
  });
  if (!sale) notFound();
  const today = saoPauloTodayDate();

  return (
    <div>
      <PageHeader eyebrow="Pedido" title={`Controle ${formatControl(sale.number)}`}>
        <div className="flex flex-wrap gap-2">
          <Link href={`/imprimir/${sale.id}?imprimir=1`} className="inline-flex h-11 items-center rounded-lg bg-teal px-5 text-sm font-semibold text-white">
            Imprimir nota
          </Link>
          <Link href={`/imprimir/${sale.id}?via=loja`} className="inline-flex h-10 items-center rounded-lg border border-line bg-card px-4 text-sm font-semibold">
            Via da loja
          </Link>
        </div>
      </PageHeader>
      <Flash ok={query.ok} erro={query.erro} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge tone={sale.status === "CANCELADA" ? "muted" : sale.status === "ENTREGUE" ? "ok" : "brass"}>
          {saleStatusLabel[sale.status]}
        </Badge>
        <span className="text-sm text-muted">Emitido em {formatDateTime(sale.issuedAt)} · {sale.seller.name}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-5 text-sm">
          <h2 className="font-serif text-2xl">Cliente</h2>
          <p className="mt-3 font-medium">{sale.customer.name}</p>
          <p>CPF {sale.customer.cpf ? formatCpf(sale.customer.cpf) : "não informado"}</p>
          <p>{sale.customer.phone}</p>
          <p>{[sale.customer.street, sale.customer.complement, sale.customer.neighborhood].filter(Boolean).join(", ")}</p>
          <p>{[sale.customer.city, sale.customer.state].filter(Boolean).join("/")} {sale.customer.cep}</p>
          {sale.deliveryDate ? <p className="mt-2">Entrega em {formatDate(sale.deliveryDate)}</p> : null}
          {sale.notes ? <p className="mt-2 text-muted">{sale.notes}</p> : null}
        </section>
        <section className="rounded-2xl border border-line bg-card p-5 text-sm">
          <h2 className="font-serif text-2xl">Valores</h2>
          <p className="mt-3">Itens {formatMoney(sale.itemsTotal)}</p>
          <p>Frete {formatMoney(sale.freight)}</p>
          <p className="text-lg font-semibold">Fechado {formatMoney(sale.closedAmount)}</p>
          <p>{sale.installmentCount} parcelas · primeira em {formatDate(sale.firstDueDate)}</p>
          {sale.commission ? (
            <p className="mt-2">
              Comissão {formatPercent(sale.commission.bps)} · {formatMoney(sale.commission.amount)} · {payStatusLabel[sale.commission.status]}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {sale.status === "FATURADA" ? (
              <form action={deliverAction}>
                <input type="hidden" name="id" value={sale.id} />
                <SubmitButton>Confirmar entrega</SubmitButton>
              </form>
            ) : null}
            {user.role === "ADMIN" && sale.status !== "CANCELADA" ? (
              <form action={cancelAction}>
                <input type="hidden" name="id" value={sale.id} />
                <SubmitButton tone="danger">Cancelar venda</SubmitButton>
              </form>
            ) : null}
            {user.role === "ADMIN" && sale.commission?.status === "ABERTA" && sale.commission.amount > 0 ? (
              <form action={payCommissionAction}>
                <input type="hidden" name="id" value={sale.commission.id} />
                <input type="hidden" name="saleId" value={sale.id} />
                <SubmitButton tone="quiet">Pagar comissão</SubmitButton>
              </form>
            ) : null}
          </div>
        </section>
      </div>

      <section className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Itens</h2>
        <table className="mt-3 w-full min-w-[640px] text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-2 font-medium">Código</th>
              <th className="font-medium">Descrição</th>
              <th className="font-medium">Qtd</th>
              <th className="font-medium">Unitário</th>
              <th className="font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id} className="border-t border-line">
                <td className="py-2">{item.code}</td>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.unitPrice)}</td>
                <td className="text-right">{formatMoney(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Parcelas</h2>
        <div className="mt-3 grid gap-2">
          {sale.receivables.map((item) => {
            const late = item.status === "ABERTA" && item.dueDate < today;
            return (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-2 text-sm">
                <div>
                  <p className="font-medium">Parcela {item.number} · {formatDate(item.dueDate)}</p>
                  <Badge tone={item.status === "PAGA" ? "ok" : late ? "danger" : "muted"}>
                    {late ? "Atrasada" : payStatusLabel[item.status]}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{formatMoney(item.amount)}</span>
                  {item.status === "ABERTA" ? (
                    <form action={receiveAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="saleId" value={sale.id} />
                      <SubmitButton tone="quiet">Receber</SubmitButton>
                    </form>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
