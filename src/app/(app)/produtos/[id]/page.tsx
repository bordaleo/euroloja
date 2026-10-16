import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/product-form";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) notFound();

  return (
    <div>
      <PageHeader eyebrow="Catálogo" title={product.name}>
        <Link href="/produtos" className="text-sm text-teal">Voltar aos produtos</Link>
      </PageHeader>
      <Flash ok={query.ok} erro={query.erro} />
      <p className="mb-4 text-sm text-muted">
        Estoque físico {product.stockQty} · reservado {product.reservedQty} · disponível {product.stockQty - product.reservedQty}. A entrada e a contagem ficam em Estoque.
      </p>
      <ProductForm product={product} showCost={user.role === "ADMIN"} />
    </div>
  );
}
