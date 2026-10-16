import { stockAction } from "@/actions/app";
import { SearchBar } from "@/components/search-bar";
import { SubmitButton } from "@/components/submit-button";
import { Flash, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { stockTypeLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

const fieldClass = `${inputClass} h-12 text-base`;

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string; q?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const productMatch = q
    ? {
        OR: [
          { code: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : undefined;
  const [catalog, movements] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({
      where: productMatch ? { product: productMatch } : undefined,
      include: { product: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  const needle = q.toLowerCase();
  const products = q
    ? catalog.filter((product) => product.code.toLowerCase().includes(needle) || product.name.toLowerCase().includes(needle))
    : catalog;

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <div>
        <h1 className="text-3xl font-semibold text-ink">Estoque</h1>
        <p className="mt-1 max-w-3xl text-base text-muted">
          A venda reserva o item. A entrega baixa o físico. Disponível é o que ainda pode ser vendido.
        </p>
      </div>
      <Flash ok={query.ok} erro={query.erro} />

      {user.role === "ADMIN" ? (
        <form action={stockAction} className="grid gap-4 rounded-xl border border-line bg-white p-5 shadow-sm md:grid-cols-4">
          <h2 className="text-xl font-semibold text-ink md:col-span-4">Entrada ou contagem</h2>
          <label className="grid gap-1 text-sm md:col-span-2">
            <span className="font-medium text-ink">Produto</span>
            <select name="productId" className={fieldClass} required>
              {catalog.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.code} · {product.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-ink">Movimento</span>
            <select name="mode" className={fieldClass}>
              <option value="ENTRADA">Entrada</option>
              <option value="AJUSTE">Contagem</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-ink">Quantidade</span>
            <input name="quantity" type="number" min={0} className={fieldClass} required />
          </label>
          <label className="grid gap-1 text-sm md:col-span-3">
            <span className="font-medium text-ink">Observação</span>
            <input name="note" className={fieldClass} />
          </label>
          <div className="flex items-end">
            <SubmitButton>Lançar movimento</SubmitButton>
          </div>
        </form>
      ) : null}

      <section className="rounded-xl border border-line bg-white shadow-sm">
        <div className="border-b border-line p-4">
          <SearchBar value={q} placeholder="Código ou nome do produto" clearHref="/estoque" />
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-base">
          <thead>
            <tr>
              <th className="px-4 py-3 font-semibold text-ink">Produto</th>
              <th className="py-3 font-semibold text-ink">Físico</th>
              <th className="py-3 font-semibold text-ink">Reservado</th>
              <th className="py-3 font-semibold text-ink">Disponível</th>
              <th className="px-4 py-3 font-semibold text-ink">Mínimo</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const available = product.stockQty - product.reservedQty;
              const low = available <= product.minStock;
              return (
                <tr key={product.id} className={`border-t border-line ${low ? "bg-[#fdecea]" : ""}`}>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-ink">{product.name}</span>
                    <span className="block text-sm text-muted">{product.code}</span>
                  </td>
                  <td className="py-3 text-ink">{product.stockQty}</td>
                  <td className="py-3 text-ink">{product.reservedQty}</td>
                  <td className={`py-3 text-lg font-semibold ${low ? "text-danger" : "text-ink"}`}>{available}</td>
                  <td className="px-4 py-3 text-ink">{product.minStock}</td>
                </tr>
              );
            })}
            {products.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">Nenhum produto encontrado.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl border border-line bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-ink">Últimos movimentos</h2>
        <table className="mt-3 w-full min-w-[640px] text-left text-base">
          <thead>
            <tr>
              <th className="py-2 font-semibold text-ink">Quando</th>
              <th className="py-2 font-semibold text-ink">Produto</th>
              <th className="py-2 font-semibold text-ink">Movimento</th>
              <th className="py-2 font-semibold text-ink">Qtd</th>
              <th className="py-2 font-semibold text-ink">Observação</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id} className="border-t border-line">
                <td className="py-3 text-ink">{formatDateTime(movement.createdAt)}</td>
                <td className="py-3 text-ink">{movement.product.code}</td>
                <td className="py-3 text-ink">{stockTypeLabel[movement.type]}</td>
                <td className="py-3 font-semibold text-ink">{movement.quantity}</td>
                <td className="py-3 text-muted">{movement.note}</td>
              </tr>
            ))}
            {movements.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-muted">Nenhum movimento ainda.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
