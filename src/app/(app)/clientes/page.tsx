import Link from "next/link";
import { CustomerForm } from "@/components/customer-form";
import { SearchBar } from "@/components/search-bar";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatCpf, onlyDigits } from "@/lib/cpf";
import { prisma } from "@/lib/prisma";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; q?: string }>;
}) {
  await requireUser();
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const digits = onlyDigits(q);
  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            ...(digits ? [{ cpf: { contains: digits } }] : []),
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
  });

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Cadastro" title="Clientes" />
      <Flash erro={query.erro} />
      <CustomerForm />
      <SearchBar value={q} placeholder="Nome, CPF, telefone ou cidade" clearHref="/clientes" />
      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="font-medium">CPF</th>
              <th className="font-medium">Telefone</th>
              <th className="px-4 font-medium">Cidade</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link href={`/clientes/${customer.id}`} className="font-semibold text-teal">{customer.name}</Link>
                </td>
                <td>{customer.cpf ? formatCpf(customer.cpf) : ""}</td>
                <td>{customer.phone}</td>
                <td className="px-4">{[customer.city, customer.state].filter(Boolean).join("/")}</td>
              </tr>
            ))}
            {customers.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-muted">{q ? "Nenhum cliente encontrado." : "Nenhum cliente ainda. O primeiro pode nascer direto na venda."}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
