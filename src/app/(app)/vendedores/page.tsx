import { saveUserAction } from "@/actions/app";
import { SubmitButton } from "@/components/submit-button";
import { Field, Flash, inputClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { centsToInput, formatPercent } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const fieldClass = `${inputClass} h-12 text-base`;

function roleLabel(role: string) {
  return role === "ADMIN" ? "Administrador" : "Vendedor";
}

export default async function SellersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const actor = await requireAdmin();
  const query = await searchParams;
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { sales: true } } },
  });

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <div>
        <h1 className="text-3xl font-semibold text-ink">Vendedores</h1>
        <p className="mt-1 text-base text-muted">Quem entra no sistema e a comissão de cada um.</p>
      </div>
      <Flash ok={query.ok} erro={query.erro} />

      <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-ink">Novo vendedor</h2>
        <form action={saveUserAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Nome">
            <input name="name" className={fieldClass} required />
          </Field>
          <Field label="E-mail">
            <input name="email" type="email" autoComplete="off" className={fieldClass} required />
          </Field>
          <Field label="Senha" hint="Mínimo de 6 caracteres. A pessoa usa este e-mail para entrar.">
            <input name="password" type="password" autoComplete="new-password" className={fieldClass} required />
          </Field>
          <Field label="Comissão %" hint="Ex.: 3,00 é 3% sobre o valor fechado da venda.">
            <input name="commission" defaultValue="3,00" className={fieldClass} />
          </Field>
          <Field label="Perfil">
            <select name="role" className={fieldClass} defaultValue="VENDEDOR">
              <option value="VENDEDOR">Vendedor</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </Field>
          <div className="flex items-end">
            <SubmitButton>Cadastrar vendedor</SubmitButton>
          </div>
        </form>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold text-ink">Equipe</h2>
        {users.map((user) => (
          <article key={user.id} className="rounded-xl border border-line bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div>
                <h3 className="text-xl font-semibold text-ink">
                  {user.name}
                  {user.id === actor.id ? <span className="ml-2 text-sm font-medium text-muted">você</span> : null}
                </h3>
                <p className="text-base text-muted">{user.email}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm font-semibold">
                <span className="rounded-lg bg-[#e7eef5] px-3 py-2 text-ink">{roleLabel(user.role)}</span>
                <span className="rounded-lg bg-[#e7eef5] px-3 py-2 text-ink">{formatPercent(user.commissionBps)}</span>
                <span className="rounded-lg bg-[#e7eef5] px-3 py-2 text-ink">
                  {user._count.sales} {user._count.sales === 1 ? "pedido" : "pedidos"}
                </span>
                <span className={`rounded-lg px-3 py-2 ${user.active ? "bg-[#e7f6ef] text-ok" : "bg-[#fdecea] text-danger"}`}>
                  {user.active ? "Acesso ativo" : "Sem acesso"}
                </span>
              </div>
            </div>
            <details className="border-t border-line">
              <summary className="cursor-pointer px-5 py-3 text-base font-semibold text-teal">Alterar dados</summary>
              <form action={saveUserAction} className="grid gap-4 px-5 pt-2 pb-5 md:grid-cols-2">
                <input type="hidden" name="id" value={user.id} />
                <Field label="Nome">
                  <input name="name" defaultValue={user.name} className={fieldClass} required />
                </Field>
                <Field label="E-mail">
                  <input name="email" type="email" defaultValue={user.email} className={fieldClass} required />
                </Field>
                <Field label="Nova senha" hint="Deixe em branco para manter a senha atual.">
                  <input name="password" type="password" autoComplete="new-password" className={fieldClass} />
                </Field>
                <Field label="Comissão %">
                  <input name="commission" defaultValue={centsToInput(user.commissionBps)} className={fieldClass} />
                </Field>
                <Field label="Perfil">
                  <select name="role" defaultValue={user.role} className={fieldClass}>
                    <option value="VENDEDOR">Vendedor</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </Field>
                <label className="flex items-center gap-3 self-end rounded-lg border border-line px-4 py-3 text-base text-ink">
                  <input type="hidden" name="active" value="off" />
                  <input type="checkbox" name="active" value="on" defaultChecked={user.active} className="h-5 w-5" />
                  Pode entrar no sistema
                </label>
                <div className="md:col-span-2">
                  <SubmitButton>Salvar alterações</SubmitButton>
                </div>
              </form>
            </details>
          </article>
        ))}
      </section>
    </div>
  );
}
