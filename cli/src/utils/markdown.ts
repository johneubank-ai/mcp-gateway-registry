/**
 * Render markdown to terminal-friendly format
 * Simple cleanup for terminal display - doesn't do heavy rendering
 */
export function renderMarkdown(markdown: string): string {
  try {
    let text = markdown;

    // Remove markdown headers but keep the text
    text = text.replace(/^#{1,6}\s+/gm, '');

    // Remove bold/italic markers
    text = text.replace(/\*\*(.+?)\*\*/g, '$1');
    text = text.replace(/\*(.+?)\*/g, '$1');
    text = text.replace(/_(.+?)_/g, '$1');

    // Keep code blocks simple - just remove the markers
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `\n${code.trim()}\n`;
    });

    // Keep inline code backticks
    text = text.replace(/`([^`]+)`/g, '$1');

    // Links - show just the text
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    return text;
  } catch (error) {
    // Fallback to plain text if parsing fails
    return markdown;
  }
}

/**
 * Check if text contains markdown formatting
 */
export function hasMarkdown(text: string): boolean {
  const markdownPatterns = [
    /^#{1,6}\s/m,           // Headers
    /\*\*.*?\*\*/,          // Bold
    /_.*?_/,                // Italic
    /`.*?`/,                // Inline code
    /```[\s\S]*?```/,       // Code blocks
    /^\s*[-*+]\s/m,         // Lists
    /^\s*\d+\.\s/m,         // Numbered lists
    /\[.*?\]\(.*?\)/,       // Links
  ];

  return markdownPatterns.some(pattern => pattern.test(text));
}

/**
 * Format tool output with syntax highlighting hints
 */
export function formatToolOutput(toolName: string, output: string, isError: boolean = false): string {
  const status = isError ? "✗" : "✓";
  const header = `\n${status} **${toolName}**\n`;

  // Try to parse as JSON for better formatting
  try {
    const parsed = JSON.parse(output);
    return `${header}\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
  } catch {
    // Not JSON, return as code block
    return `${header}\`\`\`\n${output}\n\`\`\``;
  }
}
