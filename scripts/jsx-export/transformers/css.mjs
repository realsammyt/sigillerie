import postcss from 'postcss';
import cssMap from '../css-map.json' with { type: 'json' };

// Tailwind v4 breakpoint map (min-width in px)
const BREAKPOINTS = {
  640: 'sm',
  768: 'md',
  1024: 'lg',
  1280: 'xl',
  1536: '2xl',
};

// Simple pseudo-class variants Tailwind handles directly
const PSEUDO_VARIANTS = {
  ':hover': 'hover',
  ':focus': 'focus',
  ':active': 'active',
  ':disabled': 'disabled',
  ':focus-within': 'focus-within',
  ':focus-visible': 'focus-visible',
  ':visited': 'visited',
  ':checked': 'checked',
  ':required': 'required',
  ':valid': 'valid',
  ':invalid': 'invalid',
  ':placeholder': 'placeholder',
  '::placeholder': 'placeholder',
};

// CSS property to Tailwind arbitrary-value prefix
const PROP_TO_PREFIX = {
  'background': 'bg',
  'background-color': 'bg',
  'color': 'text',
  'margin': 'm',
  'margin-top': 'mt',
  'margin-right': 'mr',
  'margin-bottom': 'mb',
  'margin-left': 'ml',
  'padding': 'p',
  'padding-top': 'pt',
  'padding-right': 'pr',
  'padding-bottom': 'pb',
  'padding-left': 'pl',
  'width': 'w',
  'height': 'h',
  'max-width': 'max-w',
  'max-height': 'max-h',
  'min-width': 'min-w',
  'min-height': 'min-h',
  'gap': 'gap',
  'row-gap': 'gap-y',
  'column-gap': 'gap-x',
  'border-radius': 'rounded',
  'font-size': 'text',
  'font-weight': 'font',
  'line-height': 'leading',
  'letter-spacing': 'tracking',
  'opacity': 'opacity',
  'z-index': 'z',
  'top': 'top',
  'right': 'right',
  'bottom': 'bottom',
  'left': 'left',
  'inset': 'inset',
  'flex-grow': 'grow',
  'flex-shrink': 'shrink',
  'flex-basis': 'basis',
  'grid-column': 'col',
  'grid-row': 'row',
  'transform': 'transform',
  'translate-x': 'translate-x',
  'translate-y': 'translate-y',
  'scale': 'scale',
  'rotate': 'rotate',
  'skew-x': 'skew-x',
  'skew-y': 'skew-y',
};

// Shorthand expansion: property -> longhand properties given a parsed value array
// Returns [[prop, value], ...] or null if not expandable
function expandShorthand(prop, value) {
  const parts = value.trim().split(/\s+/);

  if (prop === 'margin' || prop === 'padding') {
    const prefix = prop === 'margin' ? 'margin' : 'padding';
    const sides = prop === 'margin'
      ? ['margin-top', 'margin-right', 'margin-bottom', 'margin-left']
      : ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'];

    if (parts.length === 1) {
      return sides.map(s => [s, parts[0]]);
    }
    if (parts.length === 2) {
      // vertical | horizontal
      return [
        [sides[0], parts[0]], [sides[1], parts[1]],
        [sides[2], parts[0]], [sides[3], parts[1]],
      ];
    }
    if (parts.length === 3) {
      // top | horizontal | bottom
      return [
        [sides[0], parts[0]], [sides[1], parts[1]],
        [sides[2], parts[2]], [sides[3], parts[1]],
      ];
    }
    if (parts.length === 4) {
      return sides.map((s, i) => [s, parts[i]]);
    }
  }

  return null;
}

// Encode a CSS value for use inside Tailwind's arbitrary-value brackets.
// Spaces become underscores per Tailwind v4 convention.
function encodeArbitrary(value) {
  return value.trim().replace(/\s+/g, '_');
}

// Attempt to produce an arbitrary-value Tailwind class for a property/value pair.
// Returns a class string or null if the property has no known prefix.
function toArbitraryClass(prop, value, prefix) {
  // CSS variable shorthand: var(--foo) -> [--foo]
  const varMatch = value.trim().match(/^var\((--[\w-]+)\)$/);
  if (varMatch) {
    return `${prefix}-[${varMatch[1]}]`;
  }

  return `${prefix}-[${encodeArbitrary(value)}]`;
}

// Normalize a declaration key for cssMap lookup.
function normalizeKey(prop, value) {
  return `${prop.trim().toLowerCase()}: ${value.trim()}`;
}

// Extract a pseudo-class variant from a selector (simple cases only).
// Returns { baseSelector, variant } or null if selector is complex.
function extractVariant(selector) {
  // Only handle single-class or single-element selectors with one pseudo
  for (const [pseudo, variant] of Object.entries(PSEUDO_VARIANTS)) {
    if (selector.endsWith(pseudo)) {
      const base = selector.slice(0, -pseudo.length);
      // Reject complex selectors (has space, combinators, nested pseudos)
      if (/[\s>~+]/.test(base) || base.includes(':has(') || base.includes(':nth-')) {
        return null;
      }
      return { baseSelector: base, variant };
    }
  }
  return null;
}

// Map declarations for a single rule, returning class strings.
// Pushes unresolved declarations as raw CSS rule fragments into residualDecls.
function mapDeclarations(decls, variantPrefix, residualDecls) {
  const classes = [];

  for (const decl of decls) {
    const prop = decl.prop.toLowerCase().trim();
    const value = decl.value.trim();
    const key = normalizeKey(prop, value);

    // Direct hit
    if (cssMap[key]) {
      for (const cls of cssMap[key]) {
        classes.push(variantPrefix ? `${variantPrefix}:${cls}` : cls);
      }
      continue;
    }

    // Try shorthand expansion
    const expanded = expandShorthand(prop, value);
    if (expanded) {
      let allResolved = true;
      const expandedClasses = [];

      for (const [longProp, longVal] of expanded) {
        const longKey = normalizeKey(longProp, longVal);
        if (cssMap[longKey]) {
          for (const cls of cssMap[longKey]) {
            expandedClasses.push(variantPrefix ? `${variantPrefix}:${cls}` : cls);
          }
        } else {
          // Try arbitrary for each longhand
          const prefix = PROP_TO_PREFIX[longProp];
          if (prefix) {
            const cls = toArbitraryClass(longProp, longVal, prefix);
            expandedClasses.push(variantPrefix ? `${variantPrefix}:${cls}` : cls);
          } else {
            allResolved = false;
          }
        }
      }

      if (!allResolved) {
        residualDecls.push(decl);
      } else {
        classes.push(...expandedClasses);
      }
      continue;
    }

    // Arbitrary-value fallback
    const prefix = PROP_TO_PREFIX[prop];
    if (prefix) {
      const cls = toArbitraryClass(prop, value, prefix);
      classes.push(variantPrefix ? `${variantPrefix}:${cls}` : cls);
      continue;
    }

    // Cannot map - goes to residual
    residualDecls.push(decl);
  }

  return classes;
}

/**
 * Transform a CSS string into Tailwind-class assignments per selector,
 * with residual rules for anything Tailwind cannot express.
 *
 * @param {string} cssString  raw CSS, e.g. contents of a <style> block
 * @returns {Promise<{
 *   selectorToClasses: Record<string, string[]>,
 *   residualCSS: string,
 *   cssVars: Record<string, string>
 * }>}
 */
export async function transformCSS(cssString) {
  const root = postcss.parse(cssString);

  /** @type {Record<string, string[]>} */
  const selectorToClasses = {};
  /** @type {string[]} */
  const residualRules = [];
  /** @type {Record<string, string>} */
  const cssVars = {};

  // Track handled-and-skipped nodes so the walker does not double-process
  // children that belong to a parent we already consumed (e.g. @keyframes inner
  // rules, @media inner rules, :root decls).
  const handled = new WeakSet();

  root.walk(node => {
    // Skip if a parent already consumed this node.
    let p = node.parent;
    while (p) {
      if (handled.has(p)) return;
      p = p.parent;
    }

    // CSS custom properties from :root
    if (node.type === 'rule' && node.selector.trim() === ':root') {
      handled.add(node);
      node.walkDecls(/^--/, decl => {
        const key = decl.prop.replace(/^--/, '');
        cssVars[key] = decl.value.trim();
      });
      const nonVarDecls = [];
      node.walkDecls(decl => {
        if (!decl.prop.startsWith('--')) nonVarDecls.push(decl);
      });
      if (nonVarDecls.length > 0) {
        const residualDecls = [];
        const classes = mapDeclarations(nonVarDecls, '', residualDecls);
        if (classes.length) {
          selectorToClasses[':root'] = [
            ...(selectorToClasses[':root'] || []),
            ...classes,
          ];
        }
        if (residualDecls.length) {
          residualRules.push(ruleToString(node, residualDecls));
        }
      }
      return;
    }

    // @keyframes -> residual verbatim, do not process inner rules
    if (node.type === 'atrule' && node.name === 'keyframes') {
      handled.add(node);
      residualRules.push(node.toString());
      return;
    }

    // @font-face -> residual verbatim
    if (node.type === 'atrule' && node.name === 'font-face') {
      handled.add(node);
      residualRules.push(node.toString());
      return;
    }

    // @media queries
    if (node.type === 'atrule' && node.name === 'media') {
      handled.add(node);
      const params = node.params.trim();
      const bpClass = resolveBreakpoint(params);

      if (bpClass) {
        node.walkRules(innerRule => {
          processRule(innerRule, bpClass, selectorToClasses, residualRules);
        });
      } else {
        residualRules.push(node.toString());
      }
      return;
    }

    // Regular rules (skip :root, which we handled above)
    if (node.type === 'rule') {
      if (node.selector.trim() === ':root') return;
      processRule(node, '', selectorToClasses, residualRules);
    }
  });

  return {
    selectorToClasses,
    residualCSS: residualRules.join('\n'),
    cssVars,
  };
}

// Attempt to match a @media params string to a Tailwind breakpoint prefix.
// Returns variant string (e.g. 'md') or null.
function resolveBreakpoint(params) {
  // Match patterns like: (min-width: 768px) or screen and (min-width: 768px)
  const match = params.match(/\(\s*min-width\s*:\s*(\d+)px\s*\)/);
  if (!match) return null;
  const px = parseInt(match[1], 10);
  return BREAKPOINTS[px] || null;
}

// Process a single CSS rule node, collecting Tailwind classes or residual output.
function processRule(node, breakpointPrefix, selectorToClasses, residualRules) {
  const rawSelector = node.selector.trim();

  // Detect pseudo-class variant (e.g. .foo:hover)
  const variantInfo = extractVariant(rawSelector);
  const variant = variantInfo ? variantInfo.variant : null;
  const baseSelector = variantInfo ? variantInfo.baseSelector : rawSelector;

  // Complex selector check (has space/combinator not from pseudo extraction, or complex pseudo)
  if (!variantInfo && isComplexSelector(rawSelector)) {
    residualRules.push(node.toString());
    return;
  }

  const decls = [];
  node.walkDecls(decl => decls.push(decl));

  if (!decls.length) return;

  // Build the variant prefix chain: breakpoint + pseudo
  let variantPrefix = '';
  if (breakpointPrefix && variant) {
    variantPrefix = `${breakpointPrefix}:${variant}`;
  } else if (breakpointPrefix) {
    variantPrefix = breakpointPrefix;
  } else if (variant) {
    variantPrefix = variant;
  }

  const residualDecls = [];
  const classes = mapDeclarations(decls, variantPrefix, residualDecls);

  if (classes.length) {
    const key = baseSelector;
    selectorToClasses[key] = [...(selectorToClasses[key] || []), ...classes];
  }

  if (residualDecls.length) {
    residualRules.push(ruleToString(node, residualDecls));
  }
}

// Determine if a selector is too complex for simple pseudo-variant extraction.
function isComplexSelector(selector) {
  // Multiple selectors (comma-separated) - handle each separately if needed; for now, flag as complex
  if (selector.includes(',')) return true;
  // Descendant/child/sibling combinators
  if (/[\s>~+]/.test(selector.replace(/:[\w-]+(\([^)]*\))?/g, ''))) return true;
  // :has(), :nth-child(), ::before, ::after (structural pseudos we don't handle)
  if (/:has\(|:nth-|:not\(|:where\(|:is\(|::before|::after|::first/.test(selector)) return true;
  return false;
}

// Rebuild a CSS rule string from a node using only the specified declarations.
function ruleToString(node, decls) {
  const body = decls.map(d => `  ${d.prop}: ${d.value};`).join('\n');
  return `${node.selector} {\n${body}\n}`;
}
