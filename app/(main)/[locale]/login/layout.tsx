import { headers } from "next/headers";
import { LoginConfigProvider } from "@/components/auth/login-config";
import { getPublicConfig } from "@/lib/admin/public-config";
import { pickRequestHost } from "@/lib/admin/domain-branding";

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const config = await getPublicConfig(pickRequestHost(await headers()));
  return <LoginConfigProvider value={config}>{children}</LoginConfigProvider>;
}
