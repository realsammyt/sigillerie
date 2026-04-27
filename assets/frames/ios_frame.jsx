/**
 * IosFrame, pixel-accurate iPhone chrome
 *
 * Default profile: iPhone 15 Pro (393x852 pt, 1179x2556 px @3x)
 * Bezel radius 55pt, Dynamic Island 124x36, status bar 54pt, home indicator 134x5
 *
 * Usage:
 *   <IosFrame time="9:41" battery={85} signal={4} wifi theme="light">
 *     <YourApp />
 *   </IosFrame>
 *
 * 1pt = 1 logical CSS px. Parent Stage handles overall scale.
 */

// device profiles, outer logical size, corner radius, island geometry, safe insets
const IOS_DEVICES = {
  'iphone-15-pro': {
    width: 393,
    height: 852,
    radius: 55,
    island: { width: 124, height: 36, top: 12 },
    statusBarHeight: 54,
    homeIndicator: { width: 134, height: 5, bottom: 8 },
    contentTop: 54,
    contentBottom: 34,
  },
  'iphone-15-pro-max': {
    width: 430,
    height: 932,
    radius: 55,
    island: { width: 124, height: 36, top: 12 },
    statusBarHeight: 54,
    homeIndicator: { width: 134, height: 5, bottom: 8 },
    contentTop: 54,
    contentBottom: 34,
  },
};

// theme palette
const IOS_THEMES = {
  light: { screen: '#fff', text: '#000', homeIndicator: 'rgba(0,0,0,0.35)' },
  dark: { screen: '#000', text: '#fff', homeIndicator: 'rgba(255,255,255,0.55)' },
};

// default time HH:MM 12-hour without AM/PM
function defaultTime() {
  const d = new Date();
  let h = d.getHours() % 12;
  if (h === 0) h = 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// pixel ratio: use Stage context if present, else window
function usePixelRatio() {
  const ctx = typeof window !== 'undefined' && window.StagePixelRatioContext;
  if (ctx && typeof React !== 'undefined' && React.useContext) {
    const v = React.useContext(ctx);
    if (v) return v;
  }
  return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
}

const iosFrameStyles = {
  bezel: {
    position: 'relative',
    background: '#000',
    boxShadow: 'inset 0 0 0 12px #1a1a1a, 0 30px 60px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    isolation: 'isolate',
  },
  screen: {
    position: 'absolute',
    inset: 12,
    overflow: 'hidden',
  },
  dynamicIsland: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#000',
    borderRadius: 999,
    zIndex: 30,
    pointerEvents: 'none',
  },
  statusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    fontSize: 17,
    fontWeight: 600,
    fontFamily: '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif',
    letterSpacing: 0.2,
    zIndex: 20,
    pointerEvents: 'none',
  },
  statusSide: {
    flex: '0 0 auto',
    minWidth: 80,
    display: 'flex',
    alignItems: 'center',
  },
  statusLeft: {
    justifyContent: 'flex-start',
  },
  statusRight: {
    justifyContent: 'flex-end',
    gap: 6,
  },
  statusGap: {
    flex: '1 1 auto',
  },
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  homeIndicator: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    borderRadius: 999,
    zIndex: 25,
    pointerEvents: 'none',
  },
};

// signal bars, 4 bars, filled count = signal
function SignalIcon({ level, color }) {
  const heights = [4, 6, 8, 10];
  return (
    <svg width="18" height="11" viewBox="0 0 18 11" style={{ display: 'block' }}>
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 4.5}
          y={11 - h}
          width="3"
          height={h}
          rx="0.8"
          fill={color}
          opacity={i < level ? 1 : 0.3}
        />
      ))}
    </svg>
  );
}

// wifi, three concentric arcs + dot
function WifiIcon({ on, color }) {
  const op = on ? 1 : 0.3;
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" style={{ display: 'block' }}>
      <path d="M1 4.2a11 11 0 0114 0" stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity={op * 0.7} />
      <path d="M3.2 6.6a7.5 7.5 0 019.6 0" stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity={op * 0.85} />
      <path d="M5.4 9a4 4 0 015.2 0" stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity={op} />
      <circle cx="8" cy="10.6" r="1" fill={color} opacity={op} />
    </svg>
  );
}

// battery, body 25x12, 1.5 stroke, fill bar inside, cap on right
function BatteryIcon({ level, color }) {
  const pct = Math.max(0, Math.min(100, level));
  const fillW = (22 / 100) * pct;
  return (
    <svg width="28" height="13" viewBox="0 0 28 13" style={{ display: 'block' }}>
      <rect x="0.75" y="0.75" width="24.5" height="11.5" rx="2.5" stroke={color} strokeWidth="1.2" fill="none" opacity="0.55" />
      <rect x="2" y="2" width={fillW} height="9" rx="1.4" fill={color} />
      <rect x="26" y="4" width="1.5" height="5" rx="0.7" fill={color} opacity="0.55" />
    </svg>
  );
}

function IosFrame({
  children,
  time,
  battery = 85,
  signal = 4,
  wifi = true,
  theme = 'light',
  device = 'iphone-15-pro',
}) {
  const profile = IOS_DEVICES[device] || IOS_DEVICES['iphone-15-pro'];
  const palette = IOS_THEMES[theme] || IOS_THEMES.light;
  const ratio = usePixelRatio();
  const displayTime = time || defaultTime();

  const { width, height, radius, island, statusBarHeight, homeIndicator, contentTop, contentBottom } = profile;

  // status bar top half (8 above island), bottom half centers icons vertically with island
  const iconRowY = island.top + island.height / 2; // vertical center line for status icons

  return (
    <div
      style={{
        ...iosFrameStyles.bezel,
        width,
        height,
        borderRadius: radius,
      }}
      data-device={device}
      data-pixel-ratio={ratio}
    >
      <div
        style={{
          ...iosFrameStyles.screen,
          background: palette.screen,
          borderRadius: radius - 12,
        }}
      >
        {/* status bar, text/icons aligned to island vertical center */}
        <div
          style={{
            ...iosFrameStyles.statusBar,
            height: statusBarHeight,
            color: palette.text,
          }}
        >
          <div
            style={{
              ...iosFrameStyles.statusSide,
              ...iosFrameStyles.statusLeft,
              height: island.height,
              marginTop: island.top,
            }}
          >
            <span>{displayTime}</span>
          </div>
          <div style={iosFrameStyles.statusGap} />
          <div
            style={{
              ...iosFrameStyles.statusSide,
              ...iosFrameStyles.statusRight,
              height: island.height,
              marginTop: island.top,
            }}
          >
            <SignalIcon level={signal} color={palette.text} />
            <WifiIcon on={wifi} color={palette.text} />
            <BatteryIcon level={battery} color={palette.text} />
          </div>
        </div>

        {/* dynamic island sits above status bar text, centered */}
        <div
          style={{
            ...iosFrameStyles.dynamicIsland,
            top: island.top,
            width: island.width,
            height: island.height,
          }}
        />

        {/* content viewport, between status bar and home indicator */}
        <div
          style={{
            ...iosFrameStyles.content,
            top: contentTop,
            bottom: contentBottom,
          }}
        >
          {children}
        </div>

        {/* home indicator */}
        <div
          style={{
            ...iosFrameStyles.homeIndicator,
            bottom: homeIndicator.bottom,
            width: homeIndicator.width,
            height: homeIndicator.height,
            background: palette.homeIndicator,
          }}
        />
      </div>
    </div>
  );
}

Object.assign(window, { IosFrame });
