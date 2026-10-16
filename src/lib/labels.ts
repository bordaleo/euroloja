export const saleStatusLabel = {
  FATURADA: "Faturada",
  ENTREGUE: "Entregue",
  CANCELADA: "Cancelada",
} as const;

export const payStatusLabel = {
  ABERTA: "Aberta",
  PAGA: "Paga",
  CANCELADA: "Cancelada",
} as const;

export const stockTypeLabel = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  AJUSTE: "Ajuste",
  RESERVA: "Reserva",
  LIBERACAO: "Liberação",
} as const;

export const categories = ["Colchão", "Base", "Travesseiro", "Protetor", "Jogo de cama", "Outros"];

export function productLabel(product: { name: string; size: string | null; density: string | null }) {
  const extra = [product.size, product.density].filter(Boolean).join(" · ");
  return extra ? `${product.name} (${extra})` : product.name;
}
