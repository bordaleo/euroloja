import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { requireUser } from "@/lib/auth";
import { formatCpf } from "@/lib/cpf";
import { formatControl, formatDate, formatDateSpaced, formatMoney } from "@/lib/format";
import { WARRANTY } from "@/lib/warranty";
import { prisma } from "@/lib/prisma";

export default async function PrintSalePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ via?: string; imprimir?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { via, imprimir } = await searchParams;
  const [sale, store] = await Promise.all([
    prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        seller: true,
        items: true,
        receivables: { orderBy: { number: "asc" } },
      },
    }),
    prisma.storeSettings.findUnique({ where: { id: "default" } }),
  ]);
  if (!sale || !store) notFound();
  const copy = via === "loja" ? "2º Via - Loja" : "1º Via - Cliente";
  const sameAmount = sale.receivables.every((item) => item.amount === sale.receivables[0]?.amount);

  return (
    <main className="mx-auto max-w-4xl bg-white px-6 py-8 text-black">
      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <PrintButton auto={imprimir === "1"} />
        <Link href={`/imprimir/${sale.id}?via=loja${imprimir === "1" ? "&imprimir=1" : ""}`} className="inline-flex h-12 items-center rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold text-black">
          Via da loja
        </Link>
        <Link href={`/vendas/${sale.id}`} className="text-sm text-stone-600">
          Voltar ao pedido
        </Link>
      </div>
      <article className="border border-black p-6 text-[13px] leading-5">
        <header className="text-center">
          <h1 className="text-base font-bold">{store.legalName}</h1>
          <p>{store.street} - CEP: {store.cep} - {store.district} - {store.city}/{store.state}</p>
          <p>CNPJ: {store.cnpj}</p>
          <p className="mt-3 font-semibold">Controle Interno {copy}</p>
        </header>

        <h2 className="mt-4 border-y border-black py-1 text-center font-semibold">Dados da Venda</h2>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
          <p><span className="font-semibold">Controle Nº:</span> {formatControl(sale.number)}</p>
          <p><span className="font-semibold">Vendedor:</span> {sale.seller.name}</p>
          <p className="col-span-2"><span className="font-semibold">Cliente:</span> {sale.customer.name}</p>
          <p><span className="font-semibold">CPF:</span> {sale.customer.cpf ? formatCpf(sale.customer.cpf) : ""}</p>
          <p><span className="font-semibold">Data Nascimento:</span> {sale.customer.birthDate ? formatDate(sale.customer.birthDate) : ""}</p>
          <p><span className="font-semibold">Telefone:</span> {sale.customer.phone}</p>
          <p><span className="font-semibold">CEP:</span> {sale.customer.cep}</p>
          <p className="col-span-2"><span className="font-semibold">Endereço:</span> {sale.customer.street}</p>
          <p><span className="font-semibold">Complemento:</span> {sale.customer.complement}</p>
          <p><span className="font-semibold">Bairro:</span> {sale.customer.neighborhood}</p>
          <p><span className="font-semibold">Cidade/UF:</span> {[sale.customer.city, sale.customer.state].filter(Boolean).join("/")}</p>
          <p><span className="font-semibold">Valor Fechado:</span> {formatMoney(sale.closedAmount)}</p>
          <p>
            <span className="font-semibold">Nº Parcelas:</span> {sale.installmentCount} x {sameAmount && sale.receivables[0] ? formatMoney(sale.receivables[0].amount) : ""}
          </p>
          <p><span className="font-semibold">Entrega em:</span> {sale.deliveryDate ? formatDate(sale.deliveryDate) : ""}</p>
          <p className="col-span-2"><span className="font-semibold">Observações:</span> {sale.notes}</p>
        </div>

        <h2 className="mt-4 border-y border-black py-1 text-center font-semibold">Itens Vendidos</h2>
        <table className="mt-2 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-black">
              <th className="py-1 font-semibold">Código</th>
              <th className="font-semibold">Descrição do Produto</th>
              <th className="font-semibold">Qtd</th>
              <th className="font-semibold">Unit. (R$)</th>
              <th className="text-right font-semibold">Total (R$)</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id}>
                <td className="py-1">{item.code}</td>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.unitPrice)}</td>
                <td className="text-right">{formatMoney(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 flex justify-between font-semibold">
          <span>T O T A L : {formatMoney(sale.itemsTotal)}</span>
          <span>Frete: {formatMoney(sale.freight)}</span>
        </p>
        {sale.receivables.length > 0 ? (
          <div className="mt-3">
            <p className="font-semibold">Parcelas</p>
            {sale.receivables.map((item) => (
              <p key={item.id}>{item.number}ª {formatDate(item.dueDate)} — {formatMoney(item.amount)}</p>
            ))}
          </div>
        ) : null}

        <h2 className="mt-5 text-center font-semibold">Termo de Compromisso</h2>
        <ol className="mt-2 grid gap-1">
          {WARRANTY.map((clause, index) => (
            <li key={clause}>{String(index + 1).padStart(2, "0")}-{clause}</li>
          ))}
        </ol>

        <div className="mt-10 grid grid-cols-2 gap-10 text-center">
          <p className="border-t border-black pt-1">Assinatura do Vendedor</p>
          <p className="border-t border-black pt-1">Assinatura do Cliente</p>
        </div>
        <p className="mt-6">Data de Emissão: {formatDateSpaced(sale.issuedAt)}</p>
      </article>
    </main>
  );
}
