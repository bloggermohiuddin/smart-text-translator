/* Smart Text Translator — Google Translate gtx client.
 * Runs in the extension's background service worker.
 *
 * translate({ text, source, target })
 *   -> { ok: true, translatedText, detectedSourceLang }
 *   -> { ok: false, code, message }
 */
(function () {
  'use strict';

  async function translate({ text, source, target }) {
    const E = globalThis.STT.ERRORS;

    if (!text || !text.trim()) return { ok: false, code: 'EMPTY', message: E.EMPTY };

    const query = new URLSearchParams({
      client: 'gtx',
      sl: source || 'auto',
      tl: target,
      dt: 't',
      q: text
    });

    let response;
    try {
      response = await fetch(`${globalThis.STT.API_ENDPOINT}?${query}`);
    } catch (e) {
      return { ok: false, code: 'NETWORK', message: E.NETWORK };
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (e) {
      return { ok: false, code: 'API_ERROR', message: E.API_ERROR };
    }

    if (!response.ok) return { ok: false, code: 'API_ERROR', message: E.API_ERROR };

    const chunks = payload && Array.isArray(payload[0]) ? payload[0] : [];
    const translatedText = chunks
      .filter((chunk) => Array.isArray(chunk) && typeof chunk[0] === 'string')
      .map((chunk) => chunk[0])
      .join('');

    if (!translatedText.trim()) {
      return { ok: false, code: 'EMPTY', message: E.EMPTY };
    }

    const detectedSourceLang = typeof payload[2] === 'string' ? payload[2] : null;

    return {
      ok: true,
      translatedText: decodeEntities(translatedText),
      detectedSourceLang
    };
  }

  // Pure-JS HTML entity decoder — works in the service worker where no DOM exists.
  // Covers numeric entities plus the common named ones Google may return.
  const NAMED_ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
    nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘',
    rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', copy: '©', reg: '®'
  };

  function decodeEntities(str) {
    if (!/&(?:#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z]+);/.test(str)) return str;
    return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
      if (body[0] === '#') {
        const isHex = body[1] === 'x' || body[1] === 'X';
        const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        if (Number.isFinite(code) && code >= 0 && code <= 0x10ffff) {
          try {
            return String.fromCodePoint(code);
          } catch (e) {
            return match;
          }
        }
        return match;
      }
      const named = NAMED_ENTITIES[body.toLowerCase()];
      return named !== undefined ? named : match;
    });
  }

  globalThis.STT = Object.assign(globalThis.STT || {}, {
    Translator: { translate }
  });
})();
