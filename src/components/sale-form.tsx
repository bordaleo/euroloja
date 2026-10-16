"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSaleAction } from "@/actions/app";
import { formatCep, onlyDigits } from "@/lib/cpf";
import { addDaysIso, addMonthsUtc, centsToInput, formatDate, formatMoney, parseIsoDate, parseMoney } from "@/lib/format";
import { productLabel } from "@/lib/labels";
import { Field, inputClass } from "@/components/ui";

type ProductOption = {
  id: string;
  code: string;
  name: string;
  category: string;
  size: string | null;
  density: string | null;
  unitPrice: number;
  available: number;
};

type CustomerOption = {
  id: string;
  name: string;
  cpf: string | null;
  birthDate: string | null;
  phone: string | null;
  cep: string | null;
  street: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
};

type Line = {
  key: string;
  productId: string;
  code: string;
  description: string;
  quantity: number;
  priceInput: string;
  available: number;
};

const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const parcelPresets = [1, 3, 6, 10, 12];
const discounts = [0, 5, 10, 15];

export function SaleForm({
  products,
  customers,
  sellers,
  defaultSellerId,
  defaultDue,
  today,
  initialProductId,
}: {
  products: ProductOption[];
  customers: CustomerOption[];
  sellers: { id: string; name: string }[];
  defaultSellerId: string;
  defaultDue: string;
  today: string;
  initialProductId?: string;
}) {
  const router = useRouter();
  const seeded = useRef(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("SP");
  const [productQuery, setProductQuery] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [freightInput, setFreightInput] = useState("0,00");
  const [closedTouched, setClosedTouched] = useState(false);
  const [closedInput, setClosedInput] = useState("0,00");
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);
  const [installments, setInstallments] = useState(1);
  const [firstDue, setFirstDue] = useState(defaultDue);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [sellerId, setSellerId] = useState(defaultSellerId);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [cepState, setCepState] = useState("");

  const customerMatches = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (query.length < 2) return [];
    return customers
      .filter((customer) => customer.name.toLowerCase().includes(query) || (customer.cpf ?? "").includes(onlyDigits(query)))
      .slice(0, 8);
  }, [customerQuery, customers]);

  const productMatches = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return [];
    return products
      .filter((product) =>
        [product.code, product.name, product.category, product.size ?? "", product.density ?? ""].join(" ").toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [productQuery, products]);

  const catalog = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    const list = query
      ? products.filter((product) =>
          [product.code, product.name, product.category, product.size ?? "", product.density ?? ""].join(" ").toLowerCase().includes(query),
        )
      : products;
    return list.slice(0, 40);
  }, [productQuery, products]);

  const itemsTotal = lines.reduce((sum, line) => sum + line.quantity * (parseMoney(line.priceInput) ?? 0), 0);
  const freight = parseMoney(freightInput) ?? 0;
  const suggested = itemsTotal + freight;
  const discounted = discountPercent == null ? suggested : Math.round((suggested * (100 - discountPercent)) / 100);
  const closedAmount = closedTouched ? (parseMoney(closedInput) ?? 0) : discounted;
  const shownClosed = closedTouched ? closedInput : centsToInput(discounted);
  const due = parseIsoDate(firstDue);
  const parcelBase = installments > 0 ? Math.floor(closedAmount / installments) : 0;
  const parcels = due
    ? Array.from({ length: Math.min(installments, 12) }, (_, index) => ({
        number: index + 1,
        dueDate: formatDate(addMonthsUtc(due, index)),
        amount: index === installments - 1 ? closedAmount - parcelBase * (installments - 1) : parcelBase,
      }))
    : [];
  const stockProblem = lines.some((line) => line.quantity > line.available || line.quantity < 1);
  const blocked = stockProblem || lines.some((line) => (parseMoney(line.priceInput) ?? 0) < 0);

  function selectCustomer(customer: CustomerOption) {
    setCustomerId(customer.id);
    setName(customer.name);
    setCpf(customer.cpf ?? "");
    setBirthDate(customer.birthDate ?? "");
    setPhone(customer.phone ?? "");
    setCep(customer.cep ?? "");
    setStreet(customer.street ?? "");
    setComplement(customer.complement ?? "");
    setNeighborhood(customer.neighborhood ?? "");
    setCity(customer.city ?? "");
    setState(customer.state ?? "SP");
    setCustomerQuery("");
    setCustomerOpen(false);
  }

  function clearCustomer() {
    setCustomerId("");
    setName("");
    setCpf("");
    setBirthDate("");
    setPhone("");
    setCep("");
    setStreet("");
    setComplement("");
    setNeighborhood("");
    setCity("");
    setState("SP");
    setCustomerQuery("");
    setCepState("");
  }

  function addProduct(product: ProductOption) {
    setLines((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) =>
          line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...current,
        {
          key: product.id,
          productId: product.id,
          code: product.code,
          description: productLabel(product),
          quantity: 1,
          priceInput: centsToInput(product.unitPrice),
          available: product.available,
        },
      ];
    });
    setProductQuery("");
    setHighlight(0);
    setProductOpen(false);
  }

  function patchLine(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  useEffect(() => {
    if (seeded.current || !initialProductId) return;
    const product = products.find((item) => item.id === initialProductId);
    if (!product) return;
    seeded.current = true;
    addProduct(product);
  }, [initialProductId, products]);

  async function lookupCep() {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;
    setCepState("Buscando CEP...");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json();
      if (data.erro) {
        setCepState("CEP não encontrado.");
        return;
      }
      setStreet(data.logradouro || "");
      setNeighborhood(data.bairro || "");
      setCity(data.localidade || "");
      setState(data.uf || "SP");
      setCep(formatCep(digits));
      setCepState("Endereço preenchido pelo CEP.");
    } catch {
      setCepState("Não foi possível consultar o CEP.");
    }
  }

  async function onSubmit() {
    if (pending) return;
    setPending(true);
    setError("");
    const parsedLines = lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: parseMoney(line.priceInput),
    }));
    if (parsedLines.some((line) => line.unitPrice == null)) {
      setError("Há preço inválido nos itens.");
      setPending(false);
      return;
    }
    const result = await createSaleAction({
      customer: {
        id: customerId || undefined,
        name,
        cpf,
        birthDate,
        phone,
        cep,
        street,
        complement,
        neighborhood,
        city,
        state,
      },
      sellerId,
      lines: parsedLines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice ?? 0,
      })),
      freight,
      closedAmount,
      installments,
      firstDueDate: firstDue,
      deliveryDate,
      notes,
    });
    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }
    router.push(`/imprimir/${result.id}?imprimir=1`);
  }

  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void submitRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function launchFromQuery() {
    const query = productQuery.trim().toLowerCase();
    if (!query) return;
    const exact = products.find((product) => product.code.toLowerCase() === query);
    if (exact) addProduct(exact);
    else if (productMatches[highlight]) addProduct(productMatches[highlight]);
  }

  const deliveryChoices = [
    ["Hoje", today],
    ["Em 7 dias", addDaysIso(today, 7)],
    ["Em 15 dias", addDaysIso(today, 15)],
    ["Em 30 dias", addDaysIso(today, 30)],
  ] as const;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Pedido de venda</h1>
          <p className="mt-1 text-base text-muted">Preencha o cliente, os produtos e o pagamento. A nota abre pronta para imprimir.</p>
        </div>
      </div>

      <div className="grid gap-5">
        <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-ink">Cliente</h2>
            {customerId ? (
              <button type="button" onClick={clearCustomer} className="text-sm font-semibold text-teal">
                Limpar e digitar outro
              </button>
            ) : null}
          </div>

          <div className="relative mb-4">
            <label className="mb-1 block text-sm font-medium text-ink">Buscar cliente já cadastrado</label>
            <input
              value={customerQuery}
              onChange={(event) => {
                setCustomerQuery(event.target.value);
                setCustomerOpen(true);
              }}
              onFocus={() => setCustomerOpen(true)}
              onBlur={() => window.setTimeout(() => setCustomerOpen(false), 150)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && customerMatches[0]) {
                  event.preventDefault();
                  selectCustomer(customerMatches[0]);
                }
              }}
              placeholder="Nome ou CPF"
              className={`${inputClass} h-12 text-base`}
            />
            {customerOpen && customerMatches.length > 0 ? (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-white shadow-lg">
                {customerMatches.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectCustomer(customer)}
                    className="flex w-full items-center justify-between gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-[#e7eef5]"
                  >
                    <span className="text-base font-medium text-ink">{customer.name}</span>
                    <span className="text-sm text-muted">{customer.phone || customer.cpf || ""}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {customerId ? (
            <p className="mb-4 rounded-lg bg-[#e7f6ef] px-4 py-2 text-sm font-medium text-ok">
              Cliente encontrado. Os dados abaixo vão para a nota e atualizam o cadastro.
            </p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome">
              <input value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} h-12 text-base`} />
            </Field>
            <Field label="Telefone">
              <input value={phone} onChange={(event) => setPhone(event.target.value)} className={`${inputClass} h-12 text-base`} />
            </Field>
            <Field label="CPF">
              <input value={cpf} onChange={(event) => setCpf(event.target.value)} className={`${inputClass} h-12 text-base`} />
            </Field>
            <Field label="Data de nascimento">
              <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className={`${inputClass} h-12 text-base`} />
            </Field>
            <Field label="CEP" hint={cepState || "Ao sair do campo, a rua, o bairro e a cidade são preenchidos."}>
              <input value={cep} onChange={(event) => setCep(event.target.value)} onBlur={lookupCep} className={`${inputClass} h-12 text-base`} />
            </Field>
            <Field label="Endereço">
              <input value={street} onChange={(event) => setStreet(event.target.value)} placeholder="Rua e número" className={`${inputClass} h-12 text-base`} />
            </Field>
            <Field label="Complemento">
              <input value={complement} onChange={(event) => setComplement(event.target.value)} className={`${inputClass} h-12 text-base`} />
            </Field>
            <Field label="Bairro">
              <input value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} className={`${inputClass} h-12 text-base`} />
            </Field>
            <Field label="Cidade">
              <input value={city} onChange={(event) => setCity(event.target.value)} className={`${inputClass} h-12 text-base`} />
            </Field>
            <Field label="UF">
              <select value={state} onChange={(event) => setState(event.target.value)} className={`${inputClass} h-12 text-base`}>
                {states.map((uf) => (
                  <option key={uf}>{uf}</option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-ink">Itens da nota</h2>
          <p className="mt-1 text-sm text-muted">Busque pelo nome ou pelo código e clique para incluir.</p>

          <div className="relative mt-4">
            <div className="flex flex-wrap gap-2">
            <input
              value={productQuery}
              onChange={(event) => {
                setProductQuery(event.target.value);
                setHighlight(0);
                setProductOpen(true);
              }}
              onFocus={() => setProductOpen(true)}
              onBlur={() => window.setTimeout(() => setProductOpen(false), 150)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setHighlight((current) => Math.min(current + 1, Math.max(productMatches.length - 1, 0)));
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setHighlight((current) => Math.max(current - 1, 0));
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  launchFromQuery();
                }
              }}
              placeholder="Ex.: queen, molas, ORTO-CASAL"
              className={`${inputClass} h-12 min-w-[240px] flex-1 text-base`}
            />
            <button
              type="button"
              onClick={launchFromQuery}
              className="h-12 rounded-lg bg-teal px-5 text-base font-semibold text-white"
            >
              Incluir
            </button>
            <button
              type="button"
              onClick={() => setCatalogOpen((current) => !current)}
              className="h-12 rounded-lg border border-line bg-white px-4 text-base font-semibold text-ink"
            >
              {catalogOpen ? "Fechar lista" : "Ver lista"}
            </button>
            </div>
            {productOpen && productMatches.length > 0 ? (
              <div className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-white shadow-lg">
                {productMatches.map((product, index) => (
                  <button
                    key={product.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => addProduct(product)}
                    className={`flex w-full items-center justify-between gap-4 border-b border-line px-4 py-3 text-left last:border-b-0 ${index === highlight ? "bg-[#e7eef5]" : "bg-white hover:bg-[#e7eef5]"}`}
                  >
                    <span>
                      <span className="block text-base font-medium text-ink">{productLabel(product)}</span>
                      <span className="text-sm text-muted">{product.code} · {product.category}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-base font-semibold text-ink">{formatMoney(product.unitPrice)}</span>
                      <span className={`text-sm ${product.available <= 0 ? "font-semibold text-danger" : "text-muted"}`}>
                        {product.available <= 0 ? "Sem estoque" : `${product.available} disponíveis`}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {catalogOpen ? (
            <div className="mt-4 max-h-80 overflow-auto rounded-lg border border-line">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-ink">Código</th>
                    <th className="px-3 py-2 font-semibold text-ink">Produto</th>
                    <th className="px-3 py-2 font-semibold text-ink">Preço</th>
                    <th className="px-3 py-2 font-semibold text-ink">Estoque</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((product) => (
                    <tr key={product.id} className="border-t border-line">
                      <td className="px-3 py-2 text-ink">{product.code}</td>
                      <td className="px-3 py-2 text-ink">{productLabel(product)}</td>
                      <td className="px-3 py-2 text-ink">{formatMoney(product.unitPrice)}</td>
                      <td className={`px-3 py-2 ${product.available <= 0 ? "font-semibold text-danger" : "text-ink"}`}>{product.available}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => addProduct(product)} className="font-semibold text-teal">
                          Incluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length > catalog.length ? (
                <p className="border-t border-line px-3 py-2 text-sm text-muted">Mostrando {catalog.length} de {products.length}. Use a busca para achar o restante.</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-base">
              <thead>
                <tr>
                  <th className="py-2 pr-3 font-semibold text-ink">Código</th>
                  <th className="py-2 pr-3 font-semibold text-ink">Descrição</th>
                  <th className="py-2 pr-3 font-semibold text-ink">Qtd</th>
                  <th className="py-2 pr-3 font-semibold text-ink">Unitário</th>
                  <th className="py-2 pr-3 font-semibold text-ink">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const unit = parseMoney(line.priceInput) ?? 0;
                  const over = line.quantity > line.available;
                  return (
                    <tr key={line.key} className="border-t border-line">
                      <td className="py-3 pr-3 align-middle font-medium text-ink">{line.code}</td>
                      <td className="py-3 pr-3 align-middle text-ink">
                        {line.description}
                        {over ? <span className="mt-1 block text-sm font-semibold text-danger">Só há {line.available} em estoque.</span> : null}
                      </td>
                      <td className="py-3 pr-3 align-middle">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => patchLine(line.key, { quantity: Math.max(1, line.quantity - 1) })}
                            className="h-10 w-10 rounded-lg border border-line bg-white text-lg font-semibold text-ink"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(event) => patchLine(line.key, { quantity: Number(event.target.value) })}
                            className={`${inputClass} h-10 w-16 text-center ${over ? "border-danger" : ""}`}
                          />
                          <button
                            type="button"
                            onClick={() => patchLine(line.key, { quantity: line.quantity + 1 })}
                            className="h-10 w-10 rounded-lg border border-line bg-white text-lg font-semibold text-ink"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-3 pr-3 align-middle">
                        <input
                          value={line.priceInput}
                          onChange={(event) => patchLine(line.key, { priceInput: event.target.value })}
                          className={`${inputClass} h-10 w-32`}
                        />
                      </td>
                      <td className="py-3 pr-3 align-middle font-semibold text-ink">{formatMoney(unit * line.quantity)}</td>
                      <td className="py-3 align-middle text-right">
                        <button
                          type="button"
                          onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                          className="font-semibold text-danger"
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-base text-muted">
                      Nenhum produto na nota. Busque acima ou abra a lista.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-ink">Pagamento e entrega</h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-[#f3f7fb] p-4">
                <div>
                  <p className="text-sm text-muted">Itens</p>
                  <p className="text-xl font-semibold text-ink">{formatMoney(itemsTotal)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Com frete</p>
                  <p className="text-xl font-semibold text-ink">{formatMoney(suggested)}</p>
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Desconto sobre itens e frete</p>
                <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-line">
                  {discounts.map((percent) => {
                    const active = (percent === 0 && discountPercent == null && !closedTouched) || discountPercent === percent;
                    return (
                      <button
                        key={percent}
                        type="button"
                        onClick={() => {
                          setDiscountPercent(percent === 0 ? null : percent);
                          setClosedTouched(false);
                        }}
                        className={`h-11 text-sm font-semibold ${active ? "bg-teal text-white" : "bg-white text-ink hover:bg-[#e7eef5]"}`}
                      >
                        {percent === 0 ? "0%" : `${percent}%`}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Field label="Frete">
                <input value={freightInput} onChange={(event) => setFreightInput(event.target.value)} className={`${inputClass} h-12 text-base`} />
              </Field>
              <Field label="Valor fechado">
                <input
                  value={shownClosed}
                  onChange={(event) => {
                    setClosedTouched(true);
                    setDiscountPercent(null);
                    setClosedInput(event.target.value);
                  }}
                  className={`${inputClass} h-14 text-2xl font-semibold`}
                />
              </Field>
            </div>

            <div className="grid content-start gap-4">
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Parcelas</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {parcelPresets.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setInstallments(count)}
                      className={`h-11 rounded-lg border text-sm font-semibold ${installments === count ? "border-teal bg-teal text-white" : "border-line bg-white text-ink"}`}
                    >
                      {count === 1 ? "À vista" : `${count}x`}
                    </button>
                  ))}
                  <label className="col-span-3 flex items-center gap-2 sm:col-span-1">
                    <span className="sr-only">Número de parcelas</span>
                    <input
                      type="number"
                      min={1}
                      max={48}
                      value={installments}
                      onChange={(event) => setInstallments(Math.min(48, Math.max(1, Number(event.target.value) || 1)))}
                      className={`${inputClass} h-11`}
                    />
                  </label>
                </div>
              </div>
              <Field label="Vencimento da 1ª parcela">
                <input type="date" value={firstDue} onChange={(event) => setFirstDue(event.target.value)} className={`${inputClass} h-12 text-base`} />
              </Field>
              {parcels.length > 0 ? (
                <div className="rounded-lg border border-line">
                  {parcels.map((parcel) => (
                    <p key={parcel.number} className="flex justify-between border-b border-line px-3 py-2 text-sm last:border-b-0">
                      <span className="text-ink">{parcel.number}ª parcela · {parcel.dueDate}</span>
                      <span className="font-semibold text-ink">{formatMoney(parcel.amount)}</span>
                    </p>
                  ))}
                  {installments > 12 ? <p className="px-3 py-2 text-sm text-muted">e mais {installments - 12} parcelas</p> : null}
                </div>
              ) : null}
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Entrega</p>
                <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {deliveryChoices.map(([label, value]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setDeliveryDate(value)}
                      className={`h-11 rounded-lg border text-sm font-semibold ${deliveryDate === value ? "border-teal bg-teal text-white" : "border-line bg-white text-ink"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} className={`${inputClass} h-12 text-base`} />
              </div>
              <Field label="Vendedor">
                <select value={sellerId} onChange={(event) => setSellerId(event.target.value)} className={`${inputClass} h-12 text-base`}>
                  {sellers.map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.name}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-ink">Observações</span>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={`${inputClass} h-auto py-2 text-base`} />
              </label>
            </div>
          </div>
        </section>
      </div>

      <div className="sticky bottom-3 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-5 py-4 shadow-lg">
        <div>
          <p className="text-sm text-muted">Valor da nota</p>
          <p className="text-3xl font-semibold text-ink">{formatMoney(closedAmount)}</p>
          {stockProblem ? <p className="text-sm font-semibold text-danger">Ajuste a quantidade: passou do estoque.</p> : null}
          {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={pending || blocked || lines.length === 0 || !name.trim()}
          className="h-14 rounded-lg bg-teal px-8 text-lg font-semibold text-white disabled:opacity-40"
        >
          {pending ? "Gerando a nota..." : "Criar nota e imprimir"}
        </button>
      </div>
    </div>
  );
}
