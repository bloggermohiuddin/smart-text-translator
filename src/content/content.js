/* Smart Text Translator — content script
 * Detects text selection on the page and renders the floating translation
 * popup inside a closed shadow root (page CSS can't break it, and our CSS
 * can't leak out). All translation requests go through the background worker.
 *
 * Every piece of text coming from the page or the API is inserted with
 * textContent — never innerHTML — to prevent XSS (requirement: the
 * selected webpage text is untrusted input).
 */
(function () {
  'use strict';

  if (window.__sttContentLoaded) return; // guard against double injection
  window.__sttContentLoaded = true;

  const { MSG, Utils, Storage } = globalThis.STT;

  /* ------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------ */
  let settings = null;
  let host = null;          // shadow host element
  let shadow = null;        // shadow root
  let popupEl = null;       // current popup element (inside shadow root)
  let cssReady = null;      // promise resolving when content.css is injected
  let requestSeq = 0;       // monotonically increasing id; stale responses dropped
  let pinned = false;       // per-popup pin toggle
  let autoCloseTimer = null;
  let lastSelectionText = '';

  const state = {
    original: '',
    translated: '',
    detectedLang: null,
    sourceLang: 'auto',
    targetLang: 'bn'
  };

  /* ------------------------------------------------------------ *
   * Settings
   * ------------------------------------------------------------ */
  async function loadSettings() {
    settings = await Storage.getSettings();
    state.targetLang = settings.targetLang;
    state.sourceLang = settings.sourceLang;
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[Storage.KEYS.SETTINGS]) return;
    const next = changes[Storage.KEYS.SETTINGS].newValue;
    if (next) {
      settings = Object.assign({}, globalThis.STT.DEFAULT_SETTINGS, next);
      state.targetLang = settings.targetLang;
      state.sourceLang = settings.sourceLang;
    }
  });

  function extensionAlive() {
    try {
      return !!chrome.runtime && !!chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  /* ------------------------------------------------------------ *
   * Shadow host + stylesheet
   * ------------------------------------------------------------ */
  function ensureHost() {
    if (host && document.documentElement.contains(host)) return shadow;
    host = document.createElement('div');
    host.id = '__stt-host__';
    // Zero-size anchor at the document origin; the popup positions itself
    // in absolute document coordinates so it scrolls naturally with content.
    host.style.cssText =
      'all:initial;position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;';
    shadow = host.attachShadow({ mode: 'open' });
    document.documentElement.appendChild(host);
    injectCss();
    return shadow;
  }

  function injectCss() {
    if (cssReady) return cssReady;
    cssReady = fetch(chrome.runtime.getURL('src/content/content.css'))
      .then((r) => r.text())
      .then((css) => {
        const style = document.createElement('style');
        style.textContent = css;
        shadow.appendChild(style);
      })
      .catch(() => {}); // worst case: unstyled but functional popup
    return cssReady;
  }

  /* ------------------------------------------------------------ *
   * Small DOM helpers (all safe — textContent only)
   * ------------------------------------------------------------ */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const ICONS = {
    logo: '<svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
    audio: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
    swap: '<svg viewBox="0 0 24 24"><path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/></svg>',
    retry: '<svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
    warn: '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>'
  };

  function iconButton(name, title) {
    const btn = el('button', 'stt-icon-btn');
    btn.type = 'button';
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.innerHTML = ICONS[name]; // static, extension-owned SVG markup only
    return btn;
  }

  function resolvedTheme() {
    if (settings.theme === 'dark' || settings.theme === 'light') return settings.theme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  /* ------------------------------------------------------------ *
   * Popup construction
   * ------------------------------------------------------------ */
  function buildPopup() {
    const popup = el('div', 'stt-popup');
    popup.dataset.theme = resolvedTheme();
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', 'Smart Text Translator');

    const header = el('div', 'stt-header');
    const brand = el('div', 'stt-brand');
    brand.innerHTML = ICONS.logo;
    brand.appendChild(el('span', '', 'Smart Translator'));
    header.appendChild(brand);
    header.appendChild(el('span', 'stt-spacer'));

    const pinBtn = iconButton('pin', 'Keep popup open');
    if (pinned || settings.pinPopup) pinBtn.classList.add('is-active');
    pinBtn.addEventListener('click', () => {
      pinned = !pinned;
      pinBtn.classList.toggle('is-active', pinned);
    });
    header.appendChild(pinBtn);

    const closeBtn = iconButton('close', 'Close');
    closeBtn.addEventListener('click', destroyPopup);
    header.appendChild(closeBtn);

    const body = el('div', 'stt-body');

    popup.appendChild(header);
    popup.appendChild(body);
    return { popup, body };
  }

  function showCopiedToast() {
    if (!popupEl) return;
    let toast = popupEl.querySelector('.stt-copied');
    if (!toast) {
      toast = el('span', 'stt-copied', 'Copied');
      popupEl.appendChild(toast);
    }
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1200);
  }

  function destroyPopup() {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
    if (popupEl) {
      popupEl.remove();
      popupEl = null;
    }
    pinned = false;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  /* ------------------------------------------------------------ *
   * Positioning — near the selection, clamped inside the viewport
   * ------------------------------------------------------------ */
  function positionPopup(rect) {
    if (!popupEl) return;
    const docX = rect.left + window.scrollX;
    const docTop = rect.top + window.scrollY;
    const docBottom = rect.bottom + window.scrollY;

    // Measure after insertion
    const w = popupEl.offsetWidth;
    const h = popupEl.offsetHeight;

    const margin = 8;
    const gap = 8;
    const pref = settings.popupPosition || 'auto';

    let top;
    const fitsAbove = rect.top - gap - h >= margin;
    const fitsBelow = window.innerHeight - rect.bottom - gap - h >= margin;

    if (pref === 'above') {
      top = fitsAbove ? docTop - h - gap : docBottom + gap;
    } else if (pref === 'below') {
      top = fitsBelow ? docBottom + gap : docTop - h - gap;
    } else {
      // auto: prefer above, fall back below, else whichever has more room
      if (fitsAbove) top = docTop - h - gap;
      else if (fitsBelow) top = docBottom + gap;
      else top = rect.top > window.innerHeight / 2 ? docTop - h - gap : docBottom + gap;
    }

    let left = docX;
    const minLeft = window.scrollX + margin;
    const maxLeft = window.scrollX + window.innerWidth - w - margin;
    left = Math.max(minLeft, Math.min(left, Math.max(minLeft, maxLeft)));

    popupEl.style.top = `${Math.round(top)}px`;
    popupEl.style.left = `${Math.round(left)}px`;
  }

  /* ------------------------------------------------------------ *
   * Popup states
   * ------------------------------------------------------------ */
  function renderLoading(body, rect) {
    body.textContent = '';
    const row = el('div', 'stt-loading');
    row.appendChild(el('span', 'stt-spinner'));
    row.appendChild(el('span', '', 'Translating...'));
    body.appendChild(row);
    positionPopup(rect);
  }

  function renderAsk(body, rect, text) {
    body.textContent = '';
    if (settings.showOriginal) {
      body.appendChild(el('div', 'stt-original', truncate(text, 140)));
    }
    const row = el('div', 'stt-ask');
    const translateBtn = el('button', 'stt-primary-btn', 'Translate');
    translateBtn.type = 'button';
    translateBtn.addEventListener('click', () => startTranslation(rect));
    const cancelBtn = el('button', 'stt-ghost-btn', 'Close');
    cancelBtn.type = 'button';
    cancelBtn.addEventListener('click', destroyPopup);
    row.appendChild(translateBtn);
    row.appendChild(cancelBtn);
    body.appendChild(row);
    positionPopup(rect);
  }

  function renderSuccess(body, rect) {
    body.textContent = '';

    if (settings.showOriginal) {
      body.appendChild(el('div', 'stt-original', truncate(state.original, 200)));
    }
    body.appendChild(el('div', 'stt-translation', state.translated));

    // Footer with actions
    let footer = popupEl.querySelector('.stt-footer');
    if (footer) footer.remove();
    footer = el('div', 'stt-footer');

    if (settings.showDetectedLang && state.detectedLang) {
      footer.appendChild(
        el('span', 'stt-badge', `${Utils.languageName(state.detectedLang)} → ${Utils.languageName(Utils.resolveTargetLang(state.targetLang))}`)
      );
    } else {
      footer.appendChild(el('span', 'stt-spacer'));
    }

    if (settings.showCopyButton) {
      const copyBtn = iconButton('copy', 'Copy translation');
      copyBtn.addEventListener('click', async () => {
        const ok = await Utils.copyToClipboard(state.translated);
        if (ok) showCopiedToast();
      });
      footer.appendChild(copyBtn);
    }

    if (settings.showAudioButton && 'speechSynthesis' in window) {
      const audioBtn = iconButton('audio', 'Listen');
      audioBtn.addEventListener('click', () => {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(state.translated);
        utter.lang = Utils.resolveTargetLang(state.targetLang);
        window.speechSynthesis.speak(utter);
      });
      footer.appendChild(audioBtn);
    }

    if (state.detectedLang && state.detectedLang !== Utils.resolveTargetLang(state.targetLang)) {
      const swapBtn = iconButton('swap', 'Swap languages and translate back');
      swapBtn.addEventListener('click', () => {
        const from = state.detectedLang;
        state.detectedLang = Utils.resolveTargetLang(state.targetLang);
        state.targetLang = from;
        state.original = state.translated;
        startTranslation(rect, { swapped: true });
      });
      footer.appendChild(swapBtn);
    }

    popupEl.appendChild(footer);
    positionPopup(rect);
    scheduleAutoClose();
  }

  function renderError(body, rect, code, message) {
    body.textContent = '';
    const wrap = el('div', 'stt-error');
    const msg = el('div', 'stt-error-msg');
    msg.innerHTML = ICONS.warn;
    msg.appendChild(el('span', '', message || globalThis.STT.ERRORS.UNKNOWN));
    wrap.appendChild(msg);

    const actions = el('div', 'stt-error-actions');
    if (code !== 'TOO_LONG') {
      const retryBtn = el('button', 'stt-primary-btn', 'Retry');
      retryBtn.type = 'button';
      retryBtn.addEventListener('click', () => startTranslation(rect));
      actions.appendChild(retryBtn);
    }
    const closeBtn = el('button', 'stt-ghost-btn', 'Close');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', destroyPopup);
    actions.appendChild(closeBtn);

    wrap.appendChild(actions);
    body.appendChild(wrap);
    positionPopup(rect);
  }

  function truncate(text, n) {
    return text.length > n ? `${text.slice(0, n)}…` : text;
  }

  function scheduleAutoClose() {
    clearTimeout(autoCloseTimer);
    const delay = Number(settings.autoCloseDelay) || 0;
    if (delay > 0) {
      autoCloseTimer = setTimeout(() => {
        if (!pinned && !settings.pinPopup) destroyPopup();
      }, delay * 1000);
    }
  }

  /* ------------------------------------------------------------ *
   * Translation flow
   * ------------------------------------------------------------ */
  async function startTranslation(rect, opts = {}) {
    if (!extensionAlive()) return;
    const seq = ++requestSeq;
    const body = popupEl && popupEl.querySelector('.stt-body');
    if (!body) return;

    renderLoading(body, rect);

    let response;
    try {
      response = await chrome.runtime.sendMessage({
        type: MSG.TRANSLATE,
        payload: {
          text: state.original,
          source: state.sourceLang,
          target: state.targetLang
        }
      });
    } catch (e) {
      response = { ok: false, code: 'UNKNOWN', message: globalThis.STT.ERRORS.UNKNOWN };
    }

    // A newer selection/request superseded this one — drop the result.
    if (seq !== requestSeq) return;
    const freshBody = popupEl && popupEl.querySelector('.stt-body');
    if (!freshBody) return;

    if (response && response.ok) {
      state.translated = response.translatedText;
      if (response.detectedSourceLang && !opts.swapped) {
        state.detectedLang = response.detectedSourceLang;
      }
      renderSuccess(freshBody, rect);
    } else {
      renderError(freshBody, rect, response && response.code, response && response.message);
    }
  }

  function openPopupForSelection(text, rect, forceTranslate) {
    ensureHost();
    destroyPopup();
    requestSeq++; // invalidate any in-flight request for a previous selection

    state.original = text;
    state.translated = '';
    state.detectedLang = null;
    state.targetLang = settings.targetLang;
    state.sourceLang = settings.sourceLang;

    const { popup, body } = buildPopup();
    popupEl = popup;
    shadow.appendChild(popup);

    // Place immediately at a provisional spot, then each render repositions.
    popup.style.top = `${Math.round(rect.bottom + window.scrollY + 8)}px`;
    popup.style.left = `${Math.round(rect.left + window.scrollX)}px`;

    if (text.length > settings.maxChars) {
      renderError(body, rect, 'TOO_LONG', globalThis.STT.ERRORS.TOO_LONG);
      return;
    }

    if (forceTranslate || settings.mode === 'instant') {
      startTranslation(rect);
    } else {
      renderAsk(body, rect, text);
    }
  }

  /* ------------------------------------------------------------ *
   * Selection detection
   * ------------------------------------------------------------ */
  function isInsideOwnPopup(node) {
    return !!(host && node && (host === node || host.contains(node)));
  }

  function getSelectionInfo() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    if (isInsideOwnPopup(sel.anchorNode) || isInsideOwnPopup(sel.focusNode)) return null;

    const text = Utils.normalizeSelectedText(sel.toString());
    if (text.length < (settings.minChars || 1)) return null;

    let rect;
    try {
      rect = sel.getRangeAt(0).getBoundingClientRect();
    } catch (e) {
      return null;
    }
    // Zero-size rects (e.g. hidden elements) have nowhere to anchor
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;

    return { text, rect };
  }

  const handleSelectionEvent = Utils.debounce((event) => {
    if (!settings || !settings.enabled || !settings.translateOnSelection) return;
    if (!extensionAlive()) return;
    if (event && isInsideOwnPopup(event.target)) return;

    const info = getSelectionInfo();
    if (!info) return;

    // Don't retrigger for the exact same selection while its popup is open
    if (info.text === lastSelectionText && popupEl) return;
    lastSelectionText = info.text;

    openPopupForSelection(info.text, info.rect, false);
  }, 140);

  document.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return; // left button only
    handleSelectionEvent(e);
  }, true);

  document.addEventListener('keyup', (e) => {
    // Keyboard selections: shift+arrows / ctrl+a etc.
    if (e.shiftKey || e.key === 'Shift' || (e.ctrlKey || e.metaKey)) {
      handleSelectionEvent(e);
    }
  }, true);

  // Close when clicking anywhere outside the popup (unless pinned)
  document.addEventListener('mousedown', (e) => {
    if (!popupEl) return;
    if (isInsideOwnPopup(e.target)) return;
    if (pinned || settings.pinPopup) return;
    destroyPopup();
    lastSelectionText = '';
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popupEl) {
      destroyPopup();
      lastSelectionText = '';
    }
  }, true);

  /* ------------------------------------------------------------ *
   * Messages from the service worker (context menu / shortcut)
   * ------------------------------------------------------------ */
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== MSG.TRANSLATE_NOW) return;
    if (!settings || !settings.enabled) return;
    const info = getSelectionInfo();
    if (!info) return;
    lastSelectionText = info.text;
    openPopupForSelection(info.text, info.rect, true); // always translate now
  });

  /* ------------------------------------------------------------ */
  loadSettings();
})();
