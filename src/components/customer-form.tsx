"use client";

import { useState } from "react";
import { saveCustomerAction } from "@/actions/app";
import { formatCep, onlyDigits } from "@/lib/cpf";
import { Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export function CustomerForm({
  customer,
}: {
  customer?: {
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
}) {
  const [cep, setCep] = useState(customer?.cep ?? "");
  const [street, setStreet] = useState(customer?.street ?? "");
  const [neighborhood, setNeighborhood] = useState(customer?.neighborhood ?? "");
  const [city, setCity] = useState(customer?.city ?? "");
  const [state, setState] = useState(customer?.state ?? "SP");
  const [hint, setHint] = useState("");

  async function lookupCep() {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;
    setHint("Buscando CEP...");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json();
      if (data.erro) {
        setHint("CEP não encontrado.");
        return;
      }
      setStreet(data.logradouro || "");
      setNeighborhood(data.bairro || "");
      setCity(data.localidade || "");
      setState(data.uf || "SP");
      setCep(formatCep(digits));
      setHint("Endereço preenchido pelo CEP.");
    } catch {
      setHint("Não foi possível consultar o CEP.");
    }
  }

  return (
    <form action={saveCustomerAction} className="grid gap-3 rounded-2xl border border-line bg-card p-5 md:grid-cols-2">
      {customer ? <input type="hidden" name="id" value={customer.id} /> : null}
      <Field label="Nome">
        <input name="name" defaultValue={customer?.name ?? ""} className={inputClass} required />
      </Field>
      <Field label="CPF">
        <input name="cpf" defaultValue={customer?.cpf ?? ""} className={inputClass} />
      </Field>
      <Field label="Data de nascimento">
        <input type="date" name="birthDate" defaultValue={customer?.birthDate ?? ""} className={inputClass} />
      </Field>
      <Field label="Telefone">
        <input name="phone" defaultValue={customer?.phone ?? ""} className={inputClass} />
      </Field>
      <Field label="CEP" hint={hint}>
        <input name="cep" value={cep} onChange={(event) => setCep(event.target.value)} onBlur={lookupCep} className={inputClass} />
      </Field>
      <Field label="Endereço">
        <input name="street" value={street} onChange={(event) => setStreet(event.target.value)} className={inputClass} />
      </Field>
      <Field label="Complemento">
        <input name="complement" defaultValue={customer?.complement ?? ""} className={inputClass} />
      </Field>
      <Field label="Bairro">
        <input name="neighborhood" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} className={inputClass} />
      </Field>
      <Field label="Cidade">
        <input name="city" value={city} onChange={(event) => setCity(event.target.value)} className={inputClass} />
      </Field>
      <Field label="UF">
        <select name="state" value={state} onChange={(event) => setState(event.target.value)} className={inputClass}>
          {states.map((uf) => (
            <option key={uf}>{uf}</option>
          ))}
        </select>
      </Field>
      <div className="md:col-span-2">
        <SubmitButton>{customer ? "Salvar cliente" : "Cadastrar cliente"}</SubmitButton>
      </div>
    </form>
  );
}
