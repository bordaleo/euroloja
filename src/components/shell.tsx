"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode, type SVGProps } from "react";
import { logoutAction } from "@/actions/app";
import type { SessionUser } from "@/lib/types";

const groups = [
  {
    title: "Vendas",
    links: [
      { href: "/", label: "Painel", icon: "painel" },
      { href: "/vendas", label: "Pedidos", icon: "pedidos" },
    ],
  },
  {
    title: "Cadastros",
    links: [
      { href: "/produtos", label: "Produtos", icon: "produtos" },
      { href: "/clientes", label: "Clientes", icon: "clientes" },
      { href: "/estoque", label: "Estoque", icon: "estoque" },
    ],
  },
  {
    title: "Gestão",
    admin: true,
    links: [
      { href: "/financeiro", label: "Financeiro", icon: "financeiro" },
      { href: "/relatorios", label: "Relatórios", icon: "relatorios" },
      { href: "/vendedores", label: "Vendedores", icon: "vendedores" },
      { href: "/loja", label: "Dados da loja", icon: "loja" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/vendas") {
    return pathname === "/vendas" || /^\/vendas\/(?!nova$).+/.test(pathname);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Glyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />
  );
}

function Icon({ name }: { name: string }) {
  if (name === "painel") {
    return (
      <Glyph>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
      </Glyph>
    );
  }
  if (name === "pedidos") {
    return (
      <Glyph>
        <path d="M7 3.5h7.2L19 8.2V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5z" />
        <path d="M14 3.6V8.4h5M8.5 13h7M8.5 16.5h4.5" />
      </Glyph>
    );
  }
  if (name === "produtos") {
    return (
      <Glyph>
        <path d="M3.5 8 12 4.2 20.5 8 12 11.8 3.5 8z" />
        <path d="M3.5 8v8L12 19.8l8.5-3.8V8M12 11.8v8" />
      </Glyph>
    );
  }
  if (name === "clientes") {
    return (
      <Glyph>
        <circle cx="12" cy="8" r="3" />
        <path d="M5.2 19.2c1.1-2.8 3.4-4.2 6.8-4.2s5.7 1.4 6.8 4.2" />
      </Glyph>
    );
  }
  if (name === "estoque") {
    return (
      <Glyph>
        <path d="M4 7.6 12 4.2l8 3.4-8 3.4-8-3.4z" />
        <path d="M4 12.1 12 15.5l8-3.4M4 16.5 12 19.8l8-3.3" />
      </Glyph>
    );
  }
  if (name === "financeiro") {
    return (
      <Glyph>
        <rect x="3.5" y="6" width="17" height="12.5" rx="2" />
        <path d="M3.5 10.2h17M7.2 14.6h3.6" />
      </Glyph>
    );
  }
  if (name === "relatorios") {
    return (
      <Glyph>
        <path d="M4.5 19V10.5M10 19V5.5M15.5 19v-6.5M20 19.2H4" />
      </Glyph>
    );
  }
  if (name === "vendedores") {
    return (
      <Glyph>
        <circle cx="9" cy="8.2" r="2.5" />
        <circle cx="16" cy="9.2" r="2" />
        <path d="M3.8 18.4c.7-2.4 2.6-3.7 5.2-3.7s4.5 1.3 5.2 3.7M14.2 14.8c1.6.1 3.1.9 4 2.6" />
      </Glyph>
    );
  }
  return (
    <Glyph>
      <path d="M4 10.6 12 4.2l8 6.4V20a1 1 0 0 1-1 1h-5.2v-5.2h-3.6V21H5a1 1 0 0 1-1-1v-9.4z" />
    </Glyph>
  );
}

function MenuBody({
  user,
  pathname,
  onNavigate,
}: {
  user: SessionUser;
  pathname: string;
  onNavigate?: () => void;
}) {
  const visible = groups.filter((group) => !group.admin || user.role === "ADMIN");
  const selling = pathname.startsWith("/vendas/nova");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pt-5">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal text-sm font-semibold text-white shadow-[0_10px_24px_-14px_rgba(11,95,115,0.9)]">
            EJ
          </span>
          <span>
            <span className="block text-[13px] font-medium text-muted">Euro João Cachoeira</span>
            <span className="block text-lg font-semibold leading-tight text-ink">Sistema Euro</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={onNavigate}
          className="grid h-10 w-10 place-items-center rounded-xl text-ink hover:bg-[#eef3f8] lg:hidden"
          aria-label="Fechar menu"
        >
          <Glyph width="18" height="18">
            <path d="M6 6l12 12M18 6 6 18" />
          </Glyph>
        </button>
      </div>

      <div className="px-4 pt-5">
        <Link
          href="/vendas/nova"
          onClick={onNavigate}
          aria-current={selling ? "page" : undefined}
          className={`flex h-12 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white shadow-[0_12px_28px_-16px_rgba(11,95,115,0.95)] transition hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 ${selling ? "bg-teal-2" : "bg-teal hover:bg-teal-2"}`}
        >
          <Glyph width="18" height="18">
            <path d="M12 5v14M5 12h14" />
          </Glyph>
          Nova venda
        </Link>
      </div>

      <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4" aria-label="Menu principal">
        {visible.map((group) => (
          <div key={group.title} className="mt-5">
            <div className="mb-2 flex items-center gap-3 px-3">
              <p className="text-[13px] font-semibold text-muted">{group.title}</p>
              <span className="h-px flex-1 bg-line" />
            </div>
            <ul className="grid gap-1">
              {group.links.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`group flex h-12 items-center gap-3 rounded-2xl px-2.5 text-[15px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${active ? "bg-teal font-semibold text-white shadow-[0_10px_22px_-16px_rgba(11,95,115,1)]" : "font-medium text-ink hover:bg-[#eef3f8]"}`}
                    >
                      <span className={`grid h-8 w-8 place-items-center rounded-xl ${active ? "bg-white/15 text-white" : "bg-[#eef3f8] text-teal group-hover:bg-white"}`}>
                        <Icon name={link.icon} />
                      </span>
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <div className="rounded-2xl bg-[#f4f8fb] p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-base font-semibold text-teal shadow-sm">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold text-ink">{user.name}</span>
              <span className="text-[13px] text-muted">{user.role === "ADMIN" ? "Administrador" : "Vendedor"}</span>
            </span>
          </div>
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="h-10 w-full rounded-xl bg-white text-sm font-semibold text-ink shadow-sm transition hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              Sair
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function Shell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = pathname.startsWith("/vendas/nova")
    ? "Nova venda"
    : groups.flatMap((group) => group.links).find((link) => isActive(pathname, link.href))?.label;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="min-h-screen lg:pl-[300px]">
      <button
        type="button"
        aria-label="Fechar menu"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-[#172033]/35 transition-opacity lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[300px] border-r border-line bg-white shadow-[8px_0_30px_-24px_rgba(23,32,51,0.45)] transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <MenuBody user={user} pathname={pathname} onNavigate={() => setOpen(false)} />
      </aside>

      <div className="min-w-0">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            className="h-11 rounded-xl border border-line px-4 text-[15px] font-semibold text-ink"
          >
            Menu
          </button>
          <span className="truncate text-[15px] font-semibold text-ink">{current ?? "Sistema Euro"}</span>
        </div>
        <main className="px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
