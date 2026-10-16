import { Prisma } from "@prisma/client";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { AppError } from "@/lib/errors";
import { addMonthsUtc, emptyToNull, parseIsoDate } from "@/lib/format";
import { productLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import type { CreateSaleInput } from "@/lib/types";

function uniqueMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = String(error.meta?.target ?? "");
    if (target.includes("cpf")) return "Já existe um cliente com este CPF.";
    if (target.includes("code")) return "Já existe um produto com este código.";
    if (target.includes("email")) return "Já existe um usuário com este e-mail.";
  }
  return null;
}

export async function createSale(input: CreateSaleInput) {
  const name = input.customer.name.trim();
  if (name.length < 2) throw new AppError("Informe o nome do cliente.");
  if (!input.lines.length) throw new AppError("Inclua ao menos um produto.");
  if (!Number.isInteger(input.installments) || input.installments < 1 || input.installments > 48) {
    throw new AppError("O número de parcelas deve ficar entre 1 e 48.");
  }
  if (!Number.isInteger(input.closedAmount) || input.closedAmount <= 0) {
    throw new AppError("O valor fechado precisa ser maior que zero.");
  }
  if (!Number.isInteger(input.freight) || input.freight < 0) throw new AppError("Frete inválido.");

  const cpfDigits = onlyDigits(input.customer.cpf ?? "");
  if (cpfDigits && !isValidCpf(cpfDigits)) throw new AppError("CPF inválido.");
  const cpf = cpfDigits || null;

  const firstDue = parseIsoDate(input.firstDueDate);
  if (!firstDue) throw new AppError("Informe o vencimento da primeira parcela.");
  const delivery = input.deliveryDate ? parseIsoDate(input.deliveryDate) : null;
  if (input.deliveryDate && !delivery) throw new AppError("Data de entrega inválida.");
  const birth = input.customer.birthDate ? parseIsoDate(input.customer.birthDate) : null;
  if (input.customer.birthDate && !birth) throw new AppError("Data de nascimento inválida.");

  const seller = await prisma.user.findFirst({ where: { id: input.sellerId, active: true } });
  if (!seller) throw new AppError("Vendedor inválido.");

  const merged = new Map<string, { productId: string; quantity: number; unitPrice: number }>();
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new AppError("Quantidade inválida.");
    if (!Number.isInteger(line.unitPrice) || line.unitPrice < 0) throw new AppError("Preço inválido.");
    const current = merged.get(line.productId);
    if (current) current.quantity += line.quantity;
    else merged.set(line.productId, { ...line });
  }

  const customerData = {
    name,
    cpf,
    birthDate: birth,
    phone: emptyToNull(input.customer.phone),
    cep: emptyToNull(input.customer.cep),
    street: emptyToNull(input.customer.street),
    complement: emptyToNull(input.customer.complement),
    neighborhood: emptyToNull(input.customer.neighborhood),
    city: emptyToNull(input.customer.city),
    state: emptyToNull(input.customer.state)?.toUpperCase() ?? null,
  };

  try {
    return await prisma.$transaction(async (tx) => {
      let customerId = input.customer.id || undefined;
      if (customerId) {
        const existing = await tx.customer.findUnique({ where: { id: customerId } });
        if (!existing) throw new AppError("Cliente não encontrado.");
        await tx.customer.update({ where: { id: customerId }, data: customerData });
      } else if (cpf) {
        const existing = await tx.customer.findUnique({ where: { cpf } });
        if (existing) {
          customerId = existing.id;
          await tx.customer.update({ where: { id: existing.id }, data: customerData });
        }
      }

      if (!customerId) {
        const created = await tx.customer.create({ data: customerData });
        customerId = created.id;
      }

      const products = await tx.product.findMany({
        where: { id: { in: [...merged.keys()] }, active: true },
      });
      if (products.length !== merged.size) throw new AppError("Há produto inativo ou inexistente na venda.");

      const prepared = products.map((product) => {
        const line = merged.get(product.id)!;
        return {
          product,
          line,
          total: line.quantity * line.unitPrice,
        };
      });
      const itemsTotal = prepared.reduce((sum, item) => sum + item.total, 0);

      for (const item of prepared) {
        const updated = await tx.$executeRaw`
          UPDATE "products"
          SET "reservedQty" = "reservedQty" + ${item.line.quantity}
          WHERE "id" = ${item.product.id}
            AND ("stockQty" - "reservedQty") >= ${item.line.quantity}
        `;
        if (Number(updated) !== 1) {
          const available = item.product.stockQty - item.product.reservedQty;
          throw new AppError(
            `Estoque insuficiente para ${item.product.code}. Disponível: ${available}.`,
          );
        }
      }

      const seq = await tx.sequence.update({
        where: { id: "sale" },
        data: { value: { increment: 1 } },
      });

      const sale = await tx.sale.create({
        data: {
          number: seq.value,
          sellerId: seller.id,
          customerId,
          itemsTotal,
          freight: input.freight,
          closedAmount: input.closedAmount,
          installmentCount: input.installments,
          firstDueDate: firstDue,
          deliveryDate: delivery,
          notes: emptyToNull(input.notes),
          status: "FATURADA",
          items: {
            create: prepared.map((item) => ({
              productId: item.product.id,
              code: item.product.code,
              description: productLabel(item.product),
              quantity: item.line.quantity,
              unitPrice: item.line.unitPrice,
              unitCost: item.product.costPrice,
              total: item.total,
            })),
          },
        },
      });

      await tx.stockMovement.createMany({
        data: prepared.map((item) => ({
          productId: item.product.id,
          type: "RESERVA" as const,
          quantity: item.line.quantity,
          note: `Reserva da venda ${String(sale.number).padStart(6, "0")}`,
          saleId: sale.id,
        })),
      });

      const base = Math.floor(input.closedAmount / input.installments);
      const amounts = Array.from({ length: input.installments }, (_, index) =>
        index === input.installments - 1
          ? input.closedAmount - base * (input.installments - 1)
          : base,
      );
      await tx.receivable.createMany({
        data: amounts.map((amount, index) => ({
          saleId: sale.id,
          number: index + 1,
          dueDate: addMonthsUtc(firstDue, index),
          amount,
        })),
      });

      await tx.commission.create({
        data: {
          saleId: sale.id,
          sellerId: seller.id,
          bps: seller.commissionBps,
          baseAmount: input.closedAmount,
          amount: Math.round((input.closedAmount * seller.commissionBps) / 10000),
        },
      });

      return sale.id;
    });
  } catch (error) {
    const message = uniqueMessage(error);
    if (message) throw new AppError(message);
    throw error;
  }
}

export async function deliverSale(saleId: string) {
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: saleId }, include: { items: true } });
    if (!sale) throw new AppError("Venda não encontrada.");
    if (sale.status !== "FATURADA") throw new AppError("Só uma venda faturada pode ser entregue.");

    for (const item of sale.items) {
      const updated = await tx.$executeRaw`
        UPDATE "products"
        SET "stockQty" = "stockQty" - ${item.quantity},
            "reservedQty" = "reservedQty" - ${item.quantity}
        WHERE "id" = ${item.productId}
          AND "stockQty" >= ${item.quantity}
          AND "reservedQty" >= ${item.quantity}
      `;
      if (Number(updated) !== 1) {
        throw new AppError(`Não foi possível baixar o estoque de ${item.code}.`);
      }
    }

    await tx.stockMovement.createMany({
      data: sale.items.map((item) => ({
        productId: item.productId,
        type: "SAIDA" as const,
        quantity: item.quantity,
        note: `Entrega da venda ${String(sale.number).padStart(6, "0")}`,
        saleId: sale.id,
      })),
    });

    await tx.sale.update({
      where: { id: sale.id },
      data: { status: "ENTREGUE", deliveredAt: new Date() },
    });
  });
}

export async function cancelSale(saleId: string) {
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: { items: true, receivables: true },
    });
    if (!sale) throw new AppError("Venda não encontrada.");
    if (sale.status === "CANCELADA") throw new AppError("Esta venda já está cancelada.");
    if (sale.receivables.some((item) => item.status === "PAGA")) {
      throw new AppError("Estorne os recebimentos antes de cancelar a venda.");
    }

    for (const item of sale.items) {
      if (sale.status === "FATURADA") {
        const updated = await tx.$executeRaw`
          UPDATE "products"
          SET "reservedQty" = "reservedQty" - ${item.quantity}
          WHERE "id" = ${item.productId}
            AND "reservedQty" >= ${item.quantity}
        `;
        if (Number(updated) !== 1) throw new AppError(`Não foi possível liberar a reserva de ${item.code}.`);
      } else {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: item.quantity } },
        });
      }
    }

    await tx.stockMovement.createMany({
      data: sale.items.map((item) => ({
        productId: item.productId,
        type: sale.status === "FATURADA" ? ("LIBERACAO" as const) : ("ENTRADA" as const),
        quantity: item.quantity,
        note: `Cancelamento da venda ${String(sale.number).padStart(6, "0")}`,
        saleId: sale.id,
      })),
    });

    await tx.receivable.updateMany({
      where: { saleId: sale.id, status: "ABERTA" },
      data: { status: "CANCELADA" },
    });
    await tx.commission.updateMany({
      where: { saleId: sale.id },
      data: { status: "CANCELADA" },
    });
    await tx.sale.update({
      where: { id: sale.id },
      data: { status: "CANCELADA", cancelledAt: new Date() },
    });
  });
}
