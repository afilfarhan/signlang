import type { Metadata } from "next";
import { ALL_LETTERS, STATIC_LETTERS, LETTER_DESCRIPTIONS, isMotionLetter } from "@/lib/curriculum";
import StaticSignPlayer from "@/components/StaticSignPlayer";
import { notFound, redirect } from "next/navigation";

interface Props { params: Promise<{ letter: string }>; }

export async function generateStaticParams() {
  return ALL_LETTERS.map((letter) => ({ letter }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { letter } = await params;
  const upper = letter.toUpperCase();
  if (!ALL_LETTERS.includes(upper)) return {};
  return {
    title: "ASL Letter " + upper + (isMotionLetter(upper) ? " (Motion)" : ""),
    description: "Practice ASL letter " + upper + ": " + LETTER_DESCRIPTIONS[upper],
  };
}

export default async function LetterPage({ params }: Props) {
  const { letter } = await params;
  const upper = letter.toUpperCase();
  if (!ALL_LETTERS.includes(upper)) notFound();
  // J and Z are motion letters -- route to dynamic player (W2)
  if (isMotionLetter(upper)) {
    redirect("/learn/asl/words/" + upper.toLowerCase());
  }
  if (!STATIC_LETTERS.includes(upper)) notFound();
  return <StaticSignPlayer initialLetter={upper} />;
}