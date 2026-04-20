// Stringify a JSON-LD payload for embedding inside <script type="application/ld+json">.
// Browsers terminate the script element on the first "</script>" they see — even inside a
// quoted JSON string — so we need to escape the closing tag. Also escape "<!--" and "]]>"
// so the payload cannot open an HTML comment or close a CDATA section that hides following
// markup (JSON-LD is sometimes served as XHTML/CDATA by third-party indexers).
export function stringifyJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/<\/(script)/gi, "<\\/$1")
    .replace(/<!--/g, "<\\!--")
    .replace(/]]>/g, "]]\\u003e");
}
