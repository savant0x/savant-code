// T106 file split (FID-2026-0930-001, 300-line ceiling): the extended
// leaves (generative, resource-backed, crypto, research) moved VERBATIM
// from categories.ts. The closed vocabulary is the CONCATENATION of
// categories-core.ts + this file — order preserved, ids unchanged.
import { defineLeafCategories } from '@shared/core'

export const EXTENDED_LEAF_CATEGORY_ENTRIES = defineLeafCategories([
  {
    // The GENERATIVE leaves: every other id above names data that
    // already exists somewhere and is retrieved. These name an artifact
    // the call creates.
    id: 'video-generation',
    displayName: 'Video Generation',
    description:
      'Generate video from a text prompt, a still image, or reference ' +
      'clips.',
  },
  {
    id: '3d-generation',
    displayName: '3D Generation',
    description: 'Generate production 3D meshes from text prompts and photos.',
  },
  {
    id: 'image-generation',
    displayName: 'Image Generation',
    description: 'Generate images, including text-to-image, editing, and more.',
  },
  {
    id: 'music-generation',
    displayName: 'Music Generation',
    description:
      'Generate music, including full tracks from natural language, and more.',
  },
  {
    id: 'speech',
    displayName: 'Speech',
    description:
      'Work with voice, including text-to-speech, transcription, dialogue, and more.',
  },
  {
    // The first RESOURCE-backed leaves (add-resource-lifecycle-saperly):
    // real phone numbers owned by the workspace, with AI personas
    // answering and placing calls.
    id: 'agentic-phone',
    displayName: 'Agentic Phone',
    description:
      'Real phone numbers for AI agents — provision numbers, place ' +
      'and answer calls with an AI persona, transcripts and ' +
      'recordings.',
  },
  {
    id: 'sms',
    displayName: 'SMS',
    description: 'Send and receive SMS from owned phone numbers.',
  },
  {
    id: 'token-prices',
    displayName: 'Token Prices',
    description:
      'Tools to pull token prices, including current and historical, across chains, and more.',
  },
  {
    id: 'derivatives',
    displayName: 'Derivatives & Perps',
    description:
      'Tools to pull crypto derivatives data, including perpetual funding, open interest, liquidations, options, and more.',
  },
  {
    id: 'onchain-data',
    displayName: 'On-chain Data',
    description:
      'Tools to pull on-chain data, including RPC access, indexers, analytics, and more.',
  },
  {
    id: 'defi',
    displayName: 'DeFi',
    description:
      'Tools to pull DeFi data, including protocol TVL, DEX volumes, fees, and more.',
  },
  {
    id: 'yields',
    displayName: 'Yields',
    description:
      'Tools to pull yield data, including pool APYs, historical rates, and more.',
  },
  {
    id: 'prediction-markets',
    displayName: 'Prediction Markets',
    description:
      'Tools to pull prediction market data, including Polymarket and Kalshi prices, volume, open interest, and more.',
  },
  {
    id: 'crypto-signals',
    displayName: 'Market Signals',
    description:
      'Tools to pull crypto market signals, including sentiment indexes, technical indicators, project scores, and more.',
  },
  {
    id: 'web-extraction',
    displayName: 'Content Extraction',
    description:
      'Tools to extract page content, including clean markdown from any URL, and more.',
  },
  {
    id: 'seo',
    displayName: 'SEO',
    description:
      'Tools to analyze search performance, including keywords, backlinks, traffic, and more.',
  },
  {
    id: 'geo',
    displayName: 'GEO',
    description:
      'Tools to measure visibility in AI answers, including brand mentions, cited pages, prompts, and more.',
  },
  {
    id: 'legal-research',
    displayName: 'Legal Research',
    description:
      'Primary law: statutes, regulations, court rules, constitutions, ' +
      'and the citations between them.',
  },
  {
    id: 'app-stores',
    displayName: 'App Stores',
    description:
      'Tools to pull data from app stores, including Apple App Store ' +
      'and Google Play listings, rankings, reviews, and more.',
  },
  {
    id: 'image-search',
    displayName: 'Image Search',
    description:
      'Tools to search the web for images, including from text or image ' +
      'input, and more.',
  },
  {
    id: 'video-search',
    displayName: 'Video Search',
    description:
      'Tools to search the web for videos, including from a text query, ' +
      'and more.',
  },
  {
    id: 'equities',
    displayName: 'Stocks & Funds',
    description:
      'Tools to pull public market data, including quotes, fundamentals, ' +
      'earnings, screeners, and more.',
  },
])
