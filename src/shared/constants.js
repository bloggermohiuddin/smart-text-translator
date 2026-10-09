/* Smart Text Translator — shared constants
 * Exposed on globalThis.STT so the same file works in the content script,
 * the service worker (via importScripts) and extension pages (via <script>).
 */
(function () {
  'use strict';

  const API_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

  const LANGUAGES = [
    { code: 'bn', name: 'Bengali' },
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'Hindi' },
    { code: 'ar', name: 'Arabic' },
    { code: 'ur', name: 'Urdu' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'zh-CN', name: 'Chinese (Simplified)' },
    { code: 'zh-TW', name: 'Chinese (Traditional)' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'ru', name: 'Russian' }
  ];

  const DEFAULT_SETTINGS = {
    // General
    enabled: true,
    translateOnSelection: true,
    // Translation
    mode: 'instant',            // 'instant' | 'ask'
    targetLang: 'bn',           // or 'auto' (browser language)
    sourceLang: 'auto',         // 'auto' or a language code
    // Behaviour
    maxChars: 1500,
    minChars: 2,
    popupPosition: 'auto',      // 'auto' | 'above' | 'below'
    autoCloseDelay: 0,          // seconds; 0 = never auto-close
    showOriginal: true,
    showDetectedLang: true,
    showCopyButton: true,
    showAudioButton: true,
    pinPopup: false,
    // Appearance
    theme: 'system',            // 'system' | 'light' | 'dark'
    // History
    historyEnabled: true,
    // Fallbacks
    contextMenuEnabled: true
  };

  const MAX_HISTORY_ITEMS = 300;
  const MAX_CACHE_ITEMS = 150;
  const API_HARD_LIMIT = 5000;

  // Stable message types used between content script <-> service worker
  const MSG = {
    TRANSLATE: 'STT_TRANSLATE',
    TRANSLATE_NOW: 'STT_TRANSLATE_NOW',       // context menu / shortcut -> content
    OPEN_OPTIONS: 'STT_OPEN_OPTIONS',         // content popup -> open settings page
    GET_STATE: 'STT_GET_STATE'
  };

  // Machine-readable error codes -> human readable defaults
  const ERRORS = {
    NETWORK: 'Network error. Check your internet connection and try again.',
    TOO_LONG: 'Selected text is too long.',
    EMPTY: 'The translation service returned an empty result.',
    API_ERROR: 'Translation failed due to an API error.',
    UNKNOWN: 'Translation failed. Please try again.'
  };

  globalThis.STT = Object.assign(globalThis.STT || {}, {
    API_ENDPOINT,
    LANGUAGES,
    DEFAULT_SETTINGS,
    MAX_HISTORY_ITEMS,
    MAX_CACHE_ITEMS,
    API_HARD_LIMIT,
    MSG,
    ERRORS
  });
})();
