import type { Metadata } from "next";
import SettingsPanel from "@/components/SettingsPanel";

export const metadata: Metadata = {
  title: "Settings",
  description: "Configure SignTutor preferences and experimental features.",
};

export default function SettingsPage() {
  return <SettingsPanel />;
}