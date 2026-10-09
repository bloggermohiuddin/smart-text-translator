/* Smart Text Translator — storage abstraction over chrome.storage.local
 * All reads/writes go through STT.Storage so keys never scatter.
 *
 * Schema:
 *   settings : object   (see STT.DEFAULT_SETTINGS)
 *   history  : array    [{ id, original, translated, sourceLang, targetLang, ts }]
 *   cache    : object   { [hash]: { t: translatedText, s: detectedLang, ts } }
 */
(function () {
  'use strict';

  const KEYS = { SETTINGS: 'settings', HISTORY: 'history', CACHE: 'cache' };

  // Promise wrappers (MV3 chrome.* also returns promises, but wrap for Edge safety)
  function storageGet(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        const err = chrome.runtime.lastError;
        if (err) reject(err); else resolve(result);
      });
    });
  }

  function storageSet(obj) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(obj, () => {
        const err = chrome.runtime.lastError;
        if (err) reject(err); else resolve();
      });
    });
  }

  async function getSettings() {
    const result = await storageGet(KEYS.SETTINGS);
    return Object.assign({}, globalThis.STT.DEFAULT_SETTINGS, result[KEYS.SETTINGS] || {});
  }

  async function saveSettings(patch) {
    const current = await getSettings();
    const next = Object.assign({}, current, patch);
    await storageSet({ [KEYS.SETTINGS]: next });
    return next;
  }

  async function getHistory() {
    const result = await storageGet(KEYS.HISTORY);
    return Array.isArray(result[KEYS.HISTORY]) ? result[KEYS.HISTORY] : [];
  }

  async function addHistoryItem(item) {
    const history = await getHistory();
    history.unshift(item);
    if (history.length > globalThis.STT.MAX_HISTORY_ITEMS) {
      history.length = globalThis.STT.MAX_HISTORY_ITEMS;
    }
    await storageSet({ [KEYS.HISTORY]: history });
    return item;
  }

  async function deleteHistoryItem(id) {
    const history = await getHistory();
    await storageSet({ [KEYS.HISTORY]: history.filter((h) => h.id !== id) });
  }

  async function clearHistory() {
    await storageSet({ [KEYS.HISTORY]: [] });
  }

  async function getCache() {
    const result = await storageGet(KEYS.CACHE);
    return result[KEYS.CACHE] && typeof result[KEYS.CACHE] === 'object' ? result[KEYS.CACHE] : {};
  }

  async function getCached(key) {
    const cache = await getCache();
    return cache[key] || null;
  }

  async function setCached(key, value) {
    const cache = await getCache();
    cache[key] = value;
    const keys = Object.keys(cache);
    if (keys.length > globalThis.STT.MAX_CACHE_ITEMS) {
      // Evict oldest by timestamp
      keys
        .sort((a, b) => (cache[a].ts || 0) - (cache[b].ts || 0))
        .slice(0, keys.length - globalThis.STT.MAX_CACHE_ITEMS)
        .forEach((k) => delete cache[k]);
    }
    await storageSet({ [KEYS.CACHE]: cache });
  }

  globalThis.STT = Object.assign(globalThis.STT || {}, {
    Storage: {
      KEYS,
      getSettings,
      saveSettings,
      getHistory,
      addHistoryItem,
      deleteHistoryItem,
      clearHistory,
      getCached,
      setCached
    }
  });
})();
