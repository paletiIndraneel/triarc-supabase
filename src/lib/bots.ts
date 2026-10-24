// Crawlers, search engines, AI agents and link-preview fetchers. The admin is private, so
// src/proxy.ts refuses them outright (robots.txt and noindex only stop the polite ones).
// Pure, so tests/ can load it.

export const BLOCKED_BOTS = [
  // Search engines
  "Googlebot", "Google-InspectionTool", "Storebot-Google", "AdsBot-Google", "Mediapartners-Google",
  "Bingbot", "BingPreview", "Slurp", "DuckDuckBot", "Baiduspider", "YandexBot", "Sogou", "Exabot",
  "SeznamBot", "Applebot", "PetalBot", "Qwantify", "MojeekBot",
  // AI crawlers and agents
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web", "Claude-User", "Claude-SearchBot",
  "anthropic-ai", "Google-Extended", "Applebot-Extended", "PerplexityBot", "Perplexity-User", "CCBot",
  "Bytespider", "Amazonbot", "meta-externalagent", "meta-externalfetcher", "FacebookBot", "cohere-ai",
  "cohere-training-data-crawler", "Diffbot", "YouBot", "Timpibot", "ImagesiftBot", "omgili", "AI2Bot",
  "Ai2Bot-Dolma", "PanguBot", "Kangaroo Bot", "MistralAI-User", "DuckAssistBot", "iaskspider", "Scrapy",
  // SEO tools and archives
  "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot", "rogerbot", "BLEXBot", "DataForSeoBot", "ia_archiver",
  "archive.org_bot",
  // Link previews (chat apps fetch pages to build previews)
  "facebookexternalhit", "Twitterbot", "LinkedInBot", "Slackbot", "Discordbot", "TelegramBot",
  "WhatsApp", "SkypeUriPreview", "redditbot", "Pinterestbot",
];

// Also catches unlisted ones that describe themselves as a bot, crawler, spider or headless browser.
const BOT_PATTERN = new RegExp(
  `${BLOCKED_BOTS.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}|crawler|spider|scraper|\\bbot\\b|bot/|HeadlessChrome|python-requests|curl/|wget`,
  "i"
);

export function isBot(userAgent: string | null | undefined) {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

// One header value for every response: no indexing, archiving, snippets or AI use.
export const NO_INDEX = "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate, noai, noimageai";
