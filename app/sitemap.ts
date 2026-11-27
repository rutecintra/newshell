import type { MetadataRoute } from "next";
import { editionStories } from "@/lib/content.js";
import { sectionPath, storyPath } from "@/lib/routes.js";
import { SECTIONS } from "@/lib/search.js";
import { getSiteUrl } from "@/lib/site.js";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  const stories = editionStories();
  const urls: MetadataRoute.Sitemap = [{ url: `${site}/` }];
  for (const locale of ["pt-br", "en"] as const) {
    for (const section of SECTIONS) {
      urls.push({ url: `${site}${sectionPath(locale, section)}` });
    }
    for (const story of stories) {
      urls.push({
        url: `${site}${storyPath(locale, story.id)}`,
        lastModified: story.updatedAt,
      });
    }
  }
  return urls;
}
