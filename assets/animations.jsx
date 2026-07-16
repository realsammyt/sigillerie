/**
 * animations.jsx - Sigillerie timeline engine
 *
 * Stage holds the clock. Sprite owns a window of that clock. Components
 * inside read local progress and paint. Zero deps beyond React 18.
 *
 * Time-slice model:
 *   <Stage duration={N}>             clock runs 0 -> N seconds
 *     <Sprite start={a} end={b}>     mounts only when a <= time < b
 *       <Thing />                    inside, useSprite() returns
 *     </Sprite>                      { t, elapsed, duration, start, end }
 *   </Stage>                         t is normalized 0 -> 1.
 *
 * Exports (mounted on window for cross-script-tag access):
 *   - Stage           React component, the clock + viewport scaler
 *   - Sprite          React component, the time window
 *   - useTime()       global Stage time in seconds
 *   - useSprite()     local Sprite progress, zeros if outside a Sprite
 *   - useStageContext()  full stage ctx (pixelRatio, isRecording, ...)
 *   - Easing          named easing curves
 *   - interpolate     numeric range remap with optional easing
 *
 * Recording handshake (read by scripts/render-video.js):
 *   - window.__recording  set true before page load -> Stage forces loop=false,
 *                         parks at duration - 0.001 instead of wrapping, hides
 *                         the player chrome, and fits to the full viewport
 *   - window.__ready      Stage flips this true on first paint after fonts
 *                         load, so the recorder uses that as frame 0
 *
 * 3D handoff: when window.__recording AND window.__renderFrame are both set,
 * the 3D layer (assets/three3d-loader.js) drives time deterministically.
 * Stage skips its rAF loop in that case and just observes the time the 3D
 * layer writes back via setTime.
 *
 * What's new in Sigillerie vs. the huashu original:
 *   - pixelRatio prop on Stage, exposed via useStageContext() so a child
 *     WebGL canvas can size its backbuffer for the eventual export target
 *   - useStageContext() public hook
 *   - 3D-mode rAF skip when window.__renderFrame owns the clock
 */

(function () {
  const { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } = React;

  // Two contexts, two scopes. Stage ctx is global to the tree. Sprite ctx is
  // nearest-ancestor and resets per Sprite.
  const StageContext = createContext({
    time: 0,
    totalDuration: 10,
    playing: false,
    pixelRatio: 1,
    isRecording: false,
    setTime: () => {},
    setPlaying: () => {},
  });
  const SpriteContext = createContext(null);

  // ---- Easing ------------------------------------------------------------
  // Each easing maps t in [0,1] to an eased value (usually also in [0,1],
  // spring/overshoot may briefly leave the range; that's the point).

  const Easing = {
    linear: (t) => t,
    easeIn: (t) => t * t,
    easeOut: (t) => 1 - (1 - t) * (1 - t),
    easeInOut: (t) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    cubicIn: (t) => t * t * t,
    cubicOut: (t) => 1 - Math.pow(1 - t, 3),
    cubicInOut: (t) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    expoIn: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
    // Primary entrance easing. cubic-bezier(0.16, 1, 0.3, 1) feel.
    // Fast start, slow brake. Gives weight without bounce.
    expoOut: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    // Decaying oscillation. Settles past the target then back.
    spring: (t) => {
      if (t === 0 || t === 1) return t;
      const c = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
    },
  };

  // ---- interpolate -------------------------------------------------------
  // Numeric only. Clamps at both ends. Easing applied to normalized progress.

  function interpolate(t, inputRange, outputRange, easing) {
    const inStart = inputRange[0];
    const inEnd = inputRange[1];
    const outStart = outputRange[0];
    const outEnd = outputRange[1];

    if (t <= inStart) return outStart;
    if (t >= inEnd) return outEnd;

    const span = inEnd - inStart;
    let progress = span === 0 ? 1 : (t - inStart) / span;
    const ease = easing || Easing.linear;
    progress = ease(progress);
    return outStart + (outEnd - outStart) * progress;
  }

  // ---- Hooks -------------------------------------------------------------

  function useTime() {
    return useContext(StageContext).time;
  }

  function useStageContext() {
    return useContext(StageContext);
  }

  function useSprite() {
    const sprite = useContext(SpriteContext);
    if (!sprite) {
      // Outside any Sprite. Return zeros so components can be rendered raw
      // for inspection without crashing.
      return { t: 0, elapsed: 0, duration: 0, start: 0, end: 0 };
    }
    return sprite;
  }

  // ---- Styles ------------------------------------------------------------
  // Each styles object gets a unique name. Hard rule, keeps file searchable.

  const stageStyles = {
    wrapper: {
      position: 'fixed',
      inset: 0,
      background: '#000',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    },
    holder: {
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
    },
    canvas: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transformOrigin: 'center center',
      background: '#111',
      overflow: 'hidden',
    },
    controls: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(10px)',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      color: '#fff',
      fontSize: 12,
      zIndex: 100,
    },
    button: {
      background: 'none',
      border: '1px solid rgba(255,255,255,0.3)',
      color: '#fff',
      padding: '6px 14px',
      borderRadius: 4,
      cursor: 'pointer',
      fontSize: 12,
      fontFamily: 'inherit',
    },
    timeDisplay: {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontVariantNumeric: 'tabular-nums',
      minWidth: 96,
    },
    scrubber: {
      flex: 1,
      height: 4,
      background: 'rgba(255,255,255,0.2)',
      borderRadius: 2,
      position: 'relative',
      cursor: 'pointer',
    },
    scrubberFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      height: '100%',
      background: '#fff',
      borderRadius: 2,
      pointerEvents: 'none',
    },
    scrubberHandle: {
      position: 'absolute',
      top: '50%',
      width: 12,
      height: 12,
      background: '#fff',
      borderRadius: '50%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
    },
  };

  const spriteStyles = {
    layer: {
      position: 'absolute',
      inset: 0,
    },
  };

  // ---- Stage -------------------------------------------------------------

  function Stage(props) {
    const width = props.width != null ? props.width : 1920;
    const height = props.height != null ? props.height : 1080;
    const duration = props.duration != null ? props.duration : 10;
    const fps = props.fps != null ? props.fps : 60;
    const loop = props.loop != null ? props.loop : true;
    const bgColor = props.bgColor != null ? props.bgColor : '#fff';
    const children = props.children;

    // Read recording flag once at mount. Cache it so a late mutation can't
    // flip behavior mid-playback.
    const isRecording = useMemo(
      () => (typeof window !== 'undefined' ? !!window.__recording : false),
      []
    );

    // pixelRatio default reads window.devicePixelRatio at mount. Same caching
    // logic, no jitter if DPR changes mid-session (rare but possible on
    // multi-monitor drag).
    const defaultDpr = useMemo(() => {
      if (props.pixelRatio != null) return props.pixelRatio;
      if (typeof window !== 'undefined' && window.devicePixelRatio) {
        return window.devicePixelRatio;
      }
      return 1;
    }, [props.pixelRatio]);

    // Recording forces non-loop. Manual viewing keeps loop honest.
    const effectiveLoop = isRecording ? false : loop;

    const [time, setTime] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [scale, setScale] = useState(1);

    const rafRef = useRef(null);
    const canvasRef = useRef(null);

    // Viewport fit: scale the stage canvas to fit the window with letterbox.
    // Reserve 56px for the controls bar at the bottom. Recording renders no
    // controls, so it gets the full viewport (no baked-in letterbox gap).
    useEffect(() => {
      function fit() {
        const vw = window.innerWidth;
        const vh = window.innerHeight - (isRecording ? 0 : 56);
        const s = Math.min(vw / width, vh / height);
        setScale(s);
      }
      fit();
      window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
    }, [width, height, isRecording]);

    // The clock. rAF-driven wall-clock delta when the page owns time.
    // When the 3D layer owns time (recording AND __renderFrame defined),
    // skip the loop entirely; the 3D layer will call our setTime directly.
    useEffect(() => {
      if (!playing) return;

      const threeDeeOwnsClock =
        typeof window !== 'undefined' &&
        window.__recording === true &&
        typeof window.__renderFrame === 'function';

      if (threeDeeOwnsClock) {
        // 3D layer is in charge. Mark ready (so the recorder's wait completes)
        // and bow out. The 3D layer will pump time via the exposed setTime
        // path below or its own deterministic stepping.
        if (typeof window !== 'undefined') window.__ready = true;
        return;
      }

      let cancelled = false;
      let lastWall = null;

      function tick(now) {
        if (cancelled) return;
        if (lastWall === null) {
          // First frame. Start delta at 0 and announce readiness.
          // window.__ready flipping here pairs with frame 0 capture in the
          // recorder, so the trim offset matches the pre-animation gap.
          lastWall = now;
          if (typeof window !== 'undefined') window.__ready = true;
        }
        const delta = (now - lastWall) / 1000;
        lastWall = now;
        setTime((prev) => {
          const next = prev + delta;
          if (next >= duration) {
            // Park just shy of duration on non-loop so Sprites that end at
            // exactly `duration` stay visible on the final frame.
            return effectiveLoop ? 0 : duration - 0.001;
          }
          return next;
        });
        rafRef.current = requestAnimationFrame(tick);
      }

      // Wait for fonts so frame 0 is the loaded state, not a fallback flash.
      // 100ms timeout fallback for browsers without document.fonts.
      let started = false;
      const begin = () => {
        if (cancelled || started) return;
        started = true;
        rafRef.current = requestAnimationFrame(tick);
      };
      if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        document.fonts.ready.then(begin);
        // Belt and braces. If fonts.ready never resolves (some Linux headless
        // setups have hit this) the timeout still gets us moving.
        setTimeout(begin, 100);
      } else {
        setTimeout(begin, 100);
      }

      return () => {
        cancelled = true;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, [playing, duration, effectiveLoop]);

    const handleScrub = useCallback(
      (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        const next = Math.max(0, Math.min(duration, ratio * duration));
        setTime(next);
      },
      [duration]
    );

    const handleSeek = useCallback(
      (e) => {
        handleScrub(e);
        setPlaying(false);
      },
      [handleScrub]
    );

    const progress = duration > 0 ? time / duration : 0;

    // Stage ctx. Memoize so descendants don't re-render on identity churn
    // when only `time` changes (time itself moves so most consumers re-render
    // anyway, but useStageContext consumers reading only pixelRatio benefit).
    const stageCtx = useMemo(
      () => ({
        time,
        totalDuration: duration,
        duration, // alias, some legacy consumers read .duration directly
        playing,
        pixelRatio: defaultDpr,
        isRecording,
        fps,
        width,
        height,
        setTime,
        setPlaying,
      }),
      [time, duration, playing, defaultDpr, isRecording, fps, width, height]
    );

    const canvasStyle = {
      ...stageStyles.canvas,
      width,
      height,
      background: bgColor,
      transform: `translate(-50%, -50%) scale(${scale})`,
    };

    const fillStyle = { ...stageStyles.scrubberFill, width: `${progress * 100}%` };
    const handleStyle = { ...stageStyles.scrubberHandle, left: `${progress * 100}%` };

    return (
      <StageContext.Provider value={stageCtx}>
        <div style={stageStyles.wrapper}>
          <div style={stageStyles.holder}>
            <div ref={canvasRef} style={canvasStyle}>
              {children}
            </div>
          </div>

          {!isRecording && (
            <div style={stageStyles.controls}>
              <button
                style={stageStyles.button}
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? 'Pause' : 'Play'}
              </button>

              <button
                style={stageStyles.button}
                onClick={() => setTime(0)}
              >
                Restart
              </button>

              <div style={stageStyles.timeDisplay}>
                {time.toFixed(2)}s / {duration.toFixed(2)}s
              </div>

              <div style={stageStyles.scrubber} onMouseDown={handleSeek}>
                <div style={fillStyle} />
                <div style={handleStyle} />
              </div>
            </div>
          )}
        </div>
      </StageContext.Provider>
    );
  }

  // ---- Sprite ------------------------------------------------------------

  function Sprite(props) {
    const start = props.start != null ? props.start : 0;
    const end = props.end != null ? props.end : Infinity;
    const style = props.style;
    const children = props.children;

    const stageCtx = useContext(StageContext);
    const time = stageCtx.time;

    // Out of window: render nothing. Children unmount, state resets on
    // next entry. Hoist persistent state up if you need it across loops.
    if (time < start || time >= end) {
      return null;
    }

    const duration = end - start;
    const elapsed = time - start;
    const t = duration <= 0 ? 1 : Math.max(0, Math.min(1, elapsed / duration));

    const spriteValue = { t, elapsed, duration, start, end };

    // Children-as-function: <Sprite>{({t}) => ...}</Sprite>
    // Children-as-element: <Sprite><Comp /></Sprite> where Comp uses useSprite()
    let rendered;
    if (typeof children === 'function') {
      rendered = children(spriteValue);
    } else {
      rendered = children;
    }

    const layerStyle = style ? { ...spriteStyles.layer, ...style } : spriteStyles.layer;

    return (
      <SpriteContext.Provider value={spriteValue}>
        <div style={layerStyle}>{rendered}</div>
      </SpriteContext.Provider>
    );
  }

  // ---- Export ------------------------------------------------------------
  // Both window.Animations (namespaced, matches huashu original) and direct
  // window assignment (per Sigillerie's react-setup.md scope rule).

  if (typeof window !== 'undefined') {
    window.Animations = {
      Stage,
      Sprite,
      useTime,
      useSprite,
      useStageContext,
      Easing,
      interpolate,
    };
    Object.assign(window, {
      Stage,
      Sprite,
      useTime,
      useSprite,
      useStageContext,
      Easing,
      interpolate,
    });
  }
})();
