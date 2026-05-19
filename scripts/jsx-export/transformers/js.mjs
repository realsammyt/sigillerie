// js.mjs -- JS/Babel transformer for the sigillerie JSX export pipeline.
// Converts HTML-embedded module scripts into React component parts.

import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';

const traverse = _traverse.default ?? _traverse;
const generate = _generate.default ?? _generate;

// Page-contract globals sigillerie sets on window. Strip entire statements only.
const PAGE_CONTRACT_GLOBALS = new Set([
  '__ready',
  '__recording',
  '__sceneReady',
  '__renderFrame',
  '__duration',
  '__audioCues',
  '__audioRuntime',
  '__capabilities',
]);

// Extract bare package import specifier from an esm.sh URL.
// Preserves any subpath after the version.
// e.g. "https://esm.sh/react@18"                  => "react"
//      "https://esm.sh/react-dom@18/client"       => "react-dom/client"
//      "https://esm.sh/leva@0.9?deps=react@18"    => "leva"
//      "https://esm.sh/@scope/pkg@1.2/sub"        => "@scope/pkg/sub"
function esmshToBare(url) {
  const path = url.replace(/^https?:\/\/esm\.sh\//, '');
  const noQuery = path.split('?')[0];
  // Pull off the package name (with leading scope if present).
  let pkg, rest;
  if (noQuery.startsWith('@')) {
    const atParts = noQuery.slice(1).split('@');
    pkg = '@' + atParts[0]; // "@scope/pkg"
    rest = atParts.slice(1).join('@'); // "version/subpath" or ""
  } else {
    const atParts = noQuery.split('@');
    pkg = atParts[0]; // "pkg"
    rest = atParts.slice(1).join('@'); // "version/subpath" or ""
  }
  if (!rest) return pkg;
  // rest is "version" or "version/subpath". Strip the first path segment (version).
  const subpath = rest.split('/').slice(1).join('/');
  return subpath ? `${pkg}/${subpath}` : pkg;
}

function isEsmSh(src) {
  return /^https?:\/\/esm\.sh\//.test(src);
}

// Returns true when an import source is already a bare specifier
// (no protocol, no relative path prefix).
function isBareSpecifier(src) {
  return !src.startsWith('.') && !src.startsWith('/') && !/^https?:\/\//.test(src);
}

// Resolve the final import source given the importmap.
// Returns { resolved: string, wasMapped: boolean }
function resolveSource(src, importmap) {
  if (importmap[src]) {
    const mapped = importmap[src];
    if (isEsmSh(mapped)) return { resolved: esmshToBare(mapped), wasMapped: true };
    return { resolved: mapped, wasMapped: true };
  }
  if (isEsmSh(src)) return { resolved: esmshToBare(src), wasMapped: false };
  return { resolved: src, wasMapped: false };
}

// Infer a TypeScript type string from a leva control descriptor value.
// Returns { tsType, isColor }
function inferType(valueNode) {
  if (!valueNode) return { tsType: 'unknown', isColor: false };

  if (t.isObjectExpression(valueNode)) {
    // Leva control object shape: { value, min, max, options, ... }
    const valueEntry = valueNode.properties.find(
      (p) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'value' })
    );
    const optionsProp = valueNode.properties.find(
      (p) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'options' })
    );

    if (optionsProp && t.isObjectProperty(optionsProp)) {
      const opts = optionsProp.value;
      if (t.isArrayExpression(opts)) {
        const literals = opts.elements
          .filter((el) => t.isStringLiteral(el))
          .map((el) => `'${el.value}'`);
        if (literals.length > 0) {
          return { tsType: literals.join(' | '), isColor: false };
        }
      }
    }

    if (valueEntry && t.isObjectProperty(valueEntry)) {
      return inferType(valueEntry.value);
    }
    return { tsType: 'unknown', isColor: false };
  }

  if (t.isBooleanLiteral(valueNode)) return { tsType: 'boolean', isColor: false };
  if (t.isNumericLiteral(valueNode)) return { tsType: 'number', isColor: false };

  if (t.isStringLiteral(valueNode)) {
    const v = valueNode.value;
    // Hex color or CSS color keyword heuristic
    const isColor =
      /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) ||
      /^(rgb|hsl|oklch|lch)\(/.test(v);
    return { tsType: 'string', isColor };
  }

  return { tsType: 'unknown', isColor: false };
}

// Extract a JS-literal expression string from a node, or undefined if not a literal.
// Strings are quoted (JSON.stringify); numbers and booleans are stringified directly.
function literalValue(node) {
  if (t.isStringLiteral(node)) return JSON.stringify(node.value);
  if (t.isNumericLiteral(node)) return String(node.value);
  if (t.isBooleanLiteral(node)) return String(node.value);
  return undefined;
}

/**
 * Transform sigillerie HTML-embedded JavaScript / JSX into the parts a
 * React component needs: bare-package imports, the component body, the props
 * interface (derived from leva useControls calls), and a list of warnings
 * for features that v1 of the exporter does not support.
 *
 * @param {string} jsString   raw contents of a <script type="module"> block
 * @param {Record<string,string>} importmap   the importmap from the HTML (e.g. { "react": "https://esm.sh/react@18" })
 * @returns {Promise<{
 *   imports: Array<{ specifiers: Array<{ local: string, imported?: string, default?: boolean }>, from: string }>,
 *   body: string,
 *   propsInterface: Array<{ name: string, type: string, default: string }>,
 *   warnings: string[]
 * }>}
 */
export async function transformJS(jsString, importmap) {
  const imports = [];
  const propsInterface = [];
  const warnings = [];

  if (!jsString || !jsString.trim()) {
    return { imports, body: '', propsInterface, warnings };
  }

  const ast = parser.parse(jsString, {
    sourceType: 'module',
    plugins: ['jsx'],
  });

  // Collect nodes to remove (by reference).
  const nodesToRemove = new Set();

  // Track which identifiers come from useControls so we can rewrite them.
  // Map: localName => { tsType, defaultValue, isColor }
  const controlledProps = new Map();

  // Track whether leva import was found (to strip it).
  let levaImportPath = null;

  // --- Pass 1: collect information ---

  // Walk imports to collect and classify them.
  const importNodes = [];
  ast.program.body.forEach((node) => {
    if (t.isImportDeclaration(node)) {
      importNodes.push(node);
    }
  });

  for (const node of importNodes) {
    const { resolved } = resolveSource(node.source.value, importmap ?? {});

    if (resolved === 'leva' || node.source.value === 'leva') {
      levaImportPath = node;
      nodesToRemove.add(node);
      continue;
    }

    const specifiers = node.specifiers.map((s) => {
      if (t.isImportDefaultSpecifier(s)) {
        return { local: s.local.name, default: true };
      }
      if (t.isImportNamespaceSpecifier(s)) {
        return { local: s.local.name, namespace: true };
      }
      // ImportSpecifier: named import
      const imported =
        t.isIdentifier(s.imported) ? s.imported.name : s.imported.value;
      return {
        local: s.local.name,
        imported: imported !== s.local.name ? imported : undefined,
      };
    });

    imports.push({ specifiers, from: resolved });
  }

  // --- Pass 2: walk the AST for mutations ---

  traverse(ast, {
    // Strip page-contract globals: window.__xxx = ...
    ExpressionStatement(path) {
      const expr = path.node.expression;
      if (t.isAssignmentExpression(expr)) {
        const left = expr.left;
        if (
          t.isMemberExpression(left) &&
          t.isIdentifier(left.object, { name: 'window' }) &&
          t.isIdentifier(left.property) &&
          (PAGE_CONTRACT_GLOBALS.has(left.property.name) ||
            left.property.name.startsWith('__'))
        ) {
          nodesToRemove.add(path.node);
          return;
        }
      }
    },

    // Strip createRoot(...).render(<App />) call expressions.
    CallExpression(path) {
      const callee = path.node.callee;

      // Pattern: createRoot(...).render(...)
      if (
        t.isMemberExpression(callee) &&
        t.isIdentifier(callee.property, { name: 'render' }) &&
        t.isCallExpression(callee.object) &&
        t.isIdentifier(callee.object.callee, { name: 'createRoot' })
      ) {
        // Walk up to find the ExpressionStatement and remove it.
        let stmtPath = path;
        while (stmtPath && !t.isExpressionStatement(stmtPath.node)) {
          stmtPath = stmtPath.parentPath;
        }
        if (stmtPath) nodesToRemove.add(stmtPath.node);
        return;
      }

      // Detect useControls calls.
      if (
        t.isIdentifier(callee, { name: 'useControls' }) &&
        path.node.arguments.length >= 1 &&
        t.isObjectExpression(path.node.arguments[0])
      ) {
        const schema = path.node.arguments[0];
        const declPath = path.parentPath; // VariableDeclarator
        const varDeclPath = declPath?.parentPath; // VariableDeclaration

        // Collect destructured names from: const { x, y } = useControls({...})
        if (
          declPath &&
          t.isVariableDeclarator(declPath.node) &&
          t.isObjectPattern(declPath.node.id)
        ) {
          const keys = declPath.node.id.properties
            .filter((p) => t.isObjectProperty(p))
            .map((p) => ({
              key: t.isIdentifier(p.key) ? p.key.name : null,
              local: t.isIdentifier(p.value) ? p.value.name : null,
            }))
            .filter((k) => k.key && k.local);

          for (const { key, local } of keys) {
            const schemaProp = schema.properties.find(
              (p) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: key })
            );
            let tsType = 'unknown';
            let isColor = false;
            let defaultValue = 'undefined';

            if (schemaProp && t.isObjectProperty(schemaProp)) {
              const val = schemaProp.value;
              const inferred = inferType(val);
              tsType = inferred.tsType;
              isColor = inferred.isColor;

              // Extract the actual default value
              if (t.isObjectExpression(val)) {
                const valProp = val.properties.find(
                  (p) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'value' })
                );
                if (valProp && t.isObjectProperty(valProp)) {
                  const lv = literalValue(valProp.value);
                  defaultValue = lv !== undefined ? lv : generate(valProp.value).code;
                }
              } else {
                const lv = literalValue(val);
                defaultValue = lv !== undefined ? lv : generate(val).code;
              }
            }

            controlledProps.set(local, { tsType, defaultValue, isColor });
            propsInterface.push({
              name: local,
              type: tsType + (isColor ? ' /* color */' : ''),
              default: defaultValue,
            });
          }

          // Mark the entire VariableDeclaration for removal.
          if (varDeclPath && t.isVariableDeclaration(varDeclPath.node)) {
            nodesToRemove.add(varDeclPath.node);
          }
        }
      }
    },

    // Detect unsupported features.
    NewExpression(path) {
      const callee = path.node.callee;
      const line = path.node.loc?.start.line ?? '?';

      if (t.isMemberExpression(callee) && t.isIdentifier(callee.object, { name: 'THREE' })) {
        warnings.push(
          `3D / three.js detected (line ${line}). v1 exporter does not support 3D deliverables; consider shipping the HTML as-is or waiting for v2.`
        );
      }

      if (t.isMemberExpression(callee) && t.isIdentifier(callee.object, { name: 'Tone' })) {
        warnings.push(
          `Tone.js / runtime audio detected (line ${line}). v1 exporter does not support audio deliverables.`
        );
      }
    },

    MemberExpression(path) {
      // document.createElement('canvas')
      const node = path.node;
      if (
        t.isIdentifier(node.object, { name: 'document' }) &&
        t.isIdentifier(node.property, { name: 'createElement' })
      ) {
        const call = path.parentPath?.node;
        if (
          t.isCallExpression(call) &&
          call.arguments.length >= 1 &&
          t.isStringLiteral(call.arguments[0], { value: 'canvas' })
        ) {
          const line = node.loc?.start.line ?? '?';
          warnings.push(
            `Direct canvas creation detected (line ${line}). Confirm whether this is a 3D or 2D-charting use case.`
          );
        }
      }
    },

    JSXOpeningElement(path) {
      const name = path.node.name;
      if (t.isJSXIdentifier(name, { name: 'canvas' })) {
        const line = path.node.loc?.start.line ?? '?';
        warnings.push(
          `Direct canvas creation detected (line ${line}). Confirm whether this is a 3D or 2D-charting use case.`
        );
      }
    },

    ImportDeclaration(path) {
      const src = path.node.source.value;
      const line = path.node.loc?.start.line ?? '?';

      const threePackages = ['@react-three/fiber', '@react-three/drei', '@react-three/xr'];
      if (threePackages.includes(src)) {
        warnings.push(
          `3D / three.js detected (line ${line}). v1 exporter does not support 3D deliverables; consider shipping the HTML as-is or waiting for v2.`
        );
      }

      if (src === 'tone' || isEsmSh(src) && esmshToBare(src) === 'tone') {
        warnings.push(
          `Tone.js / runtime audio detected (line ${line}). v1 exporter does not support audio deliverables.`
        );
      }
    },
  });

  // --- Pass 3: drop dead import specifiers ---
  // When createRoot calls are stripped, the createRoot specifier is dead. Walk
  // imports and prune specifiers whose only consumers were removed statements.

  const REMOVED_NAMES = new Set(['createRoot', 'Leva']);
  // (Leva is a leva named export rendered as a component; safe to drop when leva
  // import is being removed anyway via nodesToRemove; this guards the case where
  // a different module also exported a Leva-named symbol.)

  for (const node of importNodes) {
    if (nodesToRemove.has(node)) continue;
    // Filter out specifiers whose local name is in REMOVED_NAMES.
    const survivingSpec = node.specifiers.filter(
      (s) => !REMOVED_NAMES.has(s.local.name)
    );
    if (survivingSpec.length === 0) {
      nodesToRemove.add(node);
    } else if (survivingSpec.length !== node.specifiers.length) {
      node.specifiers = survivingSpec;
    }
  }

  // Also reflect the prune in the collected imports[] array.
  for (let i = imports.length - 1; i >= 0; i--) {
    const survivors = imports[i].specifiers.filter(
      (s) => !REMOVED_NAMES.has(s.local)
    );
    if (survivors.length === 0) imports.splice(i, 1);
    else imports[i].specifiers = survivors;
  }

  // --- Pass 4: remove marked nodes ---

  traverse(ast, {
    Statement(path) {
      if (nodesToRemove.has(path.node)) {
        path.remove();
      }
    },
    ImportDeclaration(path) {
      if (nodesToRemove.has(path.node)) {
        path.remove();
      }
    },
  });

  // --- Pass 5: find the primary App function body ---
  // Convention: look for a function named App (or the first FunctionDeclaration
  // that returns JSX). Extract its body as the component body string.

  let bodyString = '';

  // First try to find a function named App.
  let appFn = null;
  for (const node of ast.program.body) {
    if (
      t.isFunctionDeclaration(node) &&
      node.id &&
      node.id.name === 'App'
    ) {
      appFn = node;
      break;
    }
    // Arrow function / variable: const App = () => { ... }
    if (t.isVariableDeclaration(node)) {
      for (const decl of node.declarations) {
        if (
          t.isIdentifier(decl.id, { name: 'App' }) &&
          (t.isArrowFunctionExpression(decl.init) || t.isFunctionExpression(decl.init))
        ) {
          appFn = decl.init;
          break;
        }
      }
    }
    if (appFn) break;
  }

  let returnJsx = '';

  if (appFn) {
    const bodyBlock = appFn.body;
    if (t.isBlockStatement(bodyBlock)) {
      // Split statements into pre-return + return.
      const preReturn = [];
      let returnStmt = null;
      for (const s of bodyBlock.body) {
        if (t.isReturnStatement(s)) {
          returnStmt = s;
          break;
        }
        preReturn.push(s);
      }
      bodyString = preReturn
        .map((s) => generate(s, { jsescOption: { minimal: true } }).code)
        .join('\n');
      if (returnStmt && returnStmt.argument) {
        returnJsx = generate(returnStmt.argument, { jsescOption: { minimal: true } }).code;
      }
    }
  } else {
    // Fallback: generate the entire remaining program body.
    const remaining = ast.program.body
      .map((s) => generate(s, { jsescOption: { minimal: true } }).code)
      .join('\n');
    bodyString = remaining;
  }

  return { imports, body: bodyString, returnJsx, propsInterface, warnings };
}
