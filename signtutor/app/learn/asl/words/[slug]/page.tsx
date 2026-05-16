import type { Metadata } from "next";
import { DYNAMIC_SIGNS } from "@/lib/curriculum";
import DynamicSignPlayer from "@/components/DynamicSignPlayer";
import { notFound } from "next/navigation";

interface Props { params: Promise<{ slug: string }>; }

export async function generateStaticParams() {
  return Object.keys(DYNAMIC_SIGNS).map(word => ({ slug: word.toLowerCase() }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const word = slug.toUpperCase();
  if (!DYNAMIC_SIGNS[word]) return {};
  return { title: "ASL Sign: " + word, description: "Practice the ASL sign for " + word + ": " + DYNAMIC_SIGNS[word] };
}

export default async function WordPage({ params }: Props) {
  const { slug } = await params;
  const word = slug.toUpperCase();
  if (!DYNAMIC_SIGNS[word]) notFound();
  return <DynamicSignPlayer initialSign={word} />;
}