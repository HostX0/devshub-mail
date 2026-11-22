"use client";

import { createContext, useContext } from "react";
import type { ConfigData } from "@/hooks/use-config";

const LoginConfig = createContext<ConfigData | null>(null);
export function LoginConfigProvider({ value, children }: { value: ConfigData; children: React.ReactNode }) {
  return <LoginConfig.Provider value={value}>{children}</LoginConfig.Provider>;
}
export const useLoginConfig = () => useContext(LoginConfig);
