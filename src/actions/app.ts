"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { AppError } from "@/lib/errors";
import { clearSession, createSession, requireAdmin, requireUser, toSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult, CreateSaleInput } from "@/lib/types";
import { importProductRows, moveStock, saveCustomer, saveProduct, saveStore, saveUser } from "@/server/catalog";
import { readXlsx } from "@/server/spreadsheet";
import { createPayable, payCommission, payPayable, receiveInstallment } from "@/server/finance";
import { cancelSale, createSale, deliverSale } from "@/server/sales";

function messageFrom(error: unknown, fallback: string) {
  return error instanceof AppError ? error.message : fallback;
}

function withQuery(path: string, key: string, value: string) {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}${key}=${encodeURIComponent(value)}`;
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/vendas");
  revalidatePath("/produtos");
  revalidatePath("/clientes");
  revalidatePath("/estoque");
  revalidatePath("/financeiro");
  revalidatePath("/relatorios");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.active || !(await bcrypt.compare(password, user.passwordHash))) {
    redirect("/login?erro=1");
  }
  await createSession(toSessionUser(user));
  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function createSaleAction(input: CreateSaleInput): Promise<ActionResult> {
  await requireUser();
  try {
    const id = await createSale(input);
    refresh();
    revalidatePath(`/vendas/${id}`);
    return { ok: true, id };
  } catch (error) {
    return { ok: false, message: messageFrom(error, "Não foi possível faturar a venda.") };
  }
}

export async function deliverAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  try {
    await deliverSale(id);
  } catch (error) {
    redirect(`/vendas/${id}?erro=${encodeURIComponent(messageFrom(error, "Não foi possível confirmar a entrega."))}`);
  }
  refresh();
  revalidatePath(`/vendas/${id}`);
  redirect(`/vendas/${id}?ok=entrega`);
}

export async function cancelAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  try {
    await cancelSale(id);
  } catch (error) {
    redirect(`/vendas/${id}?erro=${encodeURIComponent(messageFrom(error, "Não foi possível cancelar a venda."))}`);
  }
  refresh();
  revalidatePath(`/vendas/${id}`);
  redirect(`/vendas/${id}?ok=cancelada`);
}

export async function receiveAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const saleId = String(formData.get("saleId") ?? "");
  const back = String(formData.get("back") ?? (saleId ? `/vendas/${saleId}` : "/financeiro"));
  try {
    await receiveInstallment(id);
  } catch (error) {
    redirect(withQuery(back, "erro", messageFrom(error, "Não foi possível receber a parcela.")));
  }
  refresh();
  if (saleId) revalidatePath(`/vendas/${saleId}`);
  redirect(withQuery(back, "ok", "recebido"));
}

export async function payableAction(formData: FormData) {
  await requireAdmin();
  try {
    await createPayable({
      description: String(formData.get("description") ?? ""),
      category: String(formData.get("category") ?? ""),
      dueDate: String(formData.get("dueDate") ?? ""),
      amount: String(formData.get("amount") ?? ""),
    });
  } catch (error) {
    redirect(`/financeiro?aba=pagar&erro=${encodeURIComponent(messageFrom(error, "Não foi possível lançar a conta."))}`);
  }
  refresh();
  redirect("/financeiro?aba=pagar&ok=1");
}

export async function payPayableAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  try {
    await payPayable(id);
  } catch (error) {
    redirect(`/financeiro?aba=pagar&erro=${encodeURIComponent(messageFrom(error, "Não foi possível pagar a conta."))}`);
  }
  refresh();
  redirect("/financeiro?aba=pagar&ok=pago");
}

export async function payCommissionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const saleId = String(formData.get("saleId") ?? "");
  const back = saleId ? `/vendas/${saleId}` : "/relatorios";
  try {
    await payCommission(id);
  } catch (error) {
    redirect(`${back}?erro=${encodeURIComponent(messageFrom(error, "Não foi possível pagar a comissão."))}`);
  }
  refresh();
  if (saleId) revalidatePath(`/vendas/${saleId}`);
  redirect(`${back}?ok=comissao`);
}

export async function saveProductAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "") || undefined;
  const activeValues = formData.getAll("active");
  let saved = "";
  try {
    saved = await saveProduct({
      id,
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      category: String(formData.get("category") ?? ""),
      size: String(formData.get("size") ?? ""),
      density: String(formData.get("density") ?? ""),
      unitPrice: String(formData.get("unitPrice") ?? ""),
      costPrice: String(formData.get("costPrice") ?? ""),
      stockQty: String(formData.get("stockQty") ?? ""),
      minStock: String(formData.get("minStock") ?? ""),
      active: activeValues.length ? activeValues.includes("on") : true,
      keepCost: user.role !== "ADMIN",
    });
  } catch (error) {
    if (error instanceof AppError) {
      redirect(`${id ? `/produtos/${id}` : "/produtos"}?erro=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  refresh();
  redirect(`/produtos/${saved}?ok=1`);
}

export async function importProductsAction(formData: FormData) {
  await requireUser();
  const file = formData.get("file");
  let result = { created: 0, updated: 0 };
  try {
    if (!(file instanceof File) || file.size === 0) throw new AppError("Escolha a planilha de produtos.");
    const name = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let rows: string[][];
    if (name.endsWith(".xlsx")) {
      rows = await readXlsx(buffer);
    } else if (name.endsWith(".csv") || name.endsWith(".txt")) {
      rows = buffer
        .toString("utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const separator = line.split(";").length > line.split(",").length ? ";" : ",";
          return line.split(separator).map((column) => column.trim());
        });
    } else {
      throw new AppError("Envie um arquivo .xlsx ou .csv. No Excel, use Salvar como pasta de trabalho do Excel.");
    }
    result = await importProductRows(rows, {
      updateCost: formData.get("updateCost") === "on",
      replaceStock: formData.get("replaceStock") === "on",
    });
  } catch (error) {
    redirect(`/produtos?erro=${encodeURIComponent(messageFrom(error, "Não foi possível importar a planilha."))}`);
  }
  refresh();
  redirect(`/produtos?ok=${result.created}-${result.updated}`);
}

export async function stockAction(formData: FormData) {
  await requireAdmin();
  try {
    await moveStock({
      productId: String(formData.get("productId") ?? ""),
      mode: String(formData.get("mode") ?? ""),
      quantity: String(formData.get("quantity") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
  } catch (error) {
    redirect(`/estoque?erro=${encodeURIComponent(messageFrom(error, "Não foi possível movimentar o estoque."))}`);
  }
  refresh();
  redirect("/estoque?ok=1");
}

export async function saveCustomerAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "") || undefined;
  let saved = "";
  try {
    saved = await saveCustomer({
      id,
      name: String(formData.get("name") ?? ""),
      cpf: String(formData.get("cpf") ?? ""),
      birthDate: String(formData.get("birthDate") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      cep: String(formData.get("cep") ?? ""),
      street: String(formData.get("street") ?? ""),
      complement: String(formData.get("complement") ?? ""),
      neighborhood: String(formData.get("neighborhood") ?? ""),
      city: String(formData.get("city") ?? ""),
      state: String(formData.get("state") ?? ""),
    });
  } catch (error) {
    if (error instanceof AppError) {
      redirect(`${id ? `/clientes/${id}` : "/clientes"}?erro=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  refresh();
  redirect(`/clientes/${saved}?ok=1`);
}

export async function saveUserAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = String(formData.get("id") ?? "") || undefined;
  try {
    await saveUser(
      {
        id,
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        role: String(formData.get("role") ?? ""),
        commission: String(formData.get("commission") ?? ""),
        active: formData.getAll("active").includes("on") || formData.getAll("active").length === 0,
      },
      actor.id,
    );
  } catch (error) {
    redirect(`/vendedores?erro=${encodeURIComponent(messageFrom(error, "Não foi possível salvar o usuário."))}`);
  }
  revalidatePath("/vendedores");
  redirect("/vendedores?ok=1");
}

export async function saveStoreAction(formData: FormData) {
  await requireAdmin();
  try {
    await saveStore({
      legalName: String(formData.get("legalName") ?? ""),
      cnpj: String(formData.get("cnpj") ?? ""),
      street: String(formData.get("street") ?? ""),
      cep: String(formData.get("cep") ?? ""),
      district: String(formData.get("district") ?? ""),
      city: String(formData.get("city") ?? ""),
      state: String(formData.get("state") ?? ""),
    });
  } catch (error) {
    redirect(`/loja?erro=${encodeURIComponent(messageFrom(error, "Não foi possível salvar a loja."))}`);
  }
  revalidatePath("/loja");
  redirect("/loja?ok=1");
}
