import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionScreen, sectionMetadata } from "@/components/section-screen";

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ locale: "pt-br" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return sectionMetadata(locale, "brazil");
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "pt-br") notFound();
  return <SectionScreen locale={locale} section="brazil" />;
}
