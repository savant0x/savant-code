import { defineLeafCategories } from '../core/mod.ts'

/**
 * LEAF category registry — the CLOSED vocabulary for `meta.categories`.
 *
 * Endpoints author ONLY these ids; an unknown id fails compilation. Adding a
 * leaf = editing this file in the same PR as the endpoint that needs it.
 *
 * This is the whole taxonomy story in this repo (v1 round-4 model): TOP groups
 * ("Search & SEO"), provider placement, and visibility are HOSTED concerns —
 * the Catalog manifest links leaves under tops at query time; the provider
 * tier is derived from ProviderDocs. Never authored here.
 */
export const CORE_LEAF_CATEGORY_ENTRIES = defineLeafCategories([
  {
    id: 'web-search',
    displayName: 'Web Search',
    description: 'Search the open web — keyword, neural, and hybrid retrieval.',
  },
  {
    id: 'web-scraping',
    displayName: 'Web Scraping',
    description: 'Fetch and extract clean content from known URLs.',
  },
  {
    id: 'news-search',
    displayName: 'News Search',
    description: 'Search and monitor news coverage.',
  },
  {
    id: 'company-enrichment',
    displayName: 'Company Enrichment',
    description:
      'Company data: identity resolution, firmographics, and enrichment.',
  },
  {
    id: 'company-news',
    displayName: 'Company News',
    description: 'Company event signals — funding, M&A, leadership, products.',
  },
  {
    id: 'company-reviews',
    displayName: 'Company Reviews',
    description: 'Employee and product review data for companies.',
  },
  {
    id: 'funding-data',
    displayName: 'Funding Data',
    description: 'Fundraising, investors, valuations, and deal activity.',
  },
  {
    id: 'embeddings',
    displayName: 'Embeddings',
    description: 'Convert text and media into vector representations.',
  },
  {
    id: 'people-enrichment',
    displayName: 'People Enrichment',
    description: 'Person data: profiles, contact discovery, and enrichment.',
  },
  {
    id: 'linkedin',
    displayName: 'LinkedIn',
    description: 'LinkedIn data: profiles, jobs, posts, and companies.',
  },
  {
    id: 'instagram',
    displayName: 'Instagram',
    description: 'Instagram data: profiles, posts, and hashtags.',
  },
  {
    id: 'twitter',
    displayName: 'X (Twitter)',
    description: 'X (Twitter) data: tweets, profiles, and searches.',
  },
  {
    id: 'youtube',
    displayName: 'YouTube',
    description: 'YouTube data: videos, transcripts, comments, and channels.',
  },
  {
    id: 'maps',
    displayName: 'Maps & Local',
    description:
      'Maps and local-places data: businesses, reviews, and points of interest.',
  },
  {
    id: 'amazon',
    displayName: 'Amazon',
    description: 'Amazon data: products, reviews, search results, and sellers.',
  },
  {
    id: 'facebook',
    displayName: 'Facebook',
    description:
      'Facebook data: pages, groups, events, ads, posts, and reviews.',
  },
  {
    id: 'google-shopping',
    displayName: 'Google Shopping',
    description: 'Google Shopping data: products, prices, and sellers.',
  },
  {
    id: 'tiktok-shop',
    displayName: 'TikTok Shop',
    description: 'TikTok Shop data: products, reviews, and sellers.',
  },
  {
    id: '1688',
    displayName: '1688',
    description: '1688 data: wholesale listings, offers, and prices.',
  },
  {
    id: 'autozone',
    displayName: 'AutoZone',
    description:
      'AutoZone data: products, category listings, and vehicle fitment.',
  },
  {
    id: 'cvs',
    displayName: 'CVS',
    description: 'CVS data: products, prices, and availability.',
  },
  {
    id: 'homedepot',
    displayName: 'Home Depot',
    description: 'Home Depot data: products, prices, and specifications.',
  },
  {
    id: 'kroger',
    displayName: 'Kroger',
    description: 'Kroger data: products, prices, and availability.',
  },
  {
    id: 'lazada',
    displayName: 'Lazada',
    description: 'Lazada data: products, category listings, and prices.',
  },
  {
    id: 'meijer',
    displayName: 'Meijer',
    description: 'Meijer data: products, prices, and availability.',
  },
  {
    id: 'nordstrom',
    displayName: 'Nordstrom',
    description: 'Nordstrom data: products, category listings, and prices.',
  },
  {
    id: 'segari',
    displayName: 'Segari',
    description: 'Segari data: products, prices, and availability.',
  },
  {
    id: 'shein',
    displayName: 'Shein',
    description: 'Shein data: products, prices, and variants.',
  },
  {
    id: 'walmart',
    displayName: 'Walmart',
    description: 'Walmart data: products, reviews, and prices.',
  },
  {
    id: 'watsons',
    displayName: 'Watsons',
    description: 'Watsons data: products, category listings, and prices.',
  },
  {
    id: 'zepto',
    displayName: 'Zepto',
    description: 'Zepto data: products, prices, and availability.',
  },
  {
    id: 'ai-search',
    displayName: 'AI Search',
    description:
      'AI search engines: Gemini, ChatGPT web search, Google AI Mode.',
  },
  {
    id: 'flights',
    displayName: 'Flights',
    description: 'Flight data: fares, schedules, and routes.',
  },
  {
    id: 'hotels',
    displayName: 'Hotels',
    description: 'Hotel data: room rates, availability, and guest reviews.',
  },
  {
    id: 'jobs',
    displayName: 'Jobs',
    description: 'Job listings and hiring data.',
  },
  {
    id: 'reddit',
    displayName: 'Reddit',
    description: 'Reddit data: posts, comments, and communities.',
  },
  {
    id: 'snapchat',
    displayName: 'Snapchat',
    description: 'Snapchat data: profiles, stories, and spotlight videos.',
  },
  {
    id: 'tiktok',
    displayName: 'TikTok',
    description: 'TikTok data: videos, profiles, comments, and search results.',
  },
  {
    id: 'agents',
    displayName: 'Agents',
    description:
      'Hosted multi-step research agents that plan, search, and synthesize.',
  },
])
