"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-6">
      <h1 className="font-serif text-3xl">Não foi possível abrir esta tela</h1>
      <p className="mt-2 text-sm text-muted">Confira se o banco está no ar e tente de novo.</p>
      <button type="button" onClick={reset} className="mt-4 h-10 rounded-lg bg-teal px-4 text-sm font-semibold text-white">
        Tentar de novo
      </button>
    </div>
  );
}
