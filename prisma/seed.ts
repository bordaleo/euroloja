import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const products = [
  ["MOLAS-QUEEN", "Colchão Molas Ensacadas Queen", "Colchão", "158x198", "D45", 329900, 168000, 6, 2],
  ["MOLAS-KING", "Colchão Molas Ensacadas King", "Colchão", "193x203", "D45", 419900, 214000, 3, 1],
  ["ORTO-CASAL", "Colchão Ortopédico Casal", "Colchão", "138x188", "D33", 189900, 91000, 8, 2],
  ["ESPUMA-SOLT", "Colchão Espuma Solteiro", "Colchão", "88x188", "D28", 89900, 42000, 5, 2],
  ["BOX-QUEEN", "Base Box Baú Queen", "Base", "158x198", "", 149900, 76000, 4, 1],
  ["TRAV-LATEX", "Travesseiro Látex Alto", "Travesseiro", "", "", 19900, 7000, 24, 6],
  ["PROT-QUEEN", "Protetor Impermeável Queen", "Protetor", "158x198", "", 14900, 5200, 18, 4],
  ["JOGO-QUEEN", "Jogo de Cama Queen 300 fios", "Jogo de cama", "Queen", "", 34900, 14000, 10, 3],
] as const;

async function main() {
  const passwordHash = await bcrypt.hash("Euro@2026", 10);

  await prisma.user.upsert({
    where: { email: "gerente@eurojoao.local" },
    update: {},
    create: {
      name: "Gerência",
      email: "gerente@eurojoao.local",
      passwordHash,
      role: "ADMIN",
      commissionBps: 0,
    },
  });

  await prisma.user.upsert({
    where: { email: "vendedor@eurojoao.local" },
    update: {},
    create: {
      name: "Vendedor Salão",
      email: "vendedor@eurojoao.local",
      passwordHash,
      role: "VENDEDOR",
      commissionBps: 300,
    },
  });

  await prisma.storeSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      legalName: "EURO JOAO CACHOEIRA COMERCIO DE COLCHOES LTDA",
      cnpj: "68.795.807/0001-00",
      street: "R TABAPUA, 798",
      cep: "04.533-003",
      district: "ITAIM BIBI",
      city: "SAO PAULO",
      state: "SP",
    },
  });

  await prisma.sequence.upsert({
    where: { id: "sale" },
    update: {},
    create: { id: "sale", value: 0 },
  });

  for (const [code, name, category, size, density, unitPrice, costPrice, stockQty, minStock] of products) {
    const existing = await prisma.product.findUnique({ where: { code } });
    if (existing) continue;
    const product = await prisma.product.create({
      data: {
        code,
        name,
        category,
        size: size || null,
        density: density || null,
        unitPrice,
        costPrice,
        stockQty,
        minStock,
      },
    });
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: "ENTRADA",
        quantity: stockQty,
        note: "Estoque inicial",
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
