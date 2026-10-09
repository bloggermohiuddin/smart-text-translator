# Smart Text Translator

A lightweight Chrome and Microsoft Edge extension that translates selected text into your chosen language. It uses Manifest V3 and plain JavaScript, HTML, and CSS; there is no build step or API key to configure.

> **Translation provider:** translations use Google's undocumented `gtx` endpoint. It is not the official Google Cloud Translation API, is not affiliated with or supported by this project, and may be rate-limited or changed without notice. Do not rely on it for critical or sensitive translations.

## Features

- Translate selected text instantly or after clicking **Translate**.
- Detect the source language automatically or choose one manually.
- Translate into Bengali, English, Hindi, Arabic, Urdu, Spanish, French, German, Portuguese, Simplified Chinese, Traditional Chinese, Japanese, Korean, or Russian.
- Use a floating popup with copy, text-to-speech, retry, pin, and language-swap controls.
- Browse, search, copy, and delete local translation history.
- Translate from the right-click menu or the `Alt+Shift+T` shortcut (configurable in the browser's extension shortcuts page).
- Cache recent translations locally to avoid repeat requests.

## Install

### Chrome

1. Download or clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose the repository folder containing `manifest.json`.

### Microsoft Edge

1. Download or clone this repository.
2. Open `edge://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose the repository folder containing `manifest.json`.

The Settings page opens after the extension is first installed. No account, key, or dependency installation is required. Select text on a regular webpage to translate it; browser-internal pages and some protected pages do not allow extensions to run.

## Settings and usage

Use the toolbar popup to enable or pause the extension, choose instant or ask-before-translating mode, and select a target language. Open **Settings** for source language, popup appearance, history, and other options. The context-menu command is available by right-clicking selected text when enabled.

## Privacy and permissions

When you request a translation, the selected text and language codes are sent to Google's `translate.googleapis.com` endpoint. Google's handling of that request is governed by Google's terms and privacy practices; this extension does not operate a translation server. Avoid sending passwords, personal information, or other sensitive text for translation.

Settings, translation history, and the local translation cache are stored in the browser's extension storage. History can be disabled in Settings or cleared from the History page. The extension does not need an API key.

| Permission | Purpose |
| --- | --- |
| `storage` | Store settings, translation history, and cached results locally. |
| `contextMenus` | Add the optional right-click translation command. |
| `https://translate.googleapis.com/*` | Send translation requests to Google's endpoint. |
| `<all_urls>` content-script match | Detect selected text on webpages so translation can be requested. |

Translation requests are made by the extension's background service worker. The content script is used to detect selections and show the translation popup; it does not send the full page to the translation endpoint.

## Troubleshooting

- **No popup appears:** confirm the extension is enabled and **Translate on selection** is turned on. Browser-internal pages, the Web Store, and some PDF or protected pages block extensions.
- **Translation fails:** check your connection. The `gtx` endpoint may be temporarily unavailable or rate-limit requests.
- **Shortcut does not work:** check or change it on the browser's extensions shortcuts page; another extension may already use that key combination.

## Project layout

```text
manifest.json
icons/
src/
  background/   Translation requests, cache, history, and browser commands
  content/      Text selection detection and floating popup
  history/      Translation history page
  options/      Extension settings
  popup/        Toolbar popup
  shared/       Translation client, storage, constants, and utilities
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development and pull request guidelines.