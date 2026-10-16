import type { ReactNode } from "react";

export const inputClass =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/20";

export const actionClass =
  "inline-flex h-10 items-center justify-center rounded-lg bg-teal px-4 text-sm font-semibold text-white transition hover:bg-teal-2 disabled:opacity-60";

export const selectClass = inputClass;

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">{eyebrow}</p> : null}
        <h1 className="font-serif text-3xl text-ink">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Flash({ ok, erro }: { ok?: string; erro?: string }) {
  if (erro) {
    return <p className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{erro}</p>;
  }
  if (!ok) return null;
  const text =
    ok === "entrega"
      ? "Entrega confirmada e estoque baixado."
      : ok === "cancelada"
        ? "Venda cancelada e reserva liberada."
        : ok === "recebido"
          ? "Parcela recebida e lançada no caixa."
          : ok === "pago"
            ? "Pagamento lançado no caixa."
            : ok === "comissao"
              ? "Comissão paga e lançada no caixa."
              : ok.includes("-")
                ? `Importação concluída: ${ok.split("-")[0]} novos e ${ok.split("-")[1]} atualizados.`
                : "Registro salvo.";
  return <p className="mb-4 rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">{text}</p>;
}

export function Badge({
  tone,
  children,
}: {
  tone: "teal" | "ok" | "danger" | "muted" | "brass";
  children: ReactNode;
}) {
  const tones = {
    teal: "bg-teal/10 text-teal",
    ok: "bg-ok/10 text-ok",
    danger: "bg-danger/10 text-danger",
    muted: "bg-[#e7eef5] text-ink",
    brass: "bg-brass/10 text-brass",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
