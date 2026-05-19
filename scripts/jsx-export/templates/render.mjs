// render.mjs -- Renders the component.tsx.tmpl with values from all transformers.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMPL_PATH = join(__dirname, 'component.tsx.tmpl');

// Build the importsBlock string.
// React imports go first, then other packages alphabetically.
function buildImportsBlock(imports) {
  if (!imports || imports.length === 0) return '';

  const react = [];
  const other = [];

  for (const imp of imports) {
    if (imp.from === 'react') react.push(imp);
    else other.push(imp);
  }

  // Sort non-react by module path.
  other.sort((a, b) => a.from.localeCompare(b.from));

  const ordered = [...react, ...other];

  return ordered.map(imp => {
    const defaults = imp.specifiers.filter(s => s.default);
    const named = imp.specifiers.filter(s => !s.default);

    const parts = [];
    if (defaults.length > 0) parts.push(defaults[0].local);
    if (named.length > 0) {
      const namedStr = named
        .map(s => (s.imported && s.imported !== s.local ? `${s.imported} as ${s.local}` : s.local))
        .join(', ');
      parts.push(`{ ${namedStr} }`);
    }

    return `import ${parts.join(', ')} from '${imp.from}';`;
  }).join('\n');
}

// Build the propsInterfaceBlock string.
function buildPropsInterface(propsInterface, interfaceName) {
  if (!propsInterface || propsInterface.length === 0) return '';

  const fields = propsInterface.map(p => `  ${p.name}: ${p.type};`).join('\n');
  return `interface ${interfaceName} {\n${fields}\n}`;
}

// Build the propsDestructure string.
function buildPropsDestructure(propsInterface) {
  if (!propsInterface || propsInterface.length === 0) return '';

  const pairs = propsInterface.map(p => {
    if (p.default !== undefined && p.default !== '') {
      return `${p.name} = ${p.default}`;
    }
    return p.name;
  });
  return `{ ${pairs.join(', ')} }`;
}

// Build the inner JSX content: original JSX plus an optional <style jsx> sibling
// for residual CSS. Indented at innerIndent depth.
function buildInner(jsx, residualCSS, innerIndent) {
  const indent = ' '.repeat(innerIndent);
  const indented = jsx
    .split('\n')
    .map(line => indent + line)
    .join('\n');

  if (!residualCSS || !residualCSS.trim()) return indented;

  const styleBlock = `${indent}<style jsx>{\`\n${residualCSS}\n${indent}\`}</style>`;
  return `${indented}\n${styleBlock}`;
}

// Build the jsxBlock. Composes:
//   - bare JSX,                                if no cssVars and no residualCSS
//   - wrapping fragment with style sibling,     if residualCSS but no cssVars
//   - wrapping div with cssVars + optional style sibling, if cssVars present
function buildJsxBlock(jsx, cssVars, residualCSS) {
  const hasVars = cssVars && Object.keys(cssVars).length > 0;
  const hasStyle = residualCSS && residualCSS.trim();

  if (!hasVars && !hasStyle) {
    return jsx.split('\n').map(line => '    ' + line).join('\n');
  }

  if (!hasVars && hasStyle) {
    const inner = buildInner(jsx, residualCSS, 6);
    return `    <>\n${inner}\n    </>`;
  }

  // hasVars (with or without style)
  const varPairs = Object.entries(cssVars)
    .map(([k, v]) => {
      const key = k.startsWith('--') ? k : `--${k}`;
      return `'${key}': '${v}'`;
    })
    .join(', ');

  const inner = buildInner(jsx, residualCSS, 6);
  return `    <div style={{ ${varPairs} } as React.CSSProperties}>\n${inner}\n    </div>`;
}

// Strip blank lines that accumulate when a block is empty.
function cleanBlankLines(str) {
  // Collapse runs of 3+ blank lines to at most 2.
  return str.replace(/\n{3,}/g, '\n\n');
}

/**
 * Render the component template with values from the three transformers.
 *
 * @param {{
 *   componentName: string,
 *   imports: Array<{ specifiers: Array<{ local: string, imported?: string, default?: boolean }>, from: string }>,
 *   propsInterface: Array<{ name: string, type: string, default: string }>,
 *   cssVars: Record<string, string>,
 *   body: string,
 *   jsx: string,
 *   residualCSS: string
 * }} input
 * @returns {Promise<string>}
 */
export async function renderComponent(input) {
  const {
    componentName,
    imports = [],
    propsInterface = [],
    cssVars = {},
    body = '',
    jsx = '',
    residualCSS = '',
  } = input;

  const tmpl = await readFile(TMPL_PATH, 'utf8');

  const interfaceName = propsInterface.length > 0 ? `${componentName}Props` : '{}';
  const propsDestructure = buildPropsDestructure(propsInterface);

  const importsBlock = buildImportsBlock(imports);
  const propsInterfaceBlock = buildPropsInterface(propsInterface, interfaceName);
  const jsxBlock = buildJsxBlock(jsx, cssVars, residualCSS);

  // stateAndEffectsBlock: indent body lines by 2 spaces if non-empty.
  const stateAndEffectsBlock = body.trim()
    ? body.trim().split('\n').map(l => '  ' + l).join('\n') + '\n'
    : '';

  let result = tmpl
    .replace('{{importsBlock}}', importsBlock)
    .replace('{{propsInterfaceBlock}}', propsInterfaceBlock)
    .replace('{{componentName}}', componentName)
    .replace('{{propsDestructure}}', propsDestructure)
    .replace('{{propsInterfaceName}}', interfaceName)
    .replace('{{stateAndEffectsBlock}}', stateAndEffectsBlock)
    .replace('{{jsxBlock}}', jsxBlock);

  return cleanBlankLines(result);
}
