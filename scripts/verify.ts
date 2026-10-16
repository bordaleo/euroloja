import { PrismaClient } from "@prisma/client";
import { createSale, cancelSale, deliverSale } from "../src/server/sales";
import { payPayable, receiveInstallment } from "../src/server/finance";
import { addDaysIso, todayIsoInSaoPaulo } from "../src/lib/format";

const prisma = new PrismaClient();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const seller = await prisma.user.findFirst({ where: { email: "vendedor@eurojoao.local" } });
  assert(seller, "Vendedor de exemplo ausente.");
  const product = await prisma.product.findUnique({ where: { code: "TRAV-LATEX" } });
  assert(product, "Produto de exemplo ausente.");
  const before = product.stockQty;
  const reservedBefore = product.reservedQty;

  const today = todayIsoInSaoPaulo();
  const saleId = await createSale({
    customer: {
      name: "Cliente Verificacao",
      cpf: "390.533.447-05",
      street: "Rua Verificacao, 10",
      city: "Sao Paulo",
      state: "SP",
    },
    sellerId: seller.id,
    lines: [{ productId: product.id, quantity: 2, unitPrice: 19900 }],
    freight: 1500,
    closedAmount: 40000,
    installments: 2,
    firstDueDate: addDaysIso(today, 30),
    notes: "Pedido de verificacao",
  });

  const reserved = await prisma.product.findUnique({ where: { id: product.id } });
  assert(reserved && reserved.reservedQty === reservedBefore + 2, "A venda não reservou o estoque.");
  assert(reserved.stockQty === before, "A venda baixou o físico antes da entrega.");

  const receivables = await prisma.receivable.findMany({ where: { saleId }, orderBy: { number: "asc" } });
  assert(receivables.length === 2, "As parcelas não foram geradas.");
  assert(receivables[0].amount + receivables[1].amount === 40000, "A soma das parcelas diverge do valor fechado.");

  await deliverSale(saleId);
  const delivered = await prisma.product.findUnique({ where: { id: product.id } });
  assert(delivered && delivered.stockQty === before - 2, "A entrega não baixou o estoque.");
  assert(delivered.reservedQty === reservedBefore, "A reserva continuou depois da entrega.");

  await receiveInstallment(receivables[0].id);
  const cash = await prisma.cashEntry.findFirst({ where: { receivableId: receivables[0].id } });
  assert(cash?.direction === "ENTRADA" && cash.amount === receivables[0].amount, "O recebimento não entrou no caixa.");

  const secondId = await createSale({
    customer: { name: "Cliente Cancelamento" },
    sellerId: seller.id,
    lines: [{ productId: product.id, quantity: 1, unitPrice: 19900 }],
    freight: 0,
    closedAmount: 19900,
    installments: 1,
    firstDueDate: addDaysIso(today, 10),
  });
  await cancelSale(secondId);
  const afterCancel = await prisma.product.findUnique({ where: { id: product.id } });
  assert(afterCancel && afterCancel.reservedQty === reservedBefore, "O cancelamento não liberou a reserva.");
  const cancelled = await prisma.sale.findUnique({ where: { id: secondId } });
  assert(cancelled?.status === "CANCELADA", "A venda não ficou cancelada.");

  const payable = await prisma.payable.create({
    data: {
      description: "Conta de verificacao",
      category: "Outros",
      dueDate: new Date(`${today}T00:00:00.000Z`),
      amount: 1000,
    },
  });
  await payPayable(payable.id);
  const paid = await prisma.payable.findUnique({ where: { id: payable.id } });
  assert(paid?.status === "PAGA", "A conta a pagar não foi baixada.");

  await prisma.cashEntry.deleteMany({
    where: { OR: [{ receivableId: { in: receivables.map((item) => item.id) } }, { payableId: payable.id }] },
  });
  await prisma.stockMovement.deleteMany({ where: { saleId: { in: [saleId, secondId] } } });
  await prisma.payable.delete({ where: { id: payable.id } });
  await prisma.sale.deleteMany({ where: { id: { in: [saleId, secondId] } } });
  await prisma.customer.deleteMany({
    where: { OR: [{ name: "Cliente Verificacao" }, { name: "Cliente Cancelamento" }, { cpf: "39053344705" }] },
  });
  await prisma.product.update({
    where: { id: product.id },
    data: { stockQty: before, reservedQty: reservedBefore },
  });

  console.log("Fluxo de venda, estoque, parcela e caixa conferido.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
