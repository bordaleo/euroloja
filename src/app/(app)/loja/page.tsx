import { saveStoreAction } from "@/actions/app";
import { SubmitButton } from "@/components/submit-button";
import { Field, Flash, inputClass, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const store = await prisma.storeSettings.findUnique({ where: { id: "default" } });

  return (
    <div>
      <PageHeader eyebrow="Loja" title="Dados do pedido" />
      <Flash ok={query.ok} erro={query.erro} />
      <p className="mb-4 text-sm text-muted">Estes dados saem no cabeçalho impresso do pedido de venda.</p>
      <form action={saveStoreAction} className="grid gap-3 rounded-2xl border border-line bg-card p-5 md:grid-cols-2">
        <Field label="Razão social">
          <input name="legalName" defaultValue={store?.legalName ?? ""} className={inputClass} />
        </Field>
        <Field label="CNPJ">
          <input name="cnpj" defaultValue={store?.cnpj ?? ""} className={inputClass} />
        </Field>
        <Field label="Endereço">
          <input name="street" defaultValue={store?.street ?? ""} className={inputClass} />
        </Field>
        <Field label="CEP">
          <input name="cep" defaultValue={store?.cep ?? ""} className={inputClass} />
        </Field>
        <Field label="Bairro">
          <input name="district" defaultValue={store?.district ?? ""} className={inputClass} />
        </Field>
        <Field label="Cidade">
          <input name="city" defaultValue={store?.city ?? ""} className={inputClass} />
        </Field>
        <Field label="UF">
          <input name="state" defaultValue={store?.state ?? ""} className={inputClass} />
        </Field>
        <div className="flex items-end">
          <SubmitButton>Salvar loja</SubmitButton>
        </div>
      </form>
    </div>
  );
}
