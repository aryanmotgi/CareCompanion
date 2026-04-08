import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://carecompanionai.org', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://carecompanionai.org/login', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://carecompanionai.org/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://carecompanionai.org/privacy', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://carecompanionai.org/terms', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]
}
