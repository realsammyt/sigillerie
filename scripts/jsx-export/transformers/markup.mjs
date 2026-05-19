// markup.mjs -- HTML-to-JSX transformer for the sigillerie JSX export pipeline.
import { load } from 'cheerio';

// HTML attribute -> JSX attribute name map.
const ATTR_MAP = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  autofocus: 'autoFocus',
  autoplay: 'autoPlay',
  playsinline: 'playsInline',
  crossorigin: 'crossOrigin',
  srcset: 'srcSet',
};

// Void elements that JSX requires self-closed.
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// Inline event handler attr -> JSX name.
const EVENT_MAP = {
  onclick: 'onClick',
  ondblclick: 'onDoubleClick',
  onmousedown: 'onMouseDown',
  onmouseup: 'onMouseUp',
  onmouseover: 'onMouseOver',
  onmousemove: 'onMouseMove',
  onmouseout: 'onMouseOut',
  onmouseenter: 'onMouseEnter',
  onmouseleave: 'onMouseLeave',
  onkeydown: 'onKeyDown',
  onkeyup: 'onKeyUp',
  onkeypress: 'onKeyPress',
  onfocus: 'onFocus',
  onblur: 'onBlur',
  onchange: 'onChange',
  oninput: 'onInput',
  onsubmit: 'onSubmit',
  onreset: 'onReset',
  onscroll: 'onScroll',
  onload: 'onLoad',
  onerror: 'onError',
};

// Convert kebab-case CSS property to camelCase.
function cssPropertyToCamel(prop) {
  return prop.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// Convert a CSS value string to JS primitive where applicable.
// Only bare numbers (no units) become numeric.
function cssValueToJs(value) {
  const trimmed = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return `'${trimmed.replace(/'/g, "\\'")}'`;
}

// Parse inline style string into a JSX style object literal string.
// e.g. "color: red; flex: 1" -> "{ color: 'red', flex: 1 }"
function parseStyleToJsx(styleStr) {
  const decls = styleStr.split(';').map(s => s.trim()).filter(Boolean);
  const pairs = decls.map(decl => {
    const colon = decl.indexOf(':');
    if (colon === -1) return null;
    const prop = cssPropertyToCamel(decl.slice(0, colon));
    const val = cssValueToJs(decl.slice(colon + 1));
    return `${prop}: ${val}`;
  }).filter(Boolean);
  return `{{ ${pairs.join(', ')} }}`;
}

// Wrap an inline event handler value in a JSX arrow function.
// e.g. "doThing()" -> "() => doThing()"
function wrapEventHandler(value) {
  const trimmed = value.trim();
  // If it's already a full function expression, leave it. Otherwise wrap it.
  // TODO: complex handler expressions may not survive wrapping cleanly.
  return `{() => ${trimmed}}`;
}

// Escape literal { and } in text nodes.
function escapeTextBraces(text) {
  return text.replace(/\{/g, "{'{'}").replace(/\}/g, "{'}'}");
}

// Build a map of selector -> Set<className> for fast lookup.
// We keep the raw selectorToClasses map and apply it via cheerio.
function applyClassMerge($, selectorToClasses) {
  for (const [selector, classes] of Object.entries(selectorToClasses)) {
    if (!classes || classes.length === 0) continue;
    try {
      $(selector).each((_, el) => {
        const existing = $(el).attr('class') || '';
        const existingSet = new Set(existing.split(/\s+/).filter(Boolean));
        for (const cls of classes) existingSet.add(cls);
        $(el).attr('class', [...existingSet].join(' '));
      });
    } catch {
      // Selector may be invalid in this fragment; skip silently.
    }
  }
}

// Serialize a cheerio element tree to a JSX string with 2-space indentation.
function serializeToJsx($, node, depth = 0) {
  const indent = '  '.repeat(depth);

  if (node.type === 'text') {
    const text = node.data;
    if (!text.trim()) {
      // Preserve whitespace-only text only if it contains a newline.
      return text.includes('\n') ? '\n' : '';
    }
    return indent + escapeTextBraces(text.trim());
  }

  if (node.type === 'comment') {
    return `${indent}{/* ${node.data.trim()} */}`;
  }

  if (node.type !== 'tag') return '';

  const tagName = node.name;
  const attribs = node.attribs || {};
  const attrParts = [];

  for (const [rawAttr, rawVal] of Object.entries(attribs)) {
    // aria-* and data-* pass through unchanged.
    if (rawAttr.startsWith('aria-') || rawAttr.startsWith('data-')) {
      attrParts.push(`${rawAttr}="${rawVal}"`);
      continue;
    }

    // Inline event handlers.
    const eventJsx = EVENT_MAP[rawAttr.toLowerCase()];
    if (eventJsx) {
      attrParts.push(`${eventJsx}=${wrapEventHandler(rawVal)}`);
      continue;
    }

    // style attribute -> JSX style object.
    if (rawAttr === 'style') {
      attrParts.push(`style=${parseStyleToJsx(rawVal)}`);
      continue;
    }

    // Map renamed attributes.
    const jsxAttr = ATTR_MAP[rawAttr.toLowerCase()] || rawAttr;

    // Boolean attributes (no value or value === attr name).
    if (rawVal === '' || rawVal === rawAttr) {
      attrParts.push(jsxAttr);
      continue;
    }

    attrParts.push(`${jsxAttr}="${rawVal}"`);
  }

  const attribsStr = attrParts.length ? ' ' + attrParts.join(' ') : '';

  if (VOID_ELEMENTS.has(tagName)) {
    return `${indent}<${tagName}${attribsStr} />`;
  }

  const children = node.children || [];
  const childLines = [];
  for (const child of children) {
    const serialized = serializeToJsx($, child, depth + 1);
    if (serialized) childLines.push(serialized);
  }

  if (childLines.length === 0) {
    return `${indent}<${tagName}${attribsStr}></${tagName}>`;
  }

  // If there's only one text child and it's short, inline it.
  if (
    childLines.length === 1 &&
    children.length === 1 &&
    children[0].type === 'text' &&
    childLines[0].trim().length < 60 &&
    !childLines[0].includes('\n')
  ) {
    return `${indent}<${tagName}${attribsStr}>${childLines[0].trim()}</${tagName}>`;
  }

  return `${indent}<${tagName}${attribsStr}>\n${childLines.join('\n')}\n${indent}</${tagName}>`;
}

/**
 * Transform HTML markup into JSX. Rewrites HTML attributes to JSX conventions
 * and merges Tailwind classes from the CSS transformer.
 *
 * @param {string} htmlString raw body innerHTML
 * @param {Record<string,string[]>} selectorToClasses selector -> Tailwind class list
 * @returns {Promise<{ jsx: string }>}
 */
export async function transformMarkup(htmlString, selectorToClasses = {}) {
  const $ = load(htmlString, { xmlMode: false }, false);

  // Merge Tailwind classes before serialization so the class merge is
  // reflected in the cheerio attribs map that serializeToJsx reads.
  applyClassMerge($, selectorToClasses);

  // Rename HTML attrs to JSX attrs directly on every element.
  $('*').each((_, el) => {
    const attribs = el.attribs || {};
    for (const [rawAttr] of Object.entries(attribs)) {
      const lower = rawAttr.toLowerCase();
      if (ATTR_MAP[lower] && ATTR_MAP[lower] !== rawAttr) {
        attribs[ATTR_MAP[lower]] = attribs[rawAttr];
        delete attribs[rawAttr];
      }
    }
  });

  // Serialize root children (skip the implicit html/head/body wrapper).
  const bodyChildren = $('body').get(0)?.children || $.root().get(0)?.children || [];

  const lines = [];
  for (const child of bodyChildren) {
    const serialized = serializeToJsx($, child, 0);
    if (serialized) lines.push(serialized);
  }

  const jsx = lines.join('\n');
  return { jsx };
}
