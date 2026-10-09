/* Smart Text Translator — toolbar popup logic */
(function () {
  'use strict';

  const { Storage, Utils, LANGUAGES } = globalThis.STT;

  const enabledToggle = document.getElementById('enabledToggle');
  const selectionToggle = document.getElementById('selectionToggle');
  const modeSelect = document.getElementById('modeSelect');
  const targetSelect = document.getElementById('targetSelect');
  const statusLine = document.getElementById('statusLine');

  function populateLanguages() {
    targetSelect.textContent = '';
    const auto = document.createElement('option');
    auto.value = 'auto';
    auto.textContent = 'Auto (browser language)';
    targetSelect.appendChild(auto);
    for (const lang of LANGUAGES) {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.name;
      targetSelect.appendChild(opt);
    }
  }

  function updateStatus(settings) {
    if (!settings.enabled) {
      statusLine.textContent = 'Paused';
      statusLine.className = 'status';
    } else {
      const target = settings.targetLang === 'auto'
        ? `Auto (${Utils.languageName(Utils.resolveTargetLang('auto'))})`
        : Utils.languageName(settings.targetLang);
      statusLine.textContent = `Ready · translating into ${target}`;
      statusLine.className = 'status ok';
    }
  }

  async function init() {
    populateLanguages();
    const settings = await Storage.getSettings();
    enabledToggle.checked = settings.enabled;
    selectionToggle.checked = settings.translateOnSelection;
    modeSelect.value = settings.mode;
    targetSelect.value = settings.targetLang;
    updateStatus(settings);
  }

  enabledToggle.addEventListener('change', () =>
    Storage.saveSettings({ enabled: enabledToggle.checked }).then(updateStatus)
  );
  selectionToggle.addEventListener('change', () =>
    Storage.saveSettings({ translateOnSelection: selectionToggle.checked })
  );
  modeSelect.addEventListener('change', () =>
    Storage.saveSettings({ mode: modeSelect.value })
  );
  targetSelect.addEventListener('change', () =>
    Storage.saveSettings({ targetLang: targetSelect.value }).then(updateStatus)
  );

  document.getElementById('openSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  document.getElementById('openHistory').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/history/history.html') });
    window.close();
  });

  init();
})();
