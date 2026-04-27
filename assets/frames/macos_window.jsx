/**
 * MacOSWindow, macOS Sequoia / 14+ window chrome.
 * Traffic lights, title bar, optional toolbar, content area.
 *
 * Usage:
 *   <MacOSWindow title="Finder" theme="light" toolbar={<Tabs/>}>
 *     <AppContent />
 *   </MacOSWindow>
 */

const macOSWindowStyles = {
  // outer shell, rounded all sides for floating window look
  window: {
    display: 'inline-block',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 25px 80px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(0,0,0,0.18)',
    fontFamily: '-apple-system, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
  },
  windowDark: {
    boxShadow: '0 25px 80px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.08)',
  },

  // title bar, 28px tall, subtle gradient
  titleBar: {
    height: 28,
    background: 'linear-gradient(to bottom, #F4F4F4, #EAEAEA)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    borderBottom: '0.5px solid rgba(0,0,0,0.12)',
    position: 'relative',
    userSelect: 'none',
  },
  titleBarDark: {
    background: 'linear-gradient(to bottom, #2C2C2E, #1F1F1F)',
    borderBottom: '0.5px solid rgba(255,255,255,0.08)',
  },

  // traffic light cluster, top-left, 8px gaps
  trafficLights: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    zIndex: 2,
  },

  // single light, 12px circle, hover reveals symbol
  light: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    border: '0.5px solid rgba(0,0,0,0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 9,
    fontWeight: 700,
    lineHeight: 1,
    color: 'transparent',
    fontFamily: '-apple-system, sans-serif',
    transition: 'color 80ms ease',
    cursor: 'default',
  },
  close: { background: '#FF5F56' },
  minimize: { background: '#FFBD2E' },
  maximize: { background: '#27CA3F' },

  // muted lights for inactive / unfocused window
  lightInactive: {
    background: '#C8C8C8',
    border: '0.5px solid rgba(0,0,0,0.12)',
  },
  lightInactiveDark: {
    background: '#5A5A5C',
    border: '0.5px solid rgba(255,255,255,0.06)',
  },

  // centered title text
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 13,
    color: '#3A3A3A',
    fontWeight: 500,
    letterSpacing: 0.1,
    pointerEvents: 'none',
    fontFamily: 'inherit',
  },
  titleDark: { color: '#D8D8D8' },
  titleInactive: { color: '#A0A0A0' },
  titleInactiveDark: { color: '#6A6A6C' },

  // optional toolbar row under title bar
  toolbar: {
    minHeight: 38,
    background: '#F6F6F6',
    borderBottom: '0.5px solid rgba(0,0,0,0.08)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
  },
  toolbarDark: {
    background: '#252527',
    borderBottom: '0.5px solid rgba(255,255,255,0.06)',
  },

  // content surface
  content: {
    position: 'relative',
    overflow: 'auto',
    background: '#FFFFFF',
  },
  contentDark: { background: '#1C1C1E' },
};

// inject hover CSS once, symbols only show on :hover of the cluster
function ensureMacOSWindowHoverCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('macos-window-hover-css')) return;
  const style = document.createElement('style');
  style.id = 'macos-window-hover-css';
  style.textContent = `
    .macos-tl-cluster:hover .macos-tl-symbol { color: rgba(0,0,0,0.55) !important; }
    .macos-tl-cluster.is-inactive:hover .macos-tl-symbol { color: transparent !important; }
  `;
  document.head.appendChild(style);
}

function MacOSWindow({
  title = 'Untitled',
  theme = 'light',
  toolbar = null,
  width = 900,
  height = 600,
  inactive = false,
  children,
}) {
  ensureMacOSWindowHoverCSS();
  const dark = theme === 'dark';
  const S = macOSWindowStyles;

  // pixel-ratio awareness, sharper hairlines on retina
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const hairline = dpr >= 2 ? 0.5 : 1;

  const lightBase = { ...S.light, borderWidth: hairline };
  const inactiveStyle = inactive
    ? (dark ? S.lightInactiveDark : S.lightInactive)
    : null;

  const titleStyle = {
    ...S.title,
    ...(dark ? S.titleDark : {}),
    ...(inactive ? (dark ? S.titleInactiveDark : S.titleInactive) : {}),
  };

  return (
    <div style={{ ...S.window, ...(dark ? S.windowDark : {}), width }}>
      {/* title bar */}
      <div style={{ ...S.titleBar, ...(dark ? S.titleBarDark : {}) }}>
        <div
          className={`macos-tl-cluster${inactive ? ' is-inactive' : ''}`}
          style={S.trafficLights}
        >
          <div
            style={inactive ? { ...lightBase, ...inactiveStyle } : { ...lightBase, ...S.close }}
            title="Close"
          >
            <span className="macos-tl-symbol">×</span>
          </div>
          <div
            style={inactive ? { ...lightBase, ...inactiveStyle } : { ...lightBase, ...S.minimize }}
            title="Minimize"
          >
            <span className="macos-tl-symbol">−</span>
          </div>
          <div
            style={inactive ? { ...lightBase, ...inactiveStyle } : { ...lightBase, ...S.maximize }}
            title="Zoom"
          >
            <span className="macos-tl-symbol">+</span>
          </div>
        </div>
        {title && <div style={titleStyle}>{title}</div>}
      </div>

      {/* optional toolbar */}
      {toolbar && (
        <div style={{ ...S.toolbar, ...(dark ? S.toolbarDark : {}) }}>{toolbar}</div>
      )}

      {/* content */}
      <div
        style={{
          ...S.content,
          ...(dark ? S.contentDark : {}),
          width,
          height,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// expose for sigillerie deliverables
if (typeof window !== 'undefined') {
  Object.assign(window, { MacOSWindow });
}
