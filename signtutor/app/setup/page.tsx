import type { Metadata } from "next";
import SetupWizard from "@/components/SetupWizard";

export const metadata: Metadata = {
  title: "Camera Setup",
  description:
    "Set up your camera for sign language practice. 4-step wizard: language, permission, lighting check, and handedness.",
};

export default function SetupPage() {
  return <SetupWizard />;
}
