export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "VENDEDOR";
};

export type CustomerInput = {
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
};

export type SaleLineInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export type CreateSaleInput = {
  customer: CustomerInput;
  sellerId: string;
  lines: SaleLineInput[];
  freight: number;
  closedAmount: number;
  installments: number;
  firstDueDate: string;
  deliveryDate?: string;
  notes?: string;
};

export type ActionResult = { ok: true; id?: string } | { ok: false; message: string };
