/**
 * AndroidFrame, Pixel-style Android device chrome.
 *
 * Wraps content in: edge bezel, hole-punch camera, Material You status bar,
 * gesture pill or 3-button nav. Pixel ratio aware.
 *
 * Default device: Pixel 9 Pro generic (412 x 892 dp).
 *
 *   <AndroidFrame time="9:41" battery={85} theme="dark" navMode="gesture">
 *     <App />
 *   </AndroidFrame>
 */

// Device specs in dp. Bezel padding scales with device.
const ANDROID_DEVICES = {
  'pixel-9-pro':  { w: 412, h: 892, radius: 32, bezel: 10, hole: 12, holeTop: 12 },
  'pixel-9':      { w: 412, h: 892, radius: 28, bezel: 11, hole: 12, holeTop: 14 },
  'samsung-s24':  { w: 384, h: 832, radius: 26, bezel: 9,  hole: 10, holeTop: 12 },
};

// Theme tokens. Material You leans flat, currentColor everywhere.
const ANDROID_THEMES = {
  light: { bg: '#ffffff', fg: '#1a1a1a', bezel: '#0a0a0a', bezelRing: '#222', pill: 'rgba(0,0,0,0.55)' },
  dark:  { bg: '#0b0b0d', fg: '#e8eaed', bezel: '#000000', bezelRing: '#1a1a1a', pill: 'rgba(255,255,255,0.7)' },
};

const androidFrameStyles = {
  wrapper: {
    display: 'inline-block',
    position: 'relative',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  screen: {
    position: 'relative',
    overflow: 'hidden',
  },
  statusBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: '"Google Sans", Roboto, system-ui, sans-serif',
    letterSpacing: 0.1,
    zIndex: 20,
    pointerEvents: 'none',
  },
  statusIcons: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  punchHole: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#000',
    borderRadius: '50%',
    boxShadow: 'inset 0 0 1px rgba(255,255,255,0.08)',
    zIndex: 30,
  },
  content: {
    position: 'absolute',
    top: 28,
    left: 0, right: 0,
    bottom: 0,
    overflow: 'auto',
  },
  gesturePill: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 108,
    height: 4,
    borderRadius: 999,
    zIndex: 25,
  },
  navRow: {
    position: 'absolute',
    bottom: 0,
    left: 0, right: 0,
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '0 32px',
    zIndex: 25,
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32, height: 32,
  },
};

// Cellular bars, Material You outline, 4 stepped rects.
function CellularIcon({ signal = 4 }) {
  const bars = [3, 5, 7, 9];
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true">
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 4}
          y={11 - h}
          width="3"
          height={h}
          rx="0.5"
          fill="currentColor"
          opacity={i < signal ? 1 : 0.25}
        />
      ))}
    </svg>
  );
}

// Wifi, 3 arcs + dot, currentColor.
function WifiIcon({ on = true }) {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true" style={{ opacity: on ? 1 : 0.25 }}>
      <path d="M1 4.5a11 11 0 0114 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" fill="none" />
      <path d="M3 7a8 8 0 0110 0"     stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.85" fill="none" />
      <path d="M5.2 9.4a4.5 4.5 0 015.6 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <circle cx="8" cy="11" r="0.9" fill="currentColor" />
    </svg>
  );
}

// Battery, outlined pill + tip + fill, percent text optional.
function BatteryIcon({ level = 85 }) {
  const pct = Math.max(0, Math.min(100, level));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 22, height: 11,
        border: '1.3px solid currentColor',
        borderRadius: 3,
        padding: 1,
        position: 'relative',
        opacity: 0.9,
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: 'currentColor',
          borderRadius: 1,
        }} />
        <div style={{
          position: 'absolute',
          top: 2.5, right: -3,
          width: 2, height: 4,
          background: 'currentColor',
          borderRadius: '0 1px 1px 0',
        }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600 }}>{pct}%</span>
    </div>
  );
}

// 3-button nav glyphs, back triangle, home circle, recent square.
function NavButtons({ color }) {
  const stroke = { stroke: color, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <>
      <div style={androidFrameStyles.navBtn}>
        <svg width="20" height="20" viewBox="0 0 20 20"><polygon points="13,4 5,10 13,16" {...stroke} /></svg>
      </div>
      <div style={androidFrameStyles.navBtn}>
        <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" {...stroke} /></svg>
      </div>
      <div style={androidFrameStyles.navBtn}>
        <svg width="20" height="20" viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="12" rx="1.5" {...stroke} /></svg>
      </div>
    </>
  );
}

function AndroidFrame({
  children,
  time = '9:41',
  battery = 85,
  signal = 4,
  wifi = true,
  theme = 'light',
  navMode = 'gesture',
  device = 'pixel-9-pro',
}) {
  const spec  = ANDROID_DEVICES[device] || ANDROID_DEVICES['pixel-9-pro'];
  const tones = ANDROID_THEMES[theme]   || ANDROID_THEMES.light;

  // Bottom inset matches nav style so content doesn't collide.
  const bottomInset = navMode === 'buttons' ? 56 : 24;

  return (
    <div style={{
      ...androidFrameStyles.wrapper,
      padding: spec.bezel,
      background: tones.bezel,
      borderRadius: spec.radius + spec.bezel,
      boxShadow: `0 0 0 1.5px ${tones.bezelRing}, 0 20px 60px rgba(0,0,0,0.3)`,
    }}>
      <div style={{
        ...androidFrameStyles.screen,
        width: spec.w,
        height: spec.h,
        borderRadius: spec.radius,
        background: tones.bg,
        color: tones.fg,
      }}>
        {/* Status bar, time left, icons right. */}
        <div style={{ ...androidFrameStyles.statusBar, color: tones.fg }}>
          <span>{time}</span>
          <div style={androidFrameStyles.statusIcons}>
            <CellularIcon signal={signal} />
            {wifi && <WifiIcon on={wifi} />}
            <BatteryIcon level={battery} />
          </div>
        </div>

        {/* Hole-punch camera, top-center. */}
        <div style={{
          ...androidFrameStyles.punchHole,
          top: spec.holeTop,
          width: spec.hole,
          height: spec.hole,
        }} />

        {/* App content, inset for status + nav. */}
        <div style={{ ...androidFrameStyles.content, bottom: bottomInset }}>
          {children}
        </div>

        {/* Gesture pill, single thin bar, centered. */}
        {navMode === 'gesture' && (
          <div style={{ ...androidFrameStyles.gesturePill, background: tones.pill }} />
        )}

        {/* 3-button nav, back / home / recent. */}
        {navMode === 'buttons' && (
          <div style={androidFrameStyles.navRow}>
            <NavButtons color={tones.fg} />
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { AndroidFrame });
