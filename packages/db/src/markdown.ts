export function firstMarkdownImage(markdown: string) {
  const match = markdown.match(/!\[[^\]]*]\((https?:\/\/[^)]+)\)/);
  return match?.[1] || null;
}

export function normalizeImportedMarkdown(markdown: string) {
  return markdown
    .replace(
      /\[\s*!\[[^\]]*]\((https?:\/\/[^)]+)\)\s*]\(https?:\/\/[^)]+\)/g,
      "![]($1)",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function removeLeadingCoverImage(markdown: string) {
  return markdown
    .replace(/^!\[[^\]]*]\(https?:\/\/[^)]+\)\s*/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
