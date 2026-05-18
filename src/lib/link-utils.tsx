import React from "react";

const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+)/g;

/**
 * Renders text content with URLs converted to clickable links.
 * Returns an array of React elements (text spans and anchor tags).
 */
export function renderContentWithLinks(text: string, linkClassName?: string): React.ReactNode[] {
  if (!text) return [text];

  const parts = text.split(URL_REGEX);
  if (parts.length <= 1) return [text];

  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      // Reset regex lastIndex since we're re-testing
      URL_REGEX.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName || "text-[#0A4D5C] underline decoration-[#0A4D5C]/40 underline-offset-2 hover:decoration-[#0A4D5C] transition-colors"}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    // Reset regex lastIndex
    URL_REGEX.lastIndex = 0;
    return part;
  });
}
