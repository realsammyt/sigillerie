/**
 * <deck-stage>, Sigillerie single-file deck web component
 *
 * Wraps <section class="slide"> children, auto-scales to viewport,
 * keyboard nav, slide counter, localStorage persistence, speaker notes,
 * print export, recording mode for video capture.
 *
 * Usage (script tag MUST come AFTER </deck-stage>, NOT in <head>):
 *
 *   <body>
 *     <deck-stage width="1920" height="1080" theme="light" aspect-fit="contain">
 *       <section class="slide" data-duration-sec="4">
 *         <h1>Slide 1</h1>
 *         <aside class="speaker-notes">notes for slide 1</aside>
 *       </section>
 *       <section class="slide">
 *         <h1>Slide 2</h1>
 *       </section>
 *     </deck-stage>
 *     <script src="assets/deck_stage.js"></script>
 *   </body>
 *
 * Attributes:
 *   width        canvas width  (default 1920)
 *   height       canvas height (default 1080)
 *   theme        "light" | "dark"     (default "light")
 *   aspect-fit   "contain" | "cover"  (default "contain")
 *
 * Keyboard:
 *   ArrowRight / Space  next
 *   ArrowLeft           prev
 *   Home / End          first / last
 *   f                   toggle fullscreen
 *   n                   toggle speaker notes panel
 *
 * Recording mode:
 *   set window.__recording = true BEFORE script loads.
 *   deck starts at slide 1, auto-advances per data-duration-sec on each section.
 *   sets window.__ready = true after first slide rendered.
 *
 * External control:
 *   window.__deckStage = the component instance (next/prev/goTo, currentSlide, totalSlides).
 *
 * PPTX-export hard constraints honored:
 *   - children are plain <section> in light DOM (no shadow-DOM wrapping that breaks html2pptx)
 *   - sections fill stage via flex on .active, NOT absolute positioning at section level
 *   - print stylesheet renders one section per page
 */

(function () {
  'use strict';

  const STORAGE_PREFIX = 'sigillerie-deck-';

  class DeckStage extends HTMLElement {
    constructor() {
      super();
      this._idx = 0;
      this._slides = [];
      this._notesOpen = false;
      this._storageKey = STORAGE_PREFIX + (location.pathname || 'default');
      this._onKey = this._onKey.bind(this);
      this._onResize = this._onResize.bind(this);
    }

    connectedCallback() {
      this._width = parseInt(this.getAttribute('width'), 10) || 1920;
      this._height = parseInt(this.getAttribute('height'), 10) || 1080;
      this._theme = this.getAttribute('theme') === 'dark' ? 'dark' : 'light';
      this._fit = this.getAttribute('aspect-fit') === 'cover' ? 'cover' : 'contain';

      this._injectStyles();
      this._buildChrome();

      // Sections may not be parsed yet if script ran early. Wait for parser.
      const init = () => {
        this._collectSlides();
        this._restoreSlide();
        this._bindEvents();
        this._updateScale();
        this._render();
        this._setupPageContract();
        this._maybeStartRecording();
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
      } else {
        requestAnimationFrame(init);
      }
    }

    disconnectedCallback() {
      window.removeEventListener('keydown', this._onKey);
      window.removeEventListener('resize', this._onResize);
    }

    // -- styles: injected to document.head so print rules and ::slotted-equivalent
    //    selectors target light-DOM <section> children directly.
    _injectStyles() {
      if (document.getElementById('deck-stage-styles')) return;
      const bgLight = '#fafafa';
      const fgLight = '#111';
      const bgDark = '#0a0a0a';
      const fgDark = '#f0f0f0';

      const style = document.createElement('style');
      style.id = 'deck-stage-styles';
      style.textContent = `
        deck-stage {
          display: block;
          position: fixed;
          inset: 0;
          overflow: hidden;
          background: ${bgLight};
          color: ${fgLight};
          font-family: -apple-system, "SF Pro Text", "PingFang SC", system-ui, sans-serif;
        }
        deck-stage[theme="dark"] {
          background: ${bgDark};
          color: ${fgDark};
        }

        deck-stage .deck-stage-frame {
          position: absolute;
          top: 0;
          left: 0;
          transform-origin: top left;
          will-change: transform;
          background: #fff;
          overflow: hidden;
        }
        deck-stage[theme="dark"] .deck-stage-frame {
          background: #111;
        }

        /* Sections live in light DOM so html2pptx can read them.
           Visibility toggled by .active class; .active uses flex to fill stage. */
        deck-stage > section {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          overflow: hidden;
        }
        deck-stage > section:not(.active) {
          display: none;
        }
        deck-stage > section.active {
          display: flex;
          flex-direction: column;
        }

        /* speaker-notes hidden in deck view; surfaces in notes panel */
        deck-stage > section .speaker-notes,
        deck-stage > section aside.speaker-notes {
          display: none;
        }

        deck-stage .deck-counter {
          position: fixed;
          right: 16px;
          bottom: 16px;
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.55);
          color: #fff;
          font-size: 13px;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.02em;
          opacity: 0.6;
          transition: opacity 0.2s;
          z-index: 100;
          user-select: none;
          pointer-events: none;
        }
        deck-stage .deck-counter:hover { opacity: 1; }
        deck-stage.fullscreen .deck-counter { display: none; }

        deck-stage .deck-notes-panel {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          max-height: 30vh;
          overflow-y: auto;
          padding: 16px 24px;
          background: rgba(20, 20, 20, 0.92);
          color: #f0f0f0;
          font-size: 14px;
          line-height: 1.6;
          z-index: 90;
          transform: translateY(100%);
          transition: transform 0.2s;
          box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.3);
        }
        deck-stage.notes-open .deck-notes-panel {
          transform: translateY(0);
        }
        deck-stage .deck-notes-panel:empty::before {
          content: "(no notes for this slide)";
          opacity: 0.5;
        }

        @media print {
          @page {
            size: ${this._width}px ${this._height}px;
            margin: 0;
          }
          html, body { margin: 0; padding: 0; background: #fff; }
          deck-stage {
            position: static !important;
            inset: auto !important;
            background: #fff !important;
          }
          deck-stage .deck-stage-frame {
            position: static !important;
            transform: none !important;
            width: auto !important;
            height: auto !important;
          }
          deck-stage .deck-counter,
          deck-stage .deck-notes-panel {
            display: none !important;
          }
          deck-stage > section {
            display: block !important;
            width: ${this._width}px !important;
            height: ${this._height}px !important;
            page-break-after: always;
            break-after: page;
            overflow: hidden;
          }
          deck-stage > section:last-child {
            page-break-after: auto;
          }
          deck-stage > section .speaker-notes,
          deck-stage > section aside.speaker-notes {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // -- chrome: frame wraps the canvas at fixed pixel size, scaled via transform.
    _buildChrome() {
      this.setAttribute('theme', this._theme);

      // Frame element wraps sections. We move existing children INTO it after parse.
      this._frame = document.createElement('div');
      this._frame.className = 'deck-stage-frame';
      this._frame.style.width = this._width + 'px';
      this._frame.style.height = this._height + 'px';

      this._counter = document.createElement('div');
      this._counter.className = 'deck-counter';
      this._counter.textContent = '1 / 1';

      this._notesPanel = document.createElement('div');
      this._notesPanel.className = 'deck-notes-panel';
    }

    _collectSlides() {
      // Sections are direct children. Move them into the frame so transform applies.
      const sections = Array.from(this.querySelectorAll(':scope > section'));
      sections.forEach((s) => this._frame.appendChild(s));
      this.appendChild(this._frame);
      this.appendChild(this._counter);
      this.appendChild(this._notesPanel);

      this._slides = sections;
      // Auto-label for accessibility / external tooling.
      this._slides.forEach((s, i) => {
        if (!s.classList.contains('slide')) s.classList.add('slide');
        if (!s.hasAttribute('data-slide-index')) {
          s.setAttribute('data-slide-index', String(i + 1));
        }
        if (!s.hasAttribute('data-screen-label')) {
          s.setAttribute('data-screen-label', String(i + 1).padStart(2, '0'));
        }
      });
    }

    _bindEvents() {
      window.addEventListener('keydown', this._onKey);
      window.addEventListener('resize', this._onResize);
      window.addEventListener('hashchange', () => this._handleHash());
      if (location.hash) this._handleHash();

      // Recompute scale once fonts settle (prevents first-frame jitter).
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => this._updateScale());
      }
    }

    _onKey(e) {
      if (e.target && e.target.matches && e.target.matches('input, textarea, [contenteditable]')) return;
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'PageDown':
          e.preventDefault();
          this.next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          this.prev();
          break;
        case 'Home':
          e.preventDefault();
          this.goTo(0);
          break;
        case 'End':
          e.preventDefault();
          this.goTo(this._slides.length - 1);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          this._toggleFullscreen();
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          this._toggleNotes();
          break;
      }
    }

    _onResize() {
      this._updateScale();
    }

    _handleHash() {
      const m = location.hash.match(/^#slide-(\d+)$/);
      if (!m) return;
      const idx = parseInt(m[1], 10) - 1;
      if (idx >= 0 && idx < this._slides.length) this.goTo(idx);
    }

    _restoreSlide() {
      try {
        const v = localStorage.getItem(this._storageKey);
        if (v === null) return;
        const i = parseInt(v, 10);
        if (Number.isFinite(i) && i >= 0 && i < this._slides.length) this._idx = i;
      } catch (_) { /* localStorage may be blocked */ }
    }

    _saveSlide() {
      try {
        localStorage.setItem(this._storageKey, String(this._idx));
      } catch (_) { /* ignore */ }
    }

    _updateScale() {
      if (!this._frame) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const sx = vw / this._width;
      const sy = vh / this._height;
      // contain = fit inside (letterbox), cover = fill (crop)
      const scale = this._fit === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
      const sw = this._width * scale;
      const sh = this._height * scale;
      const ox = (vw - sw) / 2;
      const oy = (vh - sh) / 2;
      this._frame.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
    }

    _render() {
      this._slides.forEach((s, i) => s.classList.toggle('active', i === this._idx));
      if (this._counter) {
        this._counter.textContent = `${this._idx + 1} / ${this._slides.length}`;
      }
      this._renderNotes();
      // Notify external listeners (parent windows, recording harness).
      try {
        const msg = { type: 'deck:slide', index: this._idx, total: this._slides.length };
        window.postMessage(msg, '*');
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(msg, '*');
        }
      } catch (_) { /* ignore */ }
    }

    _renderNotes() {
      if (!this._notesPanel) return;
      const cur = this._slides[this._idx];
      let txt = '';
      if (cur) {
        const aside = cur.querySelector(':scope > aside.speaker-notes, :scope > .speaker-notes');
        if (aside) txt = aside.innerHTML;
      }
      this._notesPanel.innerHTML = txt;
    }

    _toggleNotes() {
      this._notesOpen = !this._notesOpen;
      this.classList.toggle('notes-open', this._notesOpen);
    }

    _toggleFullscreen() {
      const el = document.documentElement;
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
        this.classList.add('fullscreen');
      } else {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        this.classList.remove('fullscreen');
      }
    }

    // -- page contract: expose component for external drivers (Playwright, recorder)
    _setupPageContract() {
      window.__deckStage = this;
    }

    // -- recording: auto-advance through slides at per-section cadence
    _maybeStartRecording() {
      if (window.__recording !== true) return;
      this.goTo(0);
      // Mark ready AFTER first frame renders so capture harness can begin.
      requestAnimationFrame(() => {
        window.__ready = true;
        this._scheduleAdvance();
      });
    }

    _scheduleAdvance() {
      const cur = this._slides[this._idx];
      if (!cur) return;
      const dur = parseFloat(cur.getAttribute('data-duration-sec'));
      const ms = (Number.isFinite(dur) && dur > 0 ? dur : 4) * 1000;
      setTimeout(() => {
        if (this._idx < this._slides.length - 1) {
          this.next();
          this._scheduleAdvance();
        } else {
          // End of deck, signal completion for capture harness.
          window.__done = true;
          try {
            window.postMessage({ type: 'deck:done' }, '*');
          } catch (_) { /* ignore */ }
        }
      }, ms);
    }

    // -- public API
    next() {
      if (this._idx < this._slides.length - 1) {
        this._idx++;
        this._saveSlide();
        this._render();
      }
    }

    prev() {
      if (this._idx > 0) {
        this._idx--;
        this._saveSlide();
        this._render();
      }
    }

    goTo(i) {
      if (i >= 0 && i < this._slides.length && i !== this._idx) {
        this._idx = i;
        this._saveSlide();
        this._render();
      } else if (i === this._idx) {
        // Force re-render if same idx (e.g. recording start at 0 when restored to 0).
        this._render();
      }
    }

    get currentSlide() { return this._idx; }
    get totalSlides()  { return this._slides.length; }
  }

  if (!customElements.get('deck-stage')) {
    customElements.define('deck-stage', DeckStage);
  }
  window.DeckStage = DeckStage;
})();
