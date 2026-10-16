import Link from "next/link";
import { inputClass } from "@/components/ui";

export function SearchBar({
  value = "",
  placeholder,
  action,
  hidden,
  clearHref,
}: {
  value?: string;
  placeholder: string;
  action?: string;
  hidden?: { name: string; value: string }[];
  clearHref?: string;
}) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      {hidden?.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}
      <input
        name="q"
        defaultValue={value}
        placeholder={placeholder}
        className={`${inputClass} h-12 min-w-[240px] flex-1 text-base`}
      />
      <button type="submit" className="h-12 rounded-lg bg-teal px-5 text-base font-semibold text-white">
        Buscar
      </button>
      {value && clearHref ? (
        <Link href={clearHref} className="inline-flex h-12 items-center px-2 text-base font-semibold text-teal">
          Limpar
        </Link>
      ) : null}
    </form>
  );
}
