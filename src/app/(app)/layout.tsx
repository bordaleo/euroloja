import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { toSessionUser, requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return <Shell user={toSessionUser(user)}>{children}</Shell>;
}
