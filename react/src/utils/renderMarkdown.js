import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ breaks: true });

// For descriptions: full block-level markdown (headings, lists, paragraphs).
export function renderMarkdown(text) {
  if (!text) return "";
  return DOMPurify.sanitize(marked.parse(text));
}

// For titles: inline-only markdown (bold/italic/strike/color), no wrapping
// <p>/<h*> block tags, since titles get embedded inside existing headings.
export function renderInlineMarkdown(text) {
  if (!text) return "";
  return DOMPurify.sanitize(marked.parseInline(text));
}
