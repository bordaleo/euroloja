import Link from "next/link";
import { ImportProducts } from "@/components/import-products";
import { ProductForm } from "@/components/product-form";
import { SearchBar } from "@/components/search-bar";
import { Flash } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string; q?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const products = await prisma.product.findMany({
    where: q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
            { size: { contains: q, mode: "insensitive" } },
            { density: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
  });
  const admin = user.role === "ADMIN";

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <div>
        <h1 className="text-3xl font-semibold text-ink">Produtos</h1>
        <p className="mt-1 text-base text-muted">Suba a planilha da loja ou cadastre um item. O preço e o estoque entram na nota.</p>
      </div>
      <Flash ok={query.ok} erro={query.erro} />
      <ImportProducts />

      <details className="rounded-xl border border-line bg-white shadow-sm">
        <summary className="cursor-pointer px-5 py-4 text-xl font-semibold text-ink">Cadastrar um produto</summary>
        <div className="px-5 pb-5">
          <ProductForm showCost={admin} embedded />
        </div>
      </details>

      <section className="rounded-xl border border-line bg-white shadow-sm">
        <div className="border-b border-line p-4">
          <SearchBar
            value={q}
            placeholder="Código, nome, medida ou densidade"
            clearHref="/produtos"
          />
          <p className="mt-2 text-sm text-muted">
            {products.length} {products.length === 1 ? "produto" : "produtos"}
            {q ? ` para “${q}”` : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-base">
          <thead>
            <tr>
              <th className="px-4 py-3 font-semibold text-ink">Código</th>
              <th className="py-3 font-semibold text-ink">Descrição</th>
              <th className="py-3 font-semibold text-ink">Preço</th>
              {admin ? <th className="py-3 font-semibold text-ink">Custo</th> : null}
              <th className="py-3 font-semibold text-ink">Disponível</th>
              <th className="px-4 py-3 font-semibold text-ink">Situação</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const available = product.stockQty - product.reservedQty;
              const low = product.active && available <= product.minStock;
              return (
                <tr key={product.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link href={`/produtos/${product.id}`} className="font-semibold text-teal">
                      {product.code}
                    </Link>
                  </td>
                  <td className="py-3 text-ink">
                    {product.name}
                    <span className="block text-sm text-muted">{[product.category, product.size, product.density].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="py-3 font-semibold text-ink">{formatMoney(product.unitPrice)}</td>
                  {admin ? <td className="py-3 text-ink">{formatMoney(product.costPrice)}</td> : null}
                  <td className={`py-3 font-semibold ${low ? "text-danger" : "text-ink"}`}>
                    {available}
                    {low ? <span className="block text-sm font-medium">no mínimo ou abaixo</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-lg px-3 py-1 text-sm font-semibold ${product.active ? "bg-[#e7f6ef] text-ok" : "bg-[#e7eef5] text-ink"}`}>
                      {product.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 ? (
              <tr>
                <td colSpan={admin ? 6 : 5} className="px-4 py-10 text-center text-muted">
                  {q ? "Nenhum produto encontrado." : "Nenhum produto cadastrado."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}
