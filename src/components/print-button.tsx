"use client";

import { useEffect } from "react";

export function PrintButton({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const timer = setTimeout(() => window.print(), 500);
    return () => clearTimeout(timer);
  }, [auto]);

  return (
    <button type="button" onClick={() => window.print()} className="h-12 rounded-lg bg-teal px-6 text-base font-semibold text-white">
      Imprimir nota
    </button>
  );
}
