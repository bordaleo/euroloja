import { AppError } from "@/lib/errors";
import { emptyToNull, parseIsoDate, parseMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export async function receiveInstallment(id: string) {
  await prisma.$transaction(async (tx) => {
    const receivable = await tx.receivable.findUnique({
      where: { id },
      include: { sale: { include: { customer: true } } },
    });
    if (!receivable) throw new AppError("Parcela não encontrada.");
    if (receivable.status !== "ABERTA") throw new AppError("Esta parcela não está aberta.");
    if (receivable.sale.status === "CANCELADA") throw new AppError("A venda desta parcela está cancelada.");

    await tx.receivable.update({
      where: { id },
      data: { status: "PAGA", paidAmount: receivable.amount, paidAt: new Date() },
    });
    await tx.cashEntry.create({
      data: {
        direction: "ENTRADA",
        amount: receivable.amount,
        description: `Recebimento ${receivable.number}/${receivable.sale.installmentCount} · venda ${String(receivable.sale.number).padStart(6, "0")} · ${receivable.sale.customer.name}`,
        receivableId: receivable.id,
      },
    });
  });
}

export async function createPayable(input: {
  description: string;
  category: string;
  dueDate: string;
  amount: string;
}) {
  const description = input.description.trim();
  if (description.length < 2) throw new AppError("Informe a descrição da conta.");
  const dueDate = parseIsoDate(input.dueDate);
  if (!dueDate) throw new AppError("Vencimento inválido.");
  const amount = parseMoney(input.amount);
  if (amount == null || amount <= 0) throw new AppError("Informe um valor válido.");
  const category = emptyToNull(input.category) ?? "Outros";

  const payable = await prisma.payable.create({
    data: { description, category, dueDate, amount },
  });
  return payable.id;
}

export async function payPayable(id: string) {
  await prisma.$transaction(async (tx) => {
    const payable = await tx.payable.findUnique({ where: { id } });
    if (!payable) throw new AppError("Conta não encontrada.");
    if (payable.status !== "ABERTA") throw new AppError("Esta conta não está aberta.");
    await tx.payable.update({
      where: { id },
      data: { status: "PAGA", paidAt: new Date() },
    });
    await tx.cashEntry.create({
      data: {
        direction: "SAIDA",
        amount: payable.amount,
        description: `Pagamento · ${payable.description}`,
        payableId: payable.id,
      },
    });
  });
}

export async function payCommission(id: string) {
  await prisma.$transaction(async (tx) => {
    const commission = await tx.commission.findUnique({
      where: { id },
      include: { sale: true, seller: true },
    });
    if (!commission) throw new AppError("Comissão não encontrada.");
    if (commission.status !== "ABERTA") throw new AppError("Esta comissão não está aberta.");
    if (commission.sale.status === "CANCELADA") throw new AppError("A venda desta comissão está cancelada.");
    if (commission.amount <= 0) throw new AppError("Esta comissão não tem valor a pagar.");

    await tx.commission.update({ where: { id }, data: { status: "PAGA" } });
    await tx.cashEntry.create({
      data: {
        direction: "SAIDA",
        amount: commission.amount,
        description: `Comissão · ${commission.seller.name} · venda ${String(commission.sale.number).padStart(6, "0")}`,
      },
    });
  });
}
