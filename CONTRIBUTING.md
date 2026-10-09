# Contributing

Thanks for helping improve Smart Text Translator. Small, focused fixes and clear bug reports are welcome.

## Before you start

- Check existing issues and pull requests to avoid duplicating work.
- For a significant feature or behavior change, open an issue first to discuss the approach.
- Do not include API keys, private webpage content, personal information, or other secrets in issues, screenshots, logs, or pull requests.

## Development

This is a dependency-free Manifest V3 extension written in plain JavaScript, HTML, and CSS. There is currently no build step, package manager, or automated test suite.

1. Fork the repository and create a branch for your change.
2. Make the smallest focused change that solves the issue.
3. Keep the existing extension architecture and avoid adding dependencies unless they are necessary and their impact is explained.
4. Load the repository as an unpacked extension in Chrome or Edge and manually test the affected workflow.

For JavaScript changes, run syntax checks for the files you touched, for example:

```powershell
node --check src/shared/translator.js
node --check src/background/service-worker.js
```

For manifest changes, confirm `manifest.json` is valid JSON. Also verify the relevant extension behavior in the browser; syntax checks alone do not exercise Chrome extension APIs.

## Pull requests

- Explain the problem and the behavior changed.
- Include steps to reproduce and verify the change.
- Mention relevant browser versions and any known limitations.
- Include screenshots only when they help explain a user-interface change, and redact private information.
- Keep unrelated formatting or refactoring out of the pull request.

## Security and translation provider

Do not use `innerHTML` to render selected or translated text. Preserve the rule that translation traffic is initiated by the background service worker, and request only the selected text needed for the translation.

The extension currently uses Google's undocumented `gtx` endpoint, not the official Cloud Translation API. Changes to the request or response handling should be tested against the endpoint's nested response format and should not imply guaranteed availability or support.