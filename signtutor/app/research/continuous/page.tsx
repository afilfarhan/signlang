import type { Metadata } from "next";
import ContinuousResearchPlayer from "@/components/ContinuousResearchPlayer";

export const metadata: Metadata = {
  title: "Continuous SLR - Research Preview",
  description: "Research preview of continuous sign language recognition. Accuracy is much lower than isolated-sign recognition.",
  robots: { index: false, follow: false },
};

export default function ContinuousResearchPage() {
  return <ContinuousResearchPlayer />;
}