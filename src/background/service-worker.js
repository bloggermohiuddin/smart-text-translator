/* Smart Text Translator — background service worker (Manifest V3)
 * Sole owner of Google Translate communication, translation cache,
 * history writes, the context-menu fallback and the keyboard command.
 */
'use strict';

importScripts(
  '../shared/constants.js',
  '../shared/utils.js',
  '../shared/storage.js',
  '../shared/translator.js'
);

const { MSG, Utils, Storage, Translator, ERRORS } = globalThis.STT;

/* ------------------------------------------------------------------ *
 * In-memory translation cache (front of the persistent cache) so the
 * service worker survives restarts without losing hot translations.
 * ------------------------------------------------------------------ */
const memoryCache = new Map(); // key -> { t, s, ts }

function memCacheGet(key) {
  const hit = memoryCache.get(key);
  if (hit) {
    // refresh LRU position
    memoryCache.delete(key);
    memoryCache.set(key, hit);
  }
  return hit || null;
}

function memCacheSet(key, value) {
  memoryCache.set(key, value);
  while (memoryCache.size > STT.MAX_CACHE_ITEMS) {
    memoryCache.delete(memoryCache.keys().next().value);
  }
}

/* ------------------------------------------------------------------ *
 * Core translation pipeline: cache -> API -> cache + history
 * ------------------------------------------------------------------ */
async function performTranslation({ text, source, target }) {
  const settings = await Storage.getSettings();
  const resolvedTarget = Utils.resolveTargetLang(target || settings.targetLang);
  const resolvedSource = source || settings.sourceLang || 'auto';

  if (text.length > STT.API_HARD_LIMIT) {
    return { ok: false, code: 'TOO_LONG', message: ERRORS.TOO_LONG };
  }

  const key = Utils.cacheKey(text, resolvedSource, resolvedTarget);

  const mem = memCacheGet(key);
  if (mem) {
    return { ok: true, translatedText: mem.t, detectedSourceLang: mem.s, cached: true };
  }
  const persisted = await Storage.getCached(key);
  if (persisted) {
    memCacheSet(key, persisted);
    return {
      ok: true,
      translatedText: persisted.t,
      detectedSourceLang: persisted.s,
      cached: true
    };
  }

  const result = await Translator.translate({
    text,
    source: resolvedSource,
    target: resolvedTarget
  });

  if (!result.ok) return result;

  const entry = { t: result.translatedText, s: result.detectedSourceLang, ts: Date.now() };
  memCacheSet(key, entry);
  // Persist best-effort; storage failures must not break translation
  Storage.setCached(key, entry).catch(() => {});

  if (settings.historyEnabled) {
    Storage.addHistoryItem({
      id: Utils.uid(),
      original: text,
      translated: result.translatedText,
      sourceLang: result.detectedSourceLang || resolvedSource,
      targetLang: resolvedTarget,
      ts: Date.now()
    }).catch(() => {});
  }

  return result;
}

/* ------------------------------------------------------------------ *
 * Context menu fallback ("Translate selected text")
 * ------------------------------------------------------------------ */
const MENU_ID = 'stt-translate-selection';

async function syncContextMenu() {
  const settings = await Storage.getSettings();
  await chrome.contextMenus.removeAll().catch(() => {});
  if (settings.contextMenuEnabled && settings.enabled) {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Translate selected text',
      contexts: ['selection']
    });
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab || tab.id == null) return;
  chrome.tabs.sendMessage(tab.id, { type: MSG.TRANSLATE_NOW }).catch(() => {});
});

/* ------------------------------------------------------------------ *
 * Keyboard shortcut (Alt+Shift+T by default, reconfigurable at
 * chrome://extensions/shortcuts)
 * ------------------------------------------------------------------ */
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'translate-selection') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: MSG.TRANSLATE_NOW }).catch(() => {});
  }
});

/* ------------------------------------------------------------------ *
 * Message routing
 * ------------------------------------------------------------------ */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return false;

  if (message.type === MSG.TRANSLATE) {
    performTranslation(message.payload || {})
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, code: 'UNKNOWN', message: ERRORS.UNKNOWN }));
    return true; // async response
  }

  if (message.type === MSG.OPEN_OPTIONS) {
    chrome.runtime.openOptionsPage();
    return false;
  }

  return false;
});

/* ------------------------------------------------------------------ *
 * Lifecycle
 * ------------------------------------------------------------------ */
chrome.runtime.onInstalled.addListener((details) => {
  syncContextMenu();
  if (details.reason === 'install') {
    // First-run: open settings so the user can configure the extension
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onStartup.addListener(syncContextMenu);

// Keep menu in sync even if the worker was restarted by a storage change
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[Storage.KEYS.SETTINGS]) {
    syncContextMenu();
  }
});

syncContextMenu();
