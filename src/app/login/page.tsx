import { loginAction } from "@/actions/app";
import { SubmitButton } from "@/components/submit-button";
import { inputClass } from "@/components/ui";
import { prisma } from "@/lib/prisma";

const fieldClass = `${inputClass} h-12 text-base`;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const store = await prisma.storeSettings.findUnique({ where: { id: "default" } });

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col justify-between bg-teal px-8 py-12 text-white lg:px-14 lg:py-16">
        <div>
          <p className="text-sm font-semibold">Sistema Euro</p>
          <h1 className="mt-8 max-w-md text-4xl font-semibold leading-tight lg:text-5xl">Euro João Cachoeira</h1>
          <p className="mt-3 text-lg">Comércio de colchões</p>
        </div>
        {store ? (
          <address className="mt-12 text-base not-italic leading-7 text-white/90">
            <p>{store.street}</p>
            <p>{store.district}</p>
            <p>
              {store.city}/{store.state} · CEP {store.cep}
            </p>
            <p className="mt-4">CNPJ {store.cnpj}</p>
          </address>
        ) : null}
      </section>

      <section className="grid place-items-center px-6 py-12">
        <div className="w-full max-w-md rounded-xl border border-line bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold text-ink">Entrar</h2>
          <form action={loginAction} className="mt-6 grid gap-4">
            <label className="grid gap-1 text-base">
              <span className="font-medium text-ink">E-mail</span>
              <input name="email" type="email" autoComplete="username" className={fieldClass} required />
            </label>
            <label className="grid gap-1 text-base">
              <span className="font-medium text-ink">Senha</span>
              <input name="password" type="password" autoComplete="current-password" className={fieldClass} required />
            </label>
            {erro ? <p className="text-base font-medium text-danger">E-mail ou senha não conferem.</p> : null}
            <SubmitButton className="h-12 w-full text-base">Entrar</SubmitButton>
          </form>
          <div className="mt-6 border-t border-line pt-4 text-sm text-muted">
            <p>gerente@eurojoao.local</p>
            <p>vendedor@eurojoao.local</p>
            <p className="mt-1 text-ink">Senha: Euro@2026</p>
          </div>
        </div>
      </section>
    </main>
  );
}
