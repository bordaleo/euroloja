import { importProductsAction } from "@/actions/app";
import { SubmitButton } from "@/components/submit-button";

export function ImportProducts() {
  return (
    <form action={importProductsAction} className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-ink">Subir tabela de produtos</h2>
      <p className="mt-1 max-w-3xl text-base text-muted">
        Envie o Excel da loja (.xlsx). A primeira linha pode ser o cabeçalho: codigo, descricao, categoria, preco, custo, estoque, minimo, medida, densidade.
      </p>
      <a href="/api/modelo-produtos" className="mt-3 inline-flex text-base font-semibold text-teal underline">
        Baixar planilha modelo
      </a>
      <input
        type="file"
        name="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        required
        className="mt-4 block w-full text-base file:mr-3 file:rounded-lg file:border-0 file:bg-teal file:px-4 file:py-3 file:text-base file:font-semibold file:text-white"
      />
      <label className="mt-4 flex items-center gap-3 text-base text-ink">
        <input type="checkbox" name="replaceStock" defaultChecked className="h-5 w-5" />
        Usar o estoque que está na planilha
      </label>
      <label className="mt-3 flex items-center gap-3 text-base text-ink">
        <input type="checkbox" name="updateCost" defaultChecked className="h-5 w-5" />
        Atualizar o custo dos produtos que já existem
      </label>
      <div className="mt-4">
        <SubmitButton>Importar planilha</SubmitButton>
      </div>
    </form>
  );
}
