/* Smart Text Translator — history page logic */
(function () {
  'use strict';

  const { Storage, Utils } = globalThis.STT;

  const list = document.getElementById('list');
  const emptyState = document.getElementById('emptyState');
  const countLine = document.getElementById('countLine');
  const searchInput = document.getElementById('search');

  let history = [];
  let query = '';

  function fmtTime(ts) {
    try {
      return new Date(ts).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch (e) {
      return new Date(ts).toLocaleString();
    }
  }

  function truncate(text, n) {
    return text.length > n ? `${text.slice(0, n)}…` : text;
  }

  function filtered() {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (h) =>
        h.original.toLowerCase().includes(q) || h.translated.toLowerCase().includes(q)
    );
  }

  function render() {
    const items = filtered();
    list.textContent = '';
    emptyState.hidden = items.length > 0;

    countLine.textContent =
      history.length === 0
        ? 'Nothing stored yet'
        : `${items.length} of ${history.length} translation${history.length === 1 ? '' : 's'}`;

    for (const item of items) {
      const card = document.createElement('article');
      card.className = 'item';

      const meta = document.createElement('div');
      meta.className = 'item-meta';
      const badge = document.createElement('span');
      badge.className = 'lang-badge';
      badge.textContent = `${Utils.languageName(item.sourceLang)} → ${Utils.languageName(item.targetLang)}`;
      const time = document.createElement('time');
      time.textContent = fmtTime(item.ts);
      meta.appendChild(badge);
      meta.appendChild(time);

      const original = document.createElement('div');
      original.className = 'item-original';
      original.textContent = truncate(item.original, 240);

      const translation = document.createElement('div');
      translation.className = 'item-translation';
      translation.textContent = item.translated;

      const actions = document.createElement('div');
      actions.className = 'item-actions';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn ghost';
      copyBtn.textContent = 'Copy translation';
      copyBtn.addEventListener('click', async () => {
        const ok = await Utils.copyToClipboard(item.translated);
        if (ok) {
          copyBtn.textContent = 'Copied ✓';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = 'Copy translation';
            copyBtn.classList.remove('copied');
          }, 1300);
        }
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn danger-ghost';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', async () => {
        await Storage.deleteHistoryItem(item.id);
        await reload();
      });

      actions.appendChild(copyBtn);
      actions.appendChild(deleteBtn);

      card.appendChild(meta);
      card.appendChild(original);
      card.appendChild(translation);
      card.appendChild(actions);
      list.appendChild(card);
    }
  }

  async function reload() {
    history = await Storage.getHistory();
    render();
  }

  searchInput.addEventListener('input', () => {
    query = searchInput.value;
    render();
  });

  document.getElementById('clearAll').addEventListener('click', async () => {
    if (history.length === 0) return;
    if (confirm(`Delete all ${history.length} history items? This cannot be undone.`)) {
      await Storage.clearHistory();
      await reload();
    }
  });

  document.getElementById('openSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Live-update if translations happen while this page is open
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[Storage.KEYS.HISTORY]) reload();
  });

  reload();
})();
