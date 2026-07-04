import { BadRequestException } from "@nestjs/common";

const MAX_SVG_SIZE_BYTES = 200 * 1024;
const ALLOWED_TAGS = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "text",
  "line",
  "polyline",
  "polygon",
]);
const ALLOWED_ATTRIBUTES = new Set([
  "id",
  "class",
  "data-zone",
  "data-ticket-code",
  "viewBox",
  "fill",
  "stroke",
  "stroke-width",
  "opacity",
  "transform",
  "x",
  "y",
  "width",
  "height",
  "d",
  "points",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "xmlns",
  "xmlns:xlink",
]);
const BLOCKED_TAGS = /<(script|foreignobject|iframe|object|embed|form|input)\b/gi;
const BLOCKED_ATTRIBUTES = /\b(on[a-z]+|style)\b/gi;
const TAG_PATTERN = /<\/?([a-z0-9:-]+)([^>]*)>/gi;
const ATTRIBUTE_PATTERN = /([a-zA-Z_:][-a-zA-Z0-9:._-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

export function sanitizeSeatingSvgMarkup(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new BadRequestException("Seating SVG không được để trống.");
  }

  if (Buffer.byteLength(trimmed, "utf8") > MAX_SVG_SIZE_BYTES) {
    throw new BadRequestException("Seating SVG vượt quá kích thước tối đa 200 KB.");
  }

  if (!/<svg\b/i.test(trimmed)) {
    throw new BadRequestException("Seating SVG phải là một tài liệu SVG hợp lệ.");
  }

  if (BLOCKED_TAGS.test(trimmed)) {
    throw new BadRequestException("Seating SVG chứa nội dung không an toàn.");
  }

  const sanitized = trimmed.replace(TAG_PATTERN, (match, tagName: string, rawAttributes: string) => {
    const normalizedTag = tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(normalizedTag)) {
      return "";
    }

    const attributes: string[] = [];
    let attributeMatches: RegExpExecArray | null;

    ATTRIBUTE_PATTERN.lastIndex = 0;
    while ((attributeMatches = ATTRIBUTE_PATTERN.exec(rawAttributes)) !== null) {
      const [, rawName, doubleQuoted, singleQuoted, unquoted] = attributeMatches;
      const name = rawName.toLowerCase();
      const attributeValue = doubleQuoted ?? singleQuoted ?? unquoted ?? "";

      if (BLOCKED_ATTRIBUTES.test(name)) {
        continue;
      }

      if (!ALLOWED_ATTRIBUTES.has(name)) {
        continue;
      }

      if (name === "href" || name === "xlink:href") {
        const normalizedValue = attributeValue.trim().toLowerCase();
        if (!normalizedValue || normalizedValue.startsWith("javascript:")) {
          continue;
        }
      }

      const escapedValue = attributeValue.replace(/"/g, '&quot;');
      attributes.push(`${name}="${escapedValue}"`);
    }

    const attributeSuffix = attributes.length > 0 ? ` ${attributes.join(" ")}` : "";
    const isClosingTag = match.startsWith("</");

    if (isClosingTag) {
      return `</${normalizedTag}>`;
    }

    return `<${normalizedTag}${attributeSuffix}>`;
  });

  const normalizedSanitized = sanitized.replace(/\s+/g, " ").trim();

  if (!/<svg\b/i.test(normalizedSanitized)) {
    throw new BadRequestException("Seating SVG không hợp lệ sau khi làm sạch.");
  }

  return normalizedSanitized;
}
