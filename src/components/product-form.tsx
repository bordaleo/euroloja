import { saveProductAction } from "@/actions/app";
import { centsToInput } from "@/lib/format";
import { categories } from "@/lib/labels";
import { Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

const fieldClass = `${inputClass} h-12 text-base`;

export function ProductForm({
  product,
  showCost,
  embedded = false,
}: {
  product?: {
    id: string;
    code: string;
    name: string;
    category: string;
    size: string | null;
    density: string | null;
    unitPrice: number;
    costPrice: number;
    minStock: number;
    active: boolean;
  };
  showCost: boolean;
  embedded?: boolean;
}) {
  return (
    <form
      action={saveProductAction}
      className={embedded ? "grid gap-4 md:grid-cols-2" : "grid gap-4 rounded-xl border border-line bg-white p-5 shadow-sm md:grid-cols-2"}
    >
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <Field label="Código">
        <input name="code" defaultValue={product?.code ?? ""} className={fieldClass} required />
      </Field>
      <Field label="Descrição">
        <input name="name" defaultValue={product?.name ?? ""} className={fieldClass} required />
      </Field>
      <Field label="Categoria">
        <input name="category" list="categorias" defaultValue={product?.category ?? "Colchão"} className={fieldClass} />
        <datalist id="categorias">
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </Field>
      <Field label="Medida">
        <input name="size" defaultValue={product?.size ?? ""} placeholder="158x198" className={fieldClass} />
      </Field>
      <Field label="Densidade">
        <input name="density" defaultValue={product?.density ?? ""} placeholder="D33" className={fieldClass} />
      </Field>
      <Field label="Preço de venda">
        <input name="unitPrice" defaultValue={product ? centsToInput(product.unitPrice) : ""} placeholder="0,00" className={fieldClass} required />
      </Field>
      {showCost ? (
        <Field label="Custo">
          <input name="costPrice" defaultValue={product ? centsToInput(product.costPrice) : "0,00"} className={fieldClass} />
        </Field>
      ) : null}
      <Field label="Estoque mínimo">
        <input name="minStock" type="number" min={0} defaultValue={product?.minStock ?? 0} className={fieldClass} />
      </Field>
      {product ? null : (
        <Field label="Estoque inicial">
          <input name="stockQty" type="number" min={0} defaultValue={0} className={fieldClass} />
        </Field>
      )}
      <label className="flex items-center gap-3 self-end rounded-lg border border-line px-4 py-3 text-base text-ink md:col-span-2">
        <input type="hidden" name="active" value="off" />
        <input type="checkbox" name="active" value="on" defaultChecked={product?.active ?? true} className="h-5 w-5" />
        Produto ativo para venda
      </label>
      <div className="md:col-span-2">
        <SubmitButton>{product ? "Salvar produto" : "Cadastrar produto"}</SubmitButton>
      </div>
    </form>
  );
}
