/**
 * Generates a URL-safe slug from a title.
 * e.g. "Hello World! 🚀" → "hello-world"
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")                       // decompose unicode accents
    .replace(/[̀-ͯ]/g, "")        // strip accent marks
    .replace(/[^a-z0-9\s-]/g, "")          // keep alphanumeric, spaces, hyphens
    .trim()
    .replace(/\s+/g, "-")                   // spaces → hyphens
    .replace(/-+/g, "-")                    // collapse multiple hyphens
    .substring(0, 80);                      // cap length
}

/**
 * Appends a random 6-char suffix to make the slug unique.
 * Used when the base slug already exists for this author.
 */
export function uniqueSlug(slug: string): string {
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${slug}-${suffix}`;
}

/**
 * Strips HTML tags from content to get plain text.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Estimates reading time in minutes (avg 200 words/min).
 */
export function calcReadingTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200));
}

/**
 * Counts words in a plain text string.
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Extracts a plain-text excerpt from HTML content (first 200 chars).
 */
export function extractExcerpt(html: string, maxLen = 200): string {
  const text = stripHtml(html);
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen).replace(/\w+$/, "") + "...";
}

/**
 * Generate a new UUID v4.
 * Uses crypto.randomUUID() which is available in CF Workers natively.
 */
export function newUUID(): string {
  return crypto.randomUUID();
}
