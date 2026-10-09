/* Smart Text Translator — shared utilities (globalThis.STT.Utils) */
(function () {
  'use strict';

  /**
   * Normalize a raw text selection: trim outer whitespace and collapse
   * 3+ consecutive newlines into paragraph breaks while preserving
   * meaningful line/paragraph structure.
   */
  function normalizeSelectedText(raw) {
    if (typeof raw !== 'string') return '';
    let text = raw.replace(/ /g, ' ');
    text = text.replace(/[ \t]+$/gm, '');      // trailing spaces per line
    text = text.replace(/\n{3,}/g, '\n\n');    // collapse big gaps to one blank line
    return text.trim();
  }

  function debounce(fn, wait) {
    let t = null;
    return function debounced(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /** djb2 hash — short stable key for the translation cache. */
  function hashString(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
  }

  function cacheKey(text, source, target) {
    return hashString(`${source}=>${target}::${text}`);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** Resolve 'auto' target language to the browser UI language. */
  function resolveTargetLang(code) {
    if (code && code !== 'auto') return code;
    const ui = (globalThis.navigator && navigator.language) || 'en';
    const base = ui.split('-')[0].toLowerCase();
    const supported = (globalThis.STT.LANGUAGES || []).map((l) => l.code);
    if (supported.includes(ui)) return ui;
    if (supported.includes(base)) return base;
    return 'en';
  }

  function languageName(code) {
    if (!code || code === 'auto') return 'Auto';
    const hit = (globalThis.STT.LANGUAGES || []).find((l) => l.code === code);
    return hit ? hit.name : code;
  }

  /** Escape for safe inclusion if HTML must ever be built as a string. */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback for pages where the async clipboard API is unavailable
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  globalThis.STT = Object.assign(globalThis.STT || {}, {
    Utils: {
      normalizeSelectedText,
      debounce,
      hashString,
      cacheKey,
      uid,
      resolveTargetLang,
      languageName,
      escapeHtml,
      copyToClipboard
    }
  });
})();
