import { MetadataRoute } from 'next'
import { getAllSlugs } from '@/lib/treatments'

export default function sitemap(): MetadataRoute.Sitemap {
  const treatmentPages: MetadataRoute.Sitemap = getAllSlugs().map((slug) => ({
    url: `https://carecompanionai.org/conditions/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  return [
    { url: 'https://carecompanionai.org', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://carecompanionai.org/login', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://carecompanionai.org/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://carecompanionai.org/conditions', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://carecompanionai.org/privacy', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://carecompanionai.org/terms', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    ...treatmentPages,
  ]
}
