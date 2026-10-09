/* Smart Text Translator — options page logic */
(function () {
  'use strict';

  const { Storage, Utils, LANGUAGES, DEFAULT_SETTINGS } = globalThis.STT;

  const $ = (id) => document.getElementById(id);

  const fields = {
    enabled: $('enabled'),
    translateOnSelection: $('translateOnSelection'),
    contextMenuEnabled: $('contextMenuEnabled'),
    targetLang: $('targetLang'),
    sourceLang: $('sourceLang'),
    maxChars: $('maxChars'),
    minChars: $('minChars'),
    theme: $('theme'),
    popupPosition: $('popupPosition'),
    autoCloseDelay: $('autoCloseDelay'),
    historyEnabled: $('historyEnabled'),
    showOriginal: $('showOriginal'),
    showDetectedLang: $('showDetectedLang'),
    showCopyButton: $('showCopyButton'),
    showAudioButton: $('showAudioButton'),
    pinPopup: $('pinPopup')
  };

  const toast = $('toast');

  let toastTimer = null;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  /* ---------- language dropdowns ---------- */
  function populateLanguages() {
    fields.targetLang.textContent = '';
    const autoTarget = document.createElement('option');
    autoTarget.value = 'auto';
    autoTarget.textContent = 'Auto (browser language)';
    fields.targetLang.appendChild(autoTarget);

    fields.sourceLang.textContent = '';
    const autoSource = document.createElement('option');
    autoSource.value = 'auto';
    autoSource.textContent = 'Auto detect';
    fields.sourceLang.appendChild(autoSource);

    for (const lang of LANGUAGES) {
      for (const select of [fields.targetLang, fields.sourceLang]) {
        const opt = document.createElement('option');
        opt.value = lang.code;
        opt.textContent = lang.name;
        select.appendChild(opt);
      }
    }
  }

  /* ---------- load / save ---------- */
  async function loadSettings() {
    const s = await Storage.getSettings();

    fields.enabled.checked = s.enabled;
    fields.translateOnSelection.checked = s.translateOnSelection;
    fields.contextMenuEnabled.checked = s.contextMenuEnabled;
    fields.targetLang.value = s.targetLang;
    fields.sourceLang.value = s.sourceLang;
    fields.maxChars.value = s.maxChars;
    fields.minChars.value = s.minChars;
    fields.theme.value = s.theme;
    fields.popupPosition.value = s.popupPosition;
    fields.autoCloseDelay.value = s.autoCloseDelay;
    fields.historyEnabled.checked = s.historyEnabled;
    fields.showOriginal.checked = s.showOriginal;
    fields.showDetectedLang.checked = s.showDetectedLang;
    fields.showCopyButton.checked = s.showCopyButton;
    fields.showAudioButton.checked = s.showAudioButton;
    fields.pinPopup.checked = s.pinPopup;

    const modeRadio = document.querySelector(`input[name="mode"][value="${s.mode}"]`) ||
      document.querySelector('input[name="mode"][value="instant"]');
    if (modeRadio) modeRadio.checked = true;
  }

  async function save(patch, silent) {
    await Storage.saveSettings(patch);
    if (!silent) showToast('Settings saved');
  }

  /* ---------- wiring ---------- */
  function wire() {
    const boolKeys = [
      'enabled', 'translateOnSelection', 'contextMenuEnabled', 'historyEnabled',
      'showOriginal', 'showDetectedLang', 'showCopyButton', 'showAudioButton', 'pinPopup'
    ];
    for (const key of boolKeys) {
      fields[key].addEventListener('change', () => save({ [key]: fields[key].checked }));
    }

    fields.targetLang.addEventListener('change', () => save({ targetLang: fields.targetLang.value }));
    fields.sourceLang.addEventListener('change', () => save({ sourceLang: fields.sourceLang.value }));
    fields.theme.addEventListener('change', () => save({ theme: fields.theme.value }));
    fields.popupPosition.addEventListener('change', () =>
      save({ popupPosition: fields.popupPosition.value })
    );

    fields.maxChars.addEventListener('change', () => {
      const v = Math.min(5000, Math.max(50, Number(fields.maxChars.value) || DEFAULT_SETTINGS.maxChars));
      fields.maxChars.value = v;
      save({ maxChars: v });
    });

    fields.minChars.addEventListener('change', () => {
      const v = Math.min(20, Math.max(1, Number(fields.minChars.value) || DEFAULT_SETTINGS.minChars));
      fields.minChars.value = v;
      save({ minChars: v });
    });

    fields.autoCloseDelay.addEventListener('change', () => {
      const v = Math.min(60, Math.max(0, Number(fields.autoCloseDelay.value) || 0));
      fields.autoCloseDelay.value = v;
      save({ autoCloseDelay: v });
    });

    document.querySelectorAll('input[name="mode"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio.checked) save({ mode: radio.value });
      });
    });
  }

  /* ---------- misc actions ---------- */
  $('openHistory').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/history/history.html') });
  });

  $('openShortcuts').addEventListener('click', () => {
    // Cannot be opened programmatically; guide the user instead.
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }).catch(() => {
      showToast('Open chrome://extensions/shortcuts manually');
    });
  });

  $('resetSettings').addEventListener('click', async () => {
    await save(Object.assign({}, DEFAULT_SETTINGS), true);
    await loadSettings();
    showToast('Defaults restored');
  });

  /* ---------- sidebar scroll-spy ---------- */
  function wireNav() {
    const links = Array.from(document.querySelectorAll('.nav-link'));
    links.forEach((link) => {
      link.addEventListener('click', () => {
        links.forEach((l) => l.classList.remove('active'));
        link.classList.add('active');
      });
    });

    const sections = links
      .map((l) => document.querySelector(l.getAttribute('href')))
      .filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((l) =>
            l.classList.toggle('active', l.getAttribute('href') === `#${entry.target.id}`)
          );
        });
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    sections.forEach((s) => observer.observe(s));
  }

  populateLanguages();
  wire();
  wireNav();
  loadSettings();
})();
