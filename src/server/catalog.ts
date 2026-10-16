import { Prisma } from "@prisma/client";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { AppError } from "@/lib/errors";
import { emptyToNull, parseIsoDate, parseMoney, parsePercent } from "@/lib/format";
import { prisma } from "@/lib/prisma";

function uniqueMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = String(error.meta?.target ?? "");
    if (target.includes("cpf")) return "Já existe um cliente com este CPF.";
    if (target.includes("code")) return "Já existe um produto com este código.";
    if (target.includes("email")) return "Já existe um usuário com este e-mail.";
  }
  return null;
}

export async function saveProduct(input: {
  id?: string;
  code: string;
  name: string;
  category: string;
  size?: string;
  density?: string;
  unitPrice: string;
  costPrice?: string;
  stockQty?: string;
  minStock?: string;
  active?: boolean;
  keepCost?: boolean;
}) {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (code.length < 2) throw new AppError("Informe o código do produto.");
  if (name.length < 2) throw new AppError("Informe a descrição do produto.");
  const unitPrice = parseMoney(input.unitPrice);
  if (unitPrice == null) throw new AppError("Preço de venda inválido.");
  const costPrice = input.keepCost ? undefined : parseMoney(input.costPrice || "0");
  if (costPrice != null && costPrice < 0) throw new AppError("Custo inválido.");
  const minStock = Number(input.minStock || "0");
  if (!Number.isInteger(minStock) || minStock < 0) throw new AppError("Estoque mínimo inválido.");

  const data = {
    code,
    name,
    category: emptyToNull(input.category) ?? "Outros",
    size: emptyToNull(input.size),
    density: emptyToNull(input.density),
    unitPrice,
    minStock,
    active: input.active ?? true,
    ...(costPrice == null ? {} : { costPrice }),
  };

  try {
    if (input.id) {
      await prisma.product.update({ where: { id: input.id }, data });
      return input.id;
    }
    const stockQty = Number(input.stockQty || "0");
    if (!Number.isInteger(stockQty) || stockQty < 0) throw new AppError("Estoque inicial inválido.");
    const product = await prisma.product.create({ data: { ...data, costPrice: costPrice ?? 0, stockQty } });
    if (stockQty > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          type: "ENTRADA",
          quantity: stockQty,
          note: "Estoque inicial",
        },
      });
    }
    return product.id;
  } catch (error) {
    const message = uniqueMessage(error);
    if (message) throw new AppError(message);
    throw error;
  }
}

function plainHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const headerFields = {
  code: ["codigo", "cod", "sku", "ref", "referencia"],
  name: ["descricao", "produto", "nome", "item"],
  category: ["categoria", "grupo"],
  price: ["preco", "preco de venda", "preco venda", "valor", "venda"],
  cost: ["custo", "preco de custo"],
  stock: ["estoque", "quantidade", "qtd", "saldo"],
  min: ["minimo", "estoque minimo"],
  size: ["medida", "tamanho", "dimensao"],
  density: ["densidade"],
} as const;

function columnIndex(header: string[], names: readonly string[]) {
  return header.findIndex((cell) => names.includes(cell));
}

export async function importProductRows(
  rows: string[][],
  options: { updateCost: boolean; replaceStock: boolean },
) {
  if (!rows.length) throw new AppError("A planilha está vazia.");
  const header = rows[0].map(plainHeader);
  const hasHeader = header.some((cell) => headerFields.code.includes(cell as (typeof headerFields.code)[number]) || headerFields.name.includes(cell as (typeof headerFields.name)[number]));
  const index = hasHeader
    ? {
        code: columnIndex(header, headerFields.code),
        name: columnIndex(header, headerFields.name),
        category: columnIndex(header, headerFields.category),
        price: columnIndex(header, headerFields.price),
        cost: columnIndex(header, headerFields.cost),
        stock: columnIndex(header, headerFields.stock),
        min: columnIndex(header, headerFields.min),
        size: columnIndex(header, headerFields.size),
        density: columnIndex(header, headerFields.density),
      }
    : { code: 0, name: 1, category: 2, price: 3, cost: 4, stock: 5, min: 6, size: 7, density: 8 };

  if (hasHeader && (index.code < 0 || index.name < 0)) {
    throw new AppError("A planilha precisa das colunas codigo e descricao.");
  }

  const dataRows = hasHeader ? rows.slice(1) : rows;
  let created = 0;
  let updated = 0;
  const cell = (row: string[], position: number) => (position >= 0 ? row[position]?.trim() ?? "" : "");

  for (const [offset, row] of dataRows.entries()) {
    const line = offset + (hasHeader ? 2 : 1);
    const code = cell(row, index.code);
    const name = cell(row, index.name);
    if (!code && !name) continue;
    if (!code || !name) throw new AppError(`Linha ${line}: código e descrição são obrigatórios.`);

    const existing = await prisma.product.findUnique({ where: { code: code.toUpperCase() } });
    const stock = cell(row, index.stock);
    const saved = await saveProduct({
      id: existing?.id,
      code,
      name,
      category: cell(row, index.category) || "Outros",
      unitPrice: cell(row, index.price) || "0",
      costPrice: options.updateCost || !existing ? cell(row, index.cost) || "0" : undefined,
      keepCost: Boolean(existing) && !options.updateCost,
      stockQty: existing ? undefined : stock || "0",
      minStock: cell(row, index.min) || "0",
      size: cell(row, index.size),
      density: cell(row, index.density),
      active: true,
    });

    if (existing && options.replaceStock && stock !== "") {
      const quantity = Number(stock.replace(/\./g, "").replace(",", "."));
      if (!Number.isInteger(quantity) || quantity < 0) {
        throw new AppError(`Linha ${line}: estoque inválido.`);
      }
      if (quantity < existing.reservedQty) {
        throw new AppError(`Linha ${line}: o estoque da planilha é menor do que o já reservado em vendas.`);
      }
      const delta = quantity - existing.stockQty;
      await prisma.product.update({ where: { id: saved }, data: { stockQty: quantity } });
      if (delta !== 0) {
        await prisma.stockMovement.create({
          data: { productId: saved, type: "AJUSTE", quantity: delta, note: "Estoque da planilha" },
        });
      }
    }

    if (existing) updated += 1;
    else created += 1;
  }

  if (created + updated === 0) throw new AppError("Nenhum produto foi encontrado na planilha.");
  return { created, updated };
}

export async function moveStock(input: { productId: string; mode: string; quantity: string; note?: string }) {
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 0) throw new AppError("Quantidade inválida.");
  const note = emptyToNull(input.note) ?? (input.mode === "AJUSTE" ? "Contagem de estoque" : "Entrada de mercadoria");

  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new AppError("Produto não encontrado.");

    if (input.mode === "AJUSTE") {
      if (quantity < product.reservedQty) {
        throw new AppError("A contagem não pode ficar abaixo do que já está reservado em vendas.");
      }
      const delta = quantity - product.stockQty;
      await tx.product.update({ where: { id: product.id }, data: { stockQty: quantity } });
      await tx.stockMovement.create({
        data: { productId: product.id, type: "AJUSTE", quantity: delta, note },
      });
      return;
    }

    if (quantity <= 0) throw new AppError("Informe a quantidade da entrada.");
    await tx.product.update({
      where: { id: product.id },
      data: { stockQty: { increment: quantity } },
    });
    await tx.stockMovement.create({
      data: { productId: product.id, type: "ENTRADA", quantity, note },
    });
  });
}

export async function saveCustomer(input: {
  id?: string;
  name: string;
  cpf?: string;
  birthDate?: string;
  phone?: string;
  cep?: string;
  street?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}) {
  const name = input.name.trim();
  if (name.length < 2) throw new AppError("Informe o nome do cliente.");
  const cpfDigits = onlyDigits(input.cpf ?? "");
  if (cpfDigits && !isValidCpf(cpfDigits)) throw new AppError("CPF inválido.");
  const birthDate = input.birthDate ? parseIsoDate(input.birthDate) : null;
  if (input.birthDate && !birthDate) throw new AppError("Data de nascimento inválida.");

  const data = {
    name,
    cpf: cpfDigits || null,
    birthDate,
    phone: emptyToNull(input.phone),
    cep: emptyToNull(input.cep),
    street: emptyToNull(input.street),
    complement: emptyToNull(input.complement),
    neighborhood: emptyToNull(input.neighborhood),
    city: emptyToNull(input.city),
    state: emptyToNull(input.state)?.toUpperCase() ?? null,
  };

  try {
    if (input.id) {
      await prisma.customer.update({ where: { id: input.id }, data });
      return input.id;
    }
    const customer = await prisma.customer.create({ data });
    return customer.id;
  } catch (error) {
    const message = uniqueMessage(error);
    if (message) throw new AppError(message);
    throw error;
  }
}

export async function saveUser(
  input: {
    id?: string;
    name: string;
    email: string;
    password?: string;
    role: string;
    commission: string;
    active?: boolean;
  },
  actorId: string,
) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2) throw new AppError("Informe o nome.");
  if (!email.includes("@")) throw new AppError("E-mail inválido.");
  if (input.role !== "ADMIN" && input.role !== "VENDEDOR") throw new AppError("Perfil inválido.");
  const commissionBps = parsePercent(input.commission || "0");
  if (commissionBps == null) throw new AppError("Comissão inválida.");

  const bcrypt = await import("bcryptjs");

  try {
    if (!input.id) {
      if (!input.password || input.password.length < 6) throw new AppError("A senha precisa ter ao menos 6 caracteres.");
      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: await bcrypt.hash(input.password, 10),
          role: input.role,
          commissionBps,
          active: true,
        },
      });
      return user.id;
    }

    if (input.id === actorId && input.active === false) {
      throw new AppError("Você não pode desativar o próprio acesso.");
    }

    if (input.role !== "ADMIN" || input.active === false) {
      const admins = await prisma.user.count({
        where: { role: "ADMIN", active: true, id: { not: input.id } },
      });
      const current = await prisma.user.findUnique({ where: { id: input.id } });
      if (current?.role === "ADMIN" && current.active && admins === 0) {
        throw new AppError("Mantenha ao menos um administrador ativo.");
      }
    }

    await prisma.user.update({
      where: { id: input.id },
      data: {
        name,
        email,
        role: input.role,
        commissionBps,
        active: input.active ?? true,
        ...(input.password
          ? { passwordHash: await bcrypt.hash(input.password, 10) }
          : {}),
      },
    });
    return input.id;
  } catch (error) {
    const message = uniqueMessage(error);
    if (message) throw new AppError(message);
    throw error;
  }
}

export async function saveStore(input: {
  legalName: string;
  cnpj: string;
  street: string;
  cep: string;
  district: string;
  city: string;
  state: string;
}) {
  if (input.legalName.trim().length < 3) throw new AppError("Informe a razão social.");
  await prisma.storeSettings.upsert({
    where: { id: "default" },
    update: {
      legalName: input.legalName.trim(),
      cnpj: input.cnpj.trim(),
      street: input.street.trim(),
      cep: input.cep.trim(),
      district: input.district.trim(),
      city: input.city.trim(),
      state: input.state.trim().toUpperCase(),
    },
    create: {
      id: "default",
      legalName: input.legalName.trim(),
      cnpj: input.cnpj.trim(),
      street: input.street.trim(),
      cep: input.cep.trim(),
      district: input.district.trim(),
      city: input.city.trim(),
      state: input.state.trim().toUpperCase(),
    },
  });
}
