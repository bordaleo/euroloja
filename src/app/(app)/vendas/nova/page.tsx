import { SaleForm } from "@/components/sale-form";
import { requireUser } from "@/lib/auth";
import { addDaysIso, todayIsoInSaoPaulo } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function NewSalePage({
  searchParams,
}: {
  searchParams: Promise<{ produto?: string }>;
}) {
  const user = await requireUser();
  const { produto } = await searchParams;
  const today = todayIsoInSaoPaulo();
  const [products, customers, sellers] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const toCustomer = (customer: (typeof customers)[number]) => ({
    id: customer.id,
    name: customer.name,
    cpf: customer.cpf,
    birthDate: customer.birthDate ? customer.birthDate.toISOString().slice(0, 10) : null,
    phone: customer.phone,
    cep: customer.cep,
    street: customer.street,
    complement: customer.complement,
    neighborhood: customer.neighborhood,
    city: customer.city,
    state: customer.state,
  });

  return (
    <SaleForm
        today={today}
        initialProductId={produto}
        products={products.map((product) => ({
          id: product.id,
          code: product.code,
          name: product.name,
          category: product.category,
          size: product.size,
          density: product.density,
          unitPrice: product.unitPrice,
          available: product.stockQty - product.reservedQty,
        }))}
        customers={customers.map(toCustomer)}
        sellers={sellers.map((seller) => ({ id: seller.id, name: seller.name }))}
        defaultSellerId={sellers.some((seller) => seller.id === user.id) ? user.id : sellers[0]?.id ?? ""}
        defaultDue={addDaysIso(today, 30)}
    />
  );
}
