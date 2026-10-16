import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/customer-form";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatControl, formatDateTime, formatMoney } from "@/lib/format";
import { saleStatusLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export default async function EditCustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { sales: { orderBy: { number: "desc" }, take: 12 } },
  });
  if (!customer) notFound();

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Cliente" title={customer.name}>
        <Link href="/clientes" className="text-sm text-teal">Voltar aos clientes</Link>
      </PageHeader>
      <Flash ok={query.ok} erro={query.erro} />
      <CustomerForm
        customer={{
          ...customer,
          birthDate: customer.birthDate ? customer.birthDate.toISOString().slice(0, 10) : null,
        }}
      />
      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Pedidos</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {customer.sales.map((sale) => (
            <li key={sale.id} className="flex justify-between gap-3 border-t border-line py-2">
              <Link href={`/vendas/${sale.id}`} className="font-semibold text-teal">{formatControl(sale.number)}</Link>
              <span>{saleStatusLabel[sale.status]}</span>
              <span>{formatDateTime(sale.issuedAt)}</span>
              <span>{formatMoney(sale.closedAmount)}</span>
            </li>
          ))}
          {customer.sales.length === 0 ? <li className="text-muted">Este cliente ainda não tem pedido.</li> : null}
        </ul>
      </section>
    </div>
  );
}
