export const revalidate = 86400;

// app/sitemap.ts
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://bal-asistan.vercel.app'

  // 1. Static Pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      priority: 1.0,
    },
    {
      url: `${baseUrl}/hakkinda`,
      lastModified: new Date(),
      priority: 1.0,
    },
    {
      url: `${baseUrl}/oneriler`,
      lastModified: new Date(),
      priority: 1.0,
    },
  ]


  return [...staticPages]
}
