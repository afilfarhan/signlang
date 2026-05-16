import type { Metadata } from "next";
import PracticeQueue from "@/components/PracticeQueue";

export const metadata: Metadata = {
  title: "Practice",
  description: "Spaced repetition review queue - practice signs you are forgetting first.",
};

export default function PracticePage() {
  return <PracticeQueue />;
}