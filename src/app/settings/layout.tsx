import { LocalDevFooter } from "@/components/localdev-footer";
import type { ReactNode } from "react";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-canvas">{children}<LocalDevFooter /></div>;
}
