/**
 * DesignCanvas, variations grid for Producer-mode Variations Pass.
 *
 * Renders N design alternatives side-by-side for visual comparison.
 * Each variation: letter badge [A][B][C], title (serif), description, render zone.
 *
 * Usage:
 *   <DesignCanvas
 *     variations={[
 *       { label: 'Editorial', description: 'Magazine-style restraint', render: <HeroA/> },
 *       { label: 'Brutalist', description: 'Raw, dense, no-mercy',   render: ({ index, total }) => <HeroB i={index}/> },
 *       { label: 'Quiet',     description: 'Whitespace as voice',     render: <HeroC/> },
 *     ]}
 *     theme="light"
 *   />
 *
 * Pairs with assets/animations.jsx, a variation's render can be a Stage instance
 * for animated variants. See modes/producer/workflow.md (Variations Pass).
 *
 * Cross-script-tag access via window.DesignCanvas (per modes/producer/react-setup.md).
 */

// theme palette, off-white / warm-dark, editorial feel
const THEMES = {
  light: {
    bg: '#FAFAF7',
    fg: '#1A1A1A',
    muted: '#6B6B6B',
    cardBg: '#FFFFFF',
    border: 'rgba(0,0,0,0.08)',
    badgeBg: 'rgba(0,0,0,0.78)',
    badgeFg: '#FFFFFF',
  },
  dark: {
    bg: '#1F1A14',
    fg: '#F2EFE8',
    muted: '#9C958A',
    cardBg: '#2A241D',
    border: 'rgba(255,255,255,0.08)',
    badgeBg: 'rgba(255,255,255,0.92)',
    badgeFg: '#1A1A1A',
  },
};

// font stacks, serif for titles, sans for body
const SERIF = '"Source Serif", "Source Serif Pro", Georgia, "Times New Roman", serif';
const SANS = '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif';

// styles factory, depend on theme
function buildStyles(t, columns, gap, padding) {
  return {
    canvas: {
      minHeight: '100%',
      background: t.bg,
      color: t.fg,
      padding,
      fontFamily: SANS,
      boxSizing: 'border-box',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap,
      width: '100%',
    },
    card: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      minWidth: 0, // allow truncation in grid cells
      breakInside: 'avoid', // print: keep card together
      pageBreakInside: 'avoid',
    },
    head: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      paddingLeft: 2,
    },
    badgeRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 4,
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 22,
      height: 22,
      padding: '0 6px',
      background: t.badgeBg,
      color: t.badgeFg,
      borderRadius: 3,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.04em',
      lineHeight: 1,
    },
    title: {
      fontFamily: SERIF,
      fontSize: 22,
      fontWeight: 500,
      letterSpacing: '-0.015em',
      lineHeight: 1.2,
      color: t.fg,
      margin: 0,
    },
    description: {
      fontFamily: SANS,
      fontSize: 13.5,
      lineHeight: 1.45,
      color: t.muted,
      margin: 0,
    },
    renderZone: {
      position: 'relative',
      width: '100%',
      background: t.cardBg,
      border: `1px solid ${t.border}`,
      borderRadius: 4,
      overflow: 'auto', // scroll inside if content overflows
      WebkitOverflowScrolling: 'touch',
    },
    renderInner: {
      width: '100%',
      height: '100%',
      position: 'relative',
    },
  };
}

// letter for index, A, B, ..., Z, AA, AB, ...
function letterFor(i) {
  let n = i;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

// render slot: element OR function({ index, total }), call only if function
function renderSlot(slot, index, total) {
  if (typeof slot === 'function') return slot({ index, total });
  return slot;
}

function DesignCanvas(props) {
  const variations = Array.isArray(props.variations) ? props.variations : [];
  const total = variations.length;
  const theme = props.theme === 'dark' ? 'dark' : 'light';
  const t = THEMES[theme];

  const columns = props.columns || Math.min(Math.max(total, 1), 3);
  const gap = props.gap || '32px';
  const padding = props.padding || '48px';
  const aspectRatio = props.aspectRatio || '16/10';

  const styles = buildStyles(t, columns, gap, padding);

  // unique id so responsive + print CSS scopes cleanly
  const uid = React.useMemo(
    () => 'dc-' + Math.random().toString(36).slice(2, 9),
    []
  );

  // responsive + print rules, injected as raw CSS, scoped by uid
  const css = `
    @media (max-width: 720px) {
      #${uid} > .dc-grid { grid-template-columns: 1fr !important; }
    }
    @media print {
      #${uid} { padding: 24px !important; background: #fff !important; }
      ${total > 2 ? `#${uid} > .dc-grid { grid-template-columns: repeat(2, 1fr) !important; }` : ''}
      #${uid} .dc-card { break-inside: avoid; page-break-inside: avoid; }
    }
  `;

  return (
    <div id={uid} style={styles.canvas}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="dc-grid" style={styles.grid}>
        {variations.map((v, i) => (
          <div key={i} className="dc-card" style={styles.card}>
            <div style={styles.head}>
              <div style={styles.badgeRow}>
                <span style={styles.badge}>{letterFor(i)}</span>
              </div>
              {v.label && <h3 style={styles.title}>{v.label}</h3>}
              {v.description && <p style={styles.description}>{v.description}</p>}
            </div>
            <div style={{ ...styles.renderZone, aspectRatio }}>
              <div style={styles.renderInner}>
                {renderSlot(v.render, i, total)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// expose for cross-script-tag access (Producer mode convention)
if (typeof window !== 'undefined') {
  Object.assign(window, { DesignCanvas });
}
