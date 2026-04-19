// Stringify a JSON-LD payload for embedding inside <script type="application/ld+json">.
// Browsers terminate the script element on the first "</script>" they see — even inside a
// quoted JSON string — so we need to escape the closing tag. Also escape "<!--" so the
// payload cannot open an HTML comment that hides following markup.
export function stringifyJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/<\/(script)/gi, "<\\/$1")
    .replace(/<!--/g, "<\\!--");
}
