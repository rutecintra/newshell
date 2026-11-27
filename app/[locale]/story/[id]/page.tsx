import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoryScreen, storyMetadata, storyStaticParams } from "@/components/story-screen";

export const dynamicParams = false;

export function generateStaticParams() {
  return storyStaticParams("en");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  return storyMetadata(locale, id);
}

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (locale !== "en") notFound();
  return <StoryScreen locale={locale} id={id} />;
}
