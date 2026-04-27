/**
 * BrowserWindow, generic browser chrome wrapper
 *
 * Tab bar + URL bar + optional bookmark row + content area.
 * No traffic lights here, wrap with MacOSWindow if you want those.
 *
 * Usage:
 *   <BrowserWindow url="https://example.com" title="Example" browser="chrome">
 *     <YourPage />
 *   </BrowserWindow>
 */

// theme palette, light/dark surfaces
const themes = {
  light: {
    chrome: '#dee1e6',
    chromeAlt: '#f1f3f4',
    surface: '#ffffff',
    text: '#202124',
    textMuted: '#5f6368',
    border: '#e5e7eb',
    urlBg: '#f1f3f4',
    tabBg: '#ffffff',
    tabInactive: '#cfd2d7',
  },
  dark: {
    chrome: '#202124',
    chromeAlt: '#292a2d',
    surface: '#1f1f1f',
    text: '#e8eaed',
    textMuted: '#9aa0a6',
    border: '#3c4043',
    urlBg: '#3c4043',
    tabBg: '#35363a',
    tabInactive: '#28292c',
  },
};

// per-browser tweaks, radius, font, tab shape
const browserSpecs = {
  safari: {
    radius: 12,
    tabRadius: 8,
    font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    blur: true,
    chromeAlpha: 0.78,
  },
  chrome: {
    radius: 10,
    tabRadius: 10,
    font: '"Google Sans Text", Roboto, system-ui, sans-serif',
    blur: false,
    chromeAlpha: 1,
  },
  arc: {
    radius: 16,
    tabRadius: 10,
    font: '"Inter", system-ui, sans-serif',
    blur: true,
    chromeAlpha: 0.85,
  },
  firefox: {
    radius: 8,
    tabRadius: 6,
    font: '"Inter", system-ui, sans-serif',
    blur: false,
    chromeAlpha: 1,
  },
  generic: {
    radius: 10,
    tabRadius: 8,
    font: 'system-ui, sans-serif',
    blur: false,
    chromeAlpha: 1,
  },
};

// inline lock icon, secure or warning variant
function LockIcon({ secure, color }) {
  if (secure) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
        <path
          d="M3.5 6V4.5a3.5 3.5 0 117 0V6M2.5 6h9a1 1 0 011 1v5a1 1 0 01-1 1h-9a1 1 0 01-1-1V7a1 1 0 011-1z"
          stroke={color}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M7 5v3M7 10.5h.01M1.5 11.5L7 2l5.5 9.5h-11z"
        stroke="#d93025"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// favicon, accept URL string, node, or fallback square
function Favicon({ favicon, color }) {
  if (!favicon) {
    return (
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          background: color,
          flexShrink: 0,
        }}
      />
    );
  }
  if (typeof favicon === 'string') {
    return (
      <img
        src={favicon}
        alt=""
        style={{ width: 14, height: 14, borderRadius: 2, flexShrink: 0 }}
      />
    );
  }
  return favicon;
}

const browserStyles = {
  window: (radius, theme) => ({
    display: 'inline-block',
    background: theme.surface,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomLeftRadius: radius,
    borderBottomRightRadius: radius,
    overflow: 'hidden',
    boxShadow: '0 30px 80px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.15)',
    fontFamily: 'inherit',
  }),
  chrome: (theme, spec) => ({
    background:
      spec.chromeAlpha < 1
        ? `rgba(${theme.chrome === '#202124' ? '32,33,36' : '222,225,230'}, ${spec.chromeAlpha})`
        : theme.chrome,
    backdropFilter: spec.blur ? 'blur(20px) saturate(180%)' : 'none',
    WebkitBackdropFilter: spec.blur ? 'blur(20px) saturate(180%)' : 'none',
    paddingTop: 8,
    paddingLeft: 10,
    paddingRight: 10,
    userSelect: 'none',
    fontFamily: spec.font,
  }),
  tabRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 4,
    height: 36,
  },
  tab: (theme, spec) => ({
    background: theme.tabBg,
    color: theme.text,
    padding: '8px 12px',
    borderTopLeftRadius: spec.tabRadius,
    borderTopRightRadius: spec.tabRadius,
    fontSize: 12,
    maxWidth: 240,
    minWidth: 120,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    height: 28,
    boxSizing: 'border-box',
  }),
  tabTitle: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
  },
  tabClose: (color) => ({
    width: 16,
    height: 16,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color,
    fontSize: 14,
    lineHeight: 1,
    cursor: 'pointer',
    opacity: 0.6,
  }),
  navBar: (theme) => ({
    background: theme.chromeAlt,
    height: 44,
    padding: '0 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderBottom: `1px solid ${theme.border}`,
    boxSizing: 'border-box',
  }),
  navButtons: (color) => ({
    display: 'flex',
    gap: 2,
    color,
  }),
  navButton: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: 15,
  },
  urlBar: (theme, spec) => ({
    flex: 1,
    background: theme.urlBg,
    borderRadius: 8,
    height: 32,
    padding: '0 12px',
    fontSize: 13,
    color: theme.text,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: spec.font,
    boxSizing: 'border-box',
  }),
  urlText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  refreshBtn: (color) => ({
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color,
    cursor: 'pointer',
    fontSize: 13,
  }),
  bookmarkRow: (theme) => ({
    background: theme.chromeAlt,
    height: 32,
    padding: '0 8px',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    borderBottom: `1px solid ${theme.border}`,
    overflow: 'hidden',
    boxSizing: 'border-box',
  }),
  bookmark: (theme) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 12,
    color: theme.text,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }),
  content: (theme) => ({
    position: 'relative',
    overflow: 'auto',
    background: theme.surface,
    color: theme.text,
  }),
};

function BrowserWindow({
  url = 'https://example.com',
  title = 'Example',
  favicon,
  theme: themeName = 'light',
  browser = 'safari',
  showBookmarks = false,
  bookmarks = [],
  secure = true,
  width = 1200,
  height = 800,
  children,
}) {
  const theme = themes[themeName] || themes.light;
  const spec = browserSpecs[browser] || browserSpecs.generic;

  return (
    <div style={browserStyles.window(spec.radius, theme)}>
      {/* tab bar */}
      <div style={browserStyles.chrome(theme, spec)}>
        <div style={browserStyles.tabRow}>
          <div style={browserStyles.tab(theme, spec)}>
            <Favicon favicon={favicon} color={theme.textMuted} />
            <span style={browserStyles.tabTitle}>{title}</span>
            <span style={browserStyles.tabClose(theme.textMuted)}>×</span>
          </div>
        </div>
      </div>

      {/* URL bar */}
      <div style={browserStyles.navBar(theme)}>
        <div style={browserStyles.navButtons(theme.textMuted)}>
          <div style={browserStyles.navButton}>‹</div>
          <div style={browserStyles.navButton}>›</div>
        </div>
        <div style={browserStyles.urlBar(theme, spec)}>
          <LockIcon secure={secure} color={theme.textMuted} />
          <span style={browserStyles.urlText}>{url}</span>
          <span style={browserStyles.refreshBtn(theme.textMuted)}>↻</span>
        </div>
      </div>

      {/* optional bookmark row */}
      {showBookmarks && (
        <div style={browserStyles.bookmarkRow(theme)}>
          {bookmarks.map((bm, i) => (
            <div key={i} style={browserStyles.bookmark(theme)} title={bm.url}>
              <Favicon favicon={bm.favicon} color={theme.textMuted} />
              <span>{bm.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* content slot */}
      <div style={{ ...browserStyles.content(theme), width, height }}>
        {children}
      </div>
    </div>
  );
}

if (typeof window !== 'undefined') {
  Object.assign(window, { BrowserWindow });
}
