/**
 * html2pptx.js, Sigillerie Producer-mode DOM-to-PowerPoint translator.
 *
 * Walks a Playwright-rendered DOM, reads computed styles per element, emits
 * native pptxgenjs objects (text frames, shapes, pictures) onto a slide.
 * Called by scripts/export_deck_pptx.mjs.
 *
 * API (CommonJS, importable from ESM via default-and-named interop):
 *
 *   const { translateSlideToPptx } = require('./html2pptx.js');
 *   await translateSlideToPptx(page, pptxSlide, {
 *     width: 13.333,                 // slide width  in inches (LAYOUT_WIDE)
 *     height: 7.5,                   // slide height in inches
 *     rootSelector: 'section.active',// or 'body' for single-page slide
 *     imageFallback: false,          // screenshot non-translatable elements
 *     pres: pptxInstance,            // optional, exposes pres.ShapeType
 *     tmpDir: '/tmp',                // for SVG rasterization
 *   });
 *
 * Returns: { translated, skipped, errors }, caller decides whether to
 * surface skipped elements or treat any error as fatal.
 *
 * The 4 hard constraints from modes/producer/editable-pptx.md are enforced:
 *   1. Text must live in <p>/<h1-6>/<li>, never bare in a <div>
 *   2. No CSS gradients, solid fills only
 *   3. Background, border, shadow on wrapping <div>, never on text tag
 *   4. Images via <img>, never CSS background-image
 *
 * Designed to be called from a Playwright page that the caller manages (the
 * caller owns browser lifecycle, viewport, and navigation, this script only
 * reads computed styles and emits to a pptxgenjs slide).
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// ── CONFIG ──────────────────────────────────────────────────────────────

// PowerPoint EMU conversion. 914400 EMU per inch, 72 pt per inch, 96 px per
// CSS inch. We work in inches at the pptxgenjs boundary (it accepts inches),
// and convert from CSS pixels using a slide-width-derived factor so that the
// HTML's logical canvas maps onto whatever slide dimensions the deck uses.
const PT_PER_PX = 0.75;     // 1 px = 0.75 pt
const PX_PER_IN = 96;       // CSS spec
const EMU_PER_IN = 914400;  // OOXML

// Fonts that ship as a single weight only. Applying bold to them produces
// faux-bold in PowerPoint, which makes the text wider and breaks layout.
const SINGLE_WEIGHT_FONTS = ['impact'];

// Defaults the caller may override via options.
const DEFAULTS = {
  width: 13.333,
  height: 7.5,
  rootSelector: 'body',
  imageFallback: false,
  tmpDir: process.env.TMPDIR || os.tmpdir(),
};

// ── PUBLIC ENTRY POINT ──────────────────────────────────────────────────

/**
 * @param {import('playwright').Page} page    Playwright page, already loaded
 * @param {object} pptxSlide                  pptxgenjs Slide instance
 * @param {object} [options]                  see DEFAULTS
 * @returns {Promise<{translated:number, skipped:number, errors:string[]}>}
 */
async function translateSlideToPptx(page, pptxSlide, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const result = { translated: 0, skipped: 0, errors: [] };

  // 1. Get the root box. Everything else is positioned relative to this box,
  // so the export ignores body padding / outer scroll context. The factor
  // converts page-pixels to slide-inches.
  const rootBox = await page.evaluate((sel) => {
    const root = document.querySelector(sel) || document.body;
    const rect = root.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }, opts.rootSelector);

  if (!rootBox.width || !rootBox.height) {
    result.errors.push(`Root "${opts.rootSelector}" has zero dimensions`);
    return result;
  }

  // 2. Pixel → inch conversion. Slide is opts.width inches wide, root is
  // rootBox.width pixels wide. So one pixel = (opts.width / rootBox.width) in.
  const pxToIn = opts.width / rootBox.width;

  // Font/pt scale must follow the same geometry factor. A fixed 0.75 pt/px is
  // only right when the root renders at 96 px per slide inch (e.g. 1280 px for
  // 13.333 in). For a 1920 px root, one rendered px is pxToIn inches = 72*pxToIn
  // pt, so we scale the browser-side pt conversion by this ratio (1.0 at 96dpi).
  const fontScale = pxToIn * PX_PER_IN;

  // 3. Walk DOM in the page context. Returns a flat list of records, each
  // already containing computed styles, normalized colors, and the position
  // relative to the root. The page-context walk also collects validation
  // errors for the 4 hard constraints.
  const walkResult = await page.evaluate(walkDomFromBrowser, {
    rootSelector: opts.rootSelector,
    rootLeft: rootBox.left,
    rootTop: rootBox.top,
    fontScale,
  });

  // 4. Translate records to pptxgenjs calls. This runs in Node, no DOM access.
  for (const rec of walkResult.records) {
    try {
      await emitRecord(rec, pptxSlide, opts, pxToIn, page, result);
      result.translated += 1;
    } catch (err) {
      result.errors.push(`Emit failed for <${rec.tag}>: ${err.message}`);
      // Image-fallback for any failed element if the caller asked for it.
      if (opts.imageFallback) {
        try {
          await emitImageFallback(rec, pptxSlide, opts, pxToIn, page);
          result.translated += 1;
        } catch (e2) {
          result.skipped += 1;
          result.errors.push(`Fallback also failed: ${e2.message}`);
        }
      } else {
        result.skipped += 1;
      }
    }
  }

  // surface validation errors collected during the DOM walk
  if (walkResult.errors.length) {
    result.errors.push(...walkResult.errors);
  }

  return result;
}

// ── WALK_DOM (runs in browser context) ──────────────────────────────────

/**
 * Browser-side DOM walk. Serialized to the page via page.evaluate, so it
 * can only reference its own scope. All helpers are defined inside.
 *
 * Returns { records, errors }. Records are flat, parent-then-children order
 * gives correct DOM-order layering, which maps to z-index on a slide.
 */
function walkDomFromBrowser({ rootSelector, rootLeft, rootTop, fontScale }) {
  // 0.75 pt per rendered px at the reference 96 px/in, scaled by the same
  // geometry factor the caller uses for positions (see translateSlideToPptx).
  const PT_PER_PX = 0.75 * (fontScale || 1);
  const SINGLE_WEIGHT_FONTS = ['impact'];

  const root = document.querySelector(rootSelector) || document.body;
  const records = [];
  const errors = [];
  const processed = new Set();
  const textTags = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI']);

  // ── COLOR_CONV ────────────────────────────────────────────────────────
  // CSS color string → 6-char hex with no leading hash. rgba alpha stripped
  // (transparency is reported separately so pptxgenjs can apply it).
  function rgbToHex(s) {
    if (!s || s === 'rgba(0, 0, 0, 0)' || s === 'transparent') return 'FFFFFF';
    const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return 'FFFFFF';
    return m.slice(1).map((n) => parseInt(n, 10).toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  // CSS rgba alpha → pptxgenjs transparency 0-100 (inverted: 0 alpha = 100 trans).
  function extractAlpha(s) {
    const m = s && s.match(/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
    if (!m) return null;
    const a = parseFloat(m[1]);
    return Math.round((1 - a) * 100);
  }

  // ── FONT_CONV ─────────────────────────────────────────────────────────
  // CSS font-family list → first-stack name. PowerPoint resolves missing
  // fonts at open time (faux-substitutes); we just hand it the first name.
  function firstFont(family) {
    if (!family) return 'Calibri';
    return family.split(',')[0].replace(/['"]/g, '').trim();
  }

  function shouldSkipBold(family) {
    if (!family) return false;
    const f = family.toLowerCase().replace(/['"]/g, '').split(',')[0].trim();
    return SINGLE_WEIGHT_FONTS.includes(f);
  }

  function pxToPt(pxStr) {
    return parseFloat(pxStr) * PT_PER_PX;
  }

  function applyTextTransform(text, tt) {
    if (tt === 'uppercase') return text.toUpperCase();
    if (tt === 'lowercase') return text.toLowerCase();
    if (tt === 'capitalize') return text.replace(/\b\w/g, (c) => c.toUpperCase());
    return text;
  }

  // CSS transform / writing-mode → rotation degrees, or null.
  function getRotation(transform, writingMode) {
    let angle = 0;
    if (writingMode === 'vertical-rl') angle = 90;
    else if (writingMode === 'vertical-lr') angle = 270;

    if (transform && transform !== 'none') {
      const r = transform.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);
      if (r) {
        angle += parseFloat(r[1]);
      } else {
        const mx = transform.match(/matrix\(([^)]+)\)/);
        if (mx) {
          const v = mx[1].split(',').map(parseFloat);
          angle += Math.round(Math.atan2(v[1], v[0]) * (180 / Math.PI));
        }
      }
    }
    angle = ((angle % 360) + 360) % 360;
    return angle === 0 ? null : angle;
  }

  // CSS box-shadow → pptxgenjs shadow object. Inset shadows skipped (PPT
  // doesn't render them cleanly and including them can corrupt the file).
  function parseBoxShadow(boxShadow) {
    if (!boxShadow || boxShadow === 'none') return null;
    if (/inset/.test(boxShadow)) return null;

    const colorMatch = boxShadow.match(/rgba?\([^)]+\)/);
    const parts = boxShadow.match(/([-\d.]+)(px|pt)/g);
    if (!parts || parts.length < 2) return null;

    const offX = parseFloat(parts[0]);
    const offY = parseFloat(parts[1]);
    const blur = parts.length > 2 ? parseFloat(parts[2]) : 0;

    let angle = 0;
    if (offX !== 0 || offY !== 0) {
      angle = Math.atan2(offY, offX) * (180 / Math.PI);
      if (angle < 0) angle += 360;
    }
    const offset = Math.sqrt(offX * offX + offY * offY) * PT_PER_PX;

    let opacity = 0.5;
    if (colorMatch) {
      const om = colorMatch[0].match(/[\d.]+\)$/);
      if (om) opacity = parseFloat(om[0].replace(')', ''));
    }
    return {
      type: 'outer',
      angle: Math.round(angle),
      blur: blur * PT_PER_PX,
      color: colorMatch ? rgbToHex(colorMatch[0]) : '000000',
      offset,
      opacity,
    };
  }

  // Position relative to root, accounting for rotation. For 90/270 rotations
  // the browser reports the rotated bounding box but PowerPoint applies
  // rotation to the original (unrotated) box, so we swap width and height.
  function getPositionAndSize(el, rect, rotation) {
    const localLeft = rect.left - rootLeft;
    const localTop = rect.top - rootTop;

    if (rotation === null) {
      return { x: localLeft, y: localTop, w: rect.width, h: rect.height };
    }
    const isVertical = rotation === 90 || rotation === 270;
    if (isVertical) {
      const cx = localLeft + rect.width / 2;
      const cy = localTop + rect.height / 2;
      return {
        x: cx - rect.height / 2,
        y: cy - rect.width / 2,
        w: rect.height,
        h: rect.width,
      };
    }
    const cx = localLeft + rect.width / 2;
    const cy = localTop + rect.height / 2;
    return {
      x: cx - el.offsetWidth / 2,
      y: cy - el.offsetHeight / 2,
      w: el.offsetWidth,
      h: el.offsetHeight,
    };
  }

  // Visibility check. display:none / visibility:hidden / opacity:0 → skip.
  function isVisible(el, computed) {
    if (computed.display === 'none') return false;
    if (computed.visibility === 'hidden') return false;
    if (parseFloat(computed.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    return true;
  }

  // Inline-formatting parser. Walks a paragraph element's child nodes,
  // emits a flat array of pptxgenjs text-runs ({ text, options }). Handles
  // <strong>/<em>/<span>/<b>/<i>/<u> with their own color, weight, italic,
  // underline, font-size. <br> emits a literal newline.
  function parseInlineFormatting(element, baseOptions, runs, baseTextTransform) {
    runs = runs || [];
    baseOptions = baseOptions || {};
    baseTextTransform = baseTextTransform || ((x) => x);
    let prevNodeIsText = false;

    element.childNodes.forEach((node) => {
      let textTransform = baseTextTransform;
      const isText = node.nodeType === Node.TEXT_NODE || node.tagName === 'BR';

      if (isText) {
        const raw = node.tagName === 'BR' ? '\n' : textTransform(node.textContent.replace(/\s+/g, ' '));
        const prev = runs[runs.length - 1];
        if (prevNodeIsText && prev) {
          prev.text += raw;
        } else {
          runs.push({ text: raw, options: { ...baseOptions } });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE && node.textContent.trim()) {
        const opts = { ...baseOptions };
        const c = window.getComputedStyle(node);
        const tag = node.tagName;
        if (tag === 'SPAN' || tag === 'B' || tag === 'STRONG' || tag === 'I' || tag === 'EM' || tag === 'U') {
          const isBold = c.fontWeight === 'bold' || parseInt(c.fontWeight, 10) >= 600;
          if (isBold && !shouldSkipBold(c.fontFamily)) opts.bold = true;
          if (c.fontStyle === 'italic') opts.italic = true;
          if (c.textDecoration && c.textDecoration.includes('underline')) opts.underline = true;
          if (c.color && c.color !== 'rgb(0, 0, 0)') {
            opts.color = rgbToHex(c.color);
            const t = extractAlpha(c.color);
            if (t !== null) opts.transparency = t;
          }
          if (c.fontSize) opts.fontSize = pxToPt(c.fontSize);
          if (c.textTransform && c.textTransform !== 'none') {
            const tt = c.textTransform;
            textTransform = (s) => applyTextTransform(s, tt);
          }
          if (parseFloat(c.marginLeft) > 0 || parseFloat(c.marginRight) > 0 ||
              parseFloat(c.marginTop) > 0 || parseFloat(c.marginBottom) > 0) {
            errors.push(`Inline element <${tag.toLowerCase()}> has margin which PPT cannot represent. Remove it.`);
          }
          parseInlineFormatting(node, opts, runs, textTransform);
        }
      }
      prevNodeIsText = isText;
    });

    if (runs.length > 0) {
      runs[0].text = runs[0].text.replace(/^\s+/, '');
      runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, '');
    }
    return runs.filter((r) => r.text.length > 0);
  }

  // ── WALK ─────────────────────────────────────────────────────────────
  // Iterate root and all descendants in document order. Document order =
  // DOM order = correct draw order for z-index (later painted on top).

  const all = [root, ...root.querySelectorAll('*')];

  for (const el of all) {
    if (processed.has(el)) continue;
    const tag = el.tagName;
    const computed = window.getComputedStyle(el);

    if (!isVisible(el, computed)) {
      processed.add(el);
      continue;
    }

    // Validate constraint #3: text tags can't carry chrome.
    if (textTags.has(tag)) {
      const hasBg = computed.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)';
      const bw = ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']
        .some((k) => parseFloat(computed[k]) > 0);
      const hasShadow = computed.boxShadow && computed.boxShadow !== 'none';
      if (hasBg || bw || hasShadow) {
        errors.push(
          `Text element <${tag.toLowerCase()}> has ${hasBg ? 'background' : bw ? 'border' : 'shadow'}. ` +
          'Move chrome to the wrapping <div>.'
        );
        processed.add(el);
        continue;
      }
    }

    const rect = el.getBoundingClientRect();

    // ── IMG ───────────────────────────────────────────────────────────
    if (tag === 'IMG') {
      records.push({
        kind: 'image',
        tag: 'img',
        src: el.src,
        position: {
          x: rect.left - rootLeft,
          y: rect.top - rootTop,
          w: rect.width,
          h: rect.height,
        },
      });
      processed.add(el);
      continue;
    }

    // ── SVG ───────────────────────────────────────────────────────────
    // Inline SVG: serialize and let the Node side rasterize via sharp.
    if (tag === 'SVG' || tag === 'svg') {
      const svgString = new XMLSerializer().serializeToString(el);
      records.push({
        kind: 'svg',
        tag: 'svg',
        svg: svgString,
        position: {
          x: rect.left - rootLeft,
          y: rect.top - rootTop,
          w: rect.width,
          h: rect.height,
        },
      });
      // skip descendants, SVG is one record
      el.querySelectorAll('*').forEach((d) => processed.add(d));
      processed.add(el);
      continue;
    }

    // ── DIV with chrome → shape ───────────────────────────────────────
    // <div> with background or border becomes an addShape rectangle. Text
    // children are still walked separately and painted on top.
    if (tag === 'DIV') {
      // constraint #1: no bare text in a div
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const t = node.textContent.trim();
          if (t) {
            errors.push(
              `DIV contains unwrapped text "${t.slice(0, 50)}${t.length > 50 ? '...' : ''}". ` +
              'Wrap in <p> or <h*>.'
            );
          }
        }
      }
      // constraint #4: no css gradients / background-image
      const bgImage = computed.backgroundImage;
      if (bgImage && bgImage !== 'none') {
        if (/linear-gradient|radial-gradient|conic-gradient/.test(bgImage)) {
          errors.push('CSS gradients are not supported. Rasterize to PNG first or use solid fill.');
        } else {
          errors.push('background-image on <div> is not supported. Use <img>.');
        }
        processed.add(el);
        continue;
      }

      const hasBg = computed.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)';
      const borderWidths = [
        parseFloat(computed.borderTopWidth) || 0,
        parseFloat(computed.borderRightWidth) || 0,
        parseFloat(computed.borderBottomWidth) || 0,
        parseFloat(computed.borderLeftWidth) || 0,
      ];
      const hasBorder = borderWidths.some((w) => w > 0);
      const uniformBorder = hasBorder && borderWidths.every((w) => w === borderWidths[0]);

      if (hasBg || hasBorder) {
        if (rect.width <= 0 || rect.height <= 0) {
          // nothing to paint
        } else {
          const radius = computed.borderRadius;
          const radiusValue = parseFloat(radius);
          let rectRadius = 0;
          if (radiusValue > 0) {
            if (radius.includes('%')) {
              if (radiusValue >= 50) rectRadius = 1;
              else rectRadius = (radiusValue / 100) * Math.min(rect.width, rect.height) / 96; // tentative inches
            } else if (radius.includes('pt')) {
              rectRadius = radiusValue / 72;
            } else {
              rectRadius = radiusValue / 96;
            }
          }

          records.push({
            kind: 'shape',
            tag: 'div',
            position: {
              x: rect.left - rootLeft,
              y: rect.top - rootTop,
              w: rect.width,
              h: rect.height,
            },
            shape: {
              fill: hasBg ? rgbToHex(computed.backgroundColor) : null,
              transparency: hasBg ? extractAlpha(computed.backgroundColor) : null,
              line: uniformBorder ? {
                color: rgbToHex(computed.borderColor || computed.borderTopColor),
                width: borderWidths[0] * PT_PER_PX,
              } : null,
              rectRadiusInches: rectRadius,
              shadow: parseBoxShadow(computed.boxShadow),
            },
          });

          // partial borders → emit as line shapes after the rect
          if (hasBorder && !uniformBorder) {
            const x = rect.left - rootLeft;
            const y = rect.top - rootTop;
            const w = rect.width;
            const h = rect.height;
            if (borderWidths[0] > 0) {
              records.push({
                kind: 'line', tag: 'line',
                x1: x, y1: y, x2: x + w, y2: y,
                color: rgbToHex(computed.borderTopColor),
                width: borderWidths[0] * PT_PER_PX,
              });
            }
            if (borderWidths[1] > 0) {
              records.push({
                kind: 'line', tag: 'line',
                x1: x + w, y1: y, x2: x + w, y2: y + h,
                color: rgbToHex(computed.borderRightColor),
                width: borderWidths[1] * PT_PER_PX,
              });
            }
            if (borderWidths[2] > 0) {
              records.push({
                kind: 'line', tag: 'line',
                x1: x, y1: y + h, x2: x + w, y2: y + h,
                color: rgbToHex(computed.borderBottomColor),
                width: borderWidths[2] * PT_PER_PX,
              });
            }
            if (borderWidths[3] > 0) {
              records.push({
                kind: 'line', tag: 'line',
                x1: x, y1: y, x2: x, y2: y + h,
                color: rgbToHex(computed.borderLeftColor),
                width: borderWidths[3] * PT_PER_PX,
              });
            }
          }
        }
      }
      // do NOT mark processed, children still walk for text rendering
      continue;
    }

    // ── UL / OL ───────────────────────────────────────────────────────
    if (tag === 'UL' || tag === 'OL') {
      if (rect.width === 0 || rect.height === 0) { processed.add(el); continue; }
      const lis = Array.from(el.querySelectorAll(':scope > li'));
      if (lis.length === 0) { processed.add(el); continue; }

      const ulComputed = window.getComputedStyle(el);
      const ulPaddingLeftPt = pxToPt(ulComputed.paddingLeft);
      const marginLeftPt = ulPaddingLeftPt * 0.5;
      const textIndentPt = ulPaddingLeftPt * 0.5;

      const items = [];
      lis.forEach((li, idx) => {
        const isLast = idx === lis.length - 1;
        const runs = parseInlineFormatting(li, { breakLine: false }, [], (x) => x);
        if (runs.length > 0) {
          runs[0].text = runs[0].text.replace(/^[•\-\*▪▸]\s*/, '');
          runs[0].options.bullet = { indent: textIndentPt };
        }
        if (runs.length > 0 && !isLast) {
          runs[runs.length - 1].options.breakLine = true;
        }
        items.push(...runs);
      });

      const liComp = window.getComputedStyle(lis[0] || el);
      const rotation = getRotation(liComp.transform, liComp.writingMode);

      records.push({
        kind: 'list',
        tag: tag.toLowerCase(),
        items,
        position: {
          x: rect.left - rootLeft,
          y: rect.top - rootTop,
          w: rect.width,
          h: rect.height,
        },
        style: {
          fontSize: pxToPt(liComp.fontSize),
          fontFace: firstFont(liComp.fontFamily),
          color: rgbToHex(liComp.color),
          transparency: extractAlpha(liComp.color),
          align: liComp.textAlign === 'start' ? 'left' : liComp.textAlign,
          lineSpacing: liComp.lineHeight && liComp.lineHeight !== 'normal' ? pxToPt(liComp.lineHeight) : null,
          paraSpaceBefore: 0,
          paraSpaceAfter: pxToPt(liComp.marginBottom),
          margin: [marginLeftPt, 0, 0, 0],
          rotate: rotation,
        },
      });

      lis.forEach((li) => processed.add(li));
      processed.add(el);
      continue;
    }

    // ── P / H1-H6 (LI handled inside UL/OL above) ─────────────────────
    if (textTags.has(tag) && tag !== 'LI' && tag !== 'UL' && tag !== 'OL') {
      const text = el.textContent.trim();
      if (rect.width === 0 || rect.height === 0 || !text) {
        processed.add(el);
        continue;
      }

      // catch manual bullet symbols outside lists (constraint hint)
      if (/^[•\-\*▪▸○●◆◇■□]\s/.test(text.trimStart())) {
        errors.push(
          `<${tag.toLowerCase()}> starts with bullet symbol. Use <ul>/<ol> instead of manual bullets.`
        );
        processed.add(el);
        continue;
      }

      const rotation = getRotation(computed.transform, computed.writingMode);
      const pos = getPositionAndSize(el, { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, rotation);

      const baseStyle = {
        fontSize: pxToPt(computed.fontSize),
        fontFace: firstFont(computed.fontFamily),
        color: rgbToHex(computed.color),
        align: computed.textAlign === 'start' ? 'left' : computed.textAlign,
        lineSpacing: pxToPt(computed.lineHeight),
        paraSpaceBefore: pxToPt(computed.marginTop),
        paraSpaceAfter: pxToPt(computed.marginBottom),
        margin: [
          pxToPt(computed.paddingLeft),
          pxToPt(computed.paddingRight),
          pxToPt(computed.paddingBottom),
          pxToPt(computed.paddingTop),
        ],
        charSpacing: computed.letterSpacing && computed.letterSpacing !== 'normal'
          ? pxToPt(computed.letterSpacing) : null,
      };
      const transparency = extractAlpha(computed.color);
      if (transparency !== null) baseStyle.transparency = transparency;
      if (rotation !== null) baseStyle.rotate = rotation;

      const hasFormatting = el.querySelector('b, i, u, strong, em, span, br');

      if (hasFormatting) {
        const tt = computed.textTransform;
        const runs = parseInlineFormatting(el, {}, [], (s) => applyTextTransform(s, tt));
        const adj = { ...baseStyle };
        if (adj.lineSpacing) {
          const maxFs = Math.max(adj.fontSize, ...runs.map((r) => r.options?.fontSize || 0));
          if (maxFs > adj.fontSize) {
            const mult = adj.lineSpacing / adj.fontSize;
            adj.lineSpacing = maxFs * mult;
          }
        }
        records.push({
          kind: 'text',
          tag: tag.toLowerCase(),
          text: runs,
          position: pos,
          style: adj,
        });
      } else {
        const transformed = applyTextTransform(text, computed.textTransform);
        const isBold = computed.fontWeight === 'bold' || parseInt(computed.fontWeight, 10) >= 600;
        records.push({
          kind: 'text',
          tag: tag.toLowerCase(),
          text: transformed,
          position: pos,
          style: {
            ...baseStyle,
            bold: isBold && !shouldSkipBold(computed.fontFamily),
            italic: computed.fontStyle === 'italic',
            underline: computed.textDecoration && computed.textDecoration.includes('underline'),
          },
        });
      }
      processed.add(el);
      continue;
    }
  }

  return { records, errors };
}

// ── EMIT (Node side) ────────────────────────────────────────────────────

async function emitRecord(rec, slide, opts, pxToIn, page, result) {
  const inches = (px) => px * pxToIn;

  if (rec.kind === 'image') {
    return emitImage(rec, slide, inches);
  }
  if (rec.kind === 'svg') {
    return emitSvg(rec, slide, inches, opts);
  }
  if (rec.kind === 'shape') {
    return emitShape(rec, slide, inches, opts);
  }
  if (rec.kind === 'line') {
    return emitLine(rec, slide, inches, opts);
  }
  if (rec.kind === 'text') {
    return emitText(rec, slide, inches);
  }
  if (rec.kind === 'list') {
    return emitList(rec, slide, inches);
  }
  throw new Error(`Unknown record kind: ${rec.kind}`);
}

// ── EMIT_TEXT ───────────────────────────────────────────────────────────

function emitText(rec, slide, inches) {
  const p = rec.position;
  const s = rec.style;

  // Single-line guess. If the box is barely taller than one line, PowerPoint's
  // metric calculation underestimates width by ~2% so we widen the box from
  // the appropriate side. Same trick the reference uses, ports cleanly.
  const lineHeight = s.lineSpacing || s.fontSize * 1.2;
  const isSingleLine = p.h <= lineHeight * 1.5;
  let x = inches(p.x);
  let w = inches(p.w);
  if (isSingleLine) {
    const bump = w * 0.02;
    if (s.align === 'center') { x -= bump / 2; w += bump; }
    else if (s.align === 'right') { x -= bump; w += bump; }
    else { w += bump; }
  }

  const text = rec.text;
  const optsObj = {
    x,
    y: inches(p.y),
    w,
    h: inches(p.h),
    fontSize: s.fontSize,
    fontFace: s.fontFace,
    color: s.color,
    bold: s.bold,
    italic: s.italic,
    underline: s.underline,
    valign: 'top',
    lineSpacing: s.lineSpacing,
    paraSpaceBefore: s.paraSpaceBefore,
    paraSpaceAfter: s.paraSpaceAfter,
    inset: 0,
  };
  if (s.charSpacing) optsObj.charSpacing = s.charSpacing;
  if (s.align) optsObj.align = s.align;
  if (s.margin) optsObj.margin = s.margin;
  if (s.rotate != null) optsObj.rotate = s.rotate;
  if (s.transparency != null) optsObj.transparency = s.transparency;

  slide.addText(text, optsObj);
}

function emitList(rec, slide, inches) {
  const p = rec.position;
  const s = rec.style;
  const optsObj = {
    x: inches(p.x),
    y: inches(p.y),
    w: inches(p.w),
    h: inches(p.h),
    fontSize: s.fontSize,
    fontFace: s.fontFace,
    color: s.color,
    align: s.align,
    valign: 'top',
    lineSpacing: s.lineSpacing,
    paraSpaceBefore: s.paraSpaceBefore,
    paraSpaceAfter: s.paraSpaceAfter,
    margin: s.margin,
    inset: 0,
  };
  if (s.rotate != null) optsObj.rotate = s.rotate;
  if (s.transparency != null) optsObj.transparency = s.transparency;
  slide.addText(rec.items, optsObj);
}

// ── EMIT_SHAPE ──────────────────────────────────────────────────────────

function emitShape(rec, slide, inches, opts) {
  const p = rec.position;
  const sh = rec.shape;
  const pres = opts.pres;

  // pptxgenjs accepts string shape types ('rect', 'roundRect') or
  // pres.ShapeType.* enum values. Prefer the enum if pres was provided.
  const isRound = sh.rectRadiusInches > 0;
  const shapeType = pres && pres.ShapeType
    ? (isRound ? pres.ShapeType.roundRect : pres.ShapeType.rect)
    : (isRound ? 'roundRect' : 'rect');

  const shapeOptions = {
    x: inches(p.x),
    y: inches(p.y),
    w: inches(p.w),
    h: inches(p.h),
    shape: shapeType,
  };
  if (sh.fill) {
    shapeOptions.fill = { color: sh.fill };
    if (sh.transparency != null) shapeOptions.fill.transparency = sh.transparency;
  }
  if (sh.line) shapeOptions.line = sh.line;
  if (sh.rectRadiusInches > 0) shapeOptions.rectRadius = sh.rectRadiusInches;
  if (sh.shadow) shapeOptions.shadow = sh.shadow;

  // pptxgenjs idiom: addText('', shapeOptions) emits a shape that is also a
  // text frame (which lets the user add text in PPT later). Same as ref.
  slide.addText('', shapeOptions);
}

function emitLine(rec, slide, inches, opts) {
  const pres = opts.pres;
  const lineShape = pres && pres.ShapeType ? pres.ShapeType.line : 'line';
  slide.addShape(lineShape, {
    x: inches(rec.x1),
    y: inches(rec.y1),
    w: inches(rec.x2 - rec.x1),
    h: inches(rec.y2 - rec.y1),
    line: { color: rec.color, width: rec.width },
  });
}

// ── EMIT_IMAGE ──────────────────────────────────────────────────────────

function emitImage(rec, slide, inches) {
  const p = rec.position;
  let src = rec.src;

  // file:// URLs: convert to a path pptxgenjs can read off disk
  if (typeof src === 'string' && src.startsWith('file://')) {
    src = decodeURIComponent(src.replace(/^file:\/\/\/?/, process.platform === 'win32' ? '' : '/'));
  }

  const opts = {
    x: inches(p.x),
    y: inches(p.y),
    w: inches(p.w),
    h: inches(p.h),
  };
  if (typeof src === 'string' && src.startsWith('data:')) {
    opts.data = src;
  } else {
    opts.path = src;
  }
  slide.addImage(opts);
}

// SVG path: serialize → write a temp PNG via sharp → addImage. PPT supports
// SVG natively in modern versions but raster is the reliable cross-version
// path, especially through pptxgenjs.
async function emitSvg(rec, slide, inches, opts) {
  const sharp = require('sharp');
  const p = rec.position;
  const tmpDir = opts.tmpDir;

  fs.mkdirSync(tmpDir, { recursive: true });
  const hash = crypto.createHash('md5').update(rec.svg).digest('hex').slice(0, 12);
  const outPath = path.join(tmpDir, `sigillerie-svg-${hash}.png`);

  if (!fs.existsSync(outPath)) {
    // density boost for crisp rasterization at slide-projection size
    await sharp(Buffer.from(rec.svg), { density: 192 })
      .resize({
        width: Math.max(2, Math.round(p.w * 2)),
        height: Math.max(2, Math.round(p.h * 2)),
        fit: 'fill',
      })
      .png()
      .toFile(outPath);
  }

  slide.addImage({
    path: outPath,
    x: inches(p.x),
    y: inches(p.y),
    w: inches(p.w),
    h: inches(p.h),
  });
}

// ── FALLBACK ────────────────────────────────────────────────────────────

// Last-resort: rasterize the offending element as a screenshot and embed it
// as an addImage. Used only when imageFallback: true and the normal emit
// path threw. The screenshot uses the live page so transforms, shadows, and
// gradients all render exactly as the browser drew them.
async function emitImageFallback(rec, slide, opts, pxToIn, page) {
  const p = rec.position;
  const tmpDir = opts.tmpDir;
  fs.mkdirSync(tmpDir, { recursive: true });

  // Re-locate the element by index. The walker doesn't carry a selector, so
  // we use a clip-rect screenshot of the page at the recorded box. Slight
  // imprecision is fine, the alternative is dropping the element entirely.
  const id = crypto.randomBytes(6).toString('hex');
  const outPath = path.join(tmpDir, `sigillerie-fallback-${id}.png`);

  // need the absolute page coordinates, which means root offset. The walk
  // recorded p relative to root; we recover absolute by adding root rect.
  const rootBox = await page.evaluate((sel) => {
    const r = document.querySelector(sel) || document.body;
    const rc = r.getBoundingClientRect();
    return { left: rc.left, top: rc.top };
  }, opts.rootSelector);

  await page.screenshot({
    path: outPath,
    clip: {
      x: Math.max(0, rootBox.left + p.x),
      y: Math.max(0, rootBox.top + p.y),
      width: Math.max(1, p.w),
      height: Math.max(1, p.h),
    },
    omitBackground: true,
  });

  slide.addImage({
    path: outPath,
    x: p.x * pxToIn,
    y: p.y * pxToIn,
    w: p.w * pxToIn,
    h: p.h * pxToIn,
  });
}

// ── EXPORTS ─────────────────────────────────────────────────────────────

module.exports = translateSlideToPptx;
module.exports.translateSlideToPptx = translateSlideToPptx;
module.exports.default = translateSlideToPptx;
