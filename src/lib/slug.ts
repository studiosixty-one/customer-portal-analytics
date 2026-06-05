/** Convert arbitrary text into a URL-safe slug. */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD") // decompose accents; the ASCII filter then drops the marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "page";
}
