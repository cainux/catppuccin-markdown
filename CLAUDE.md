# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Personal VS Code extension that restyles the built-in Markdown preview with Catppuccin Mocha and adds GFM task-list checkboxes. No build step, no runtime dependencies, no tests or linter.

## Commands

- `npm run package` - build `catppuccin-markdown-<version>.vsix` via `npx @vscode/vsce` (nothing to install first)
- `npm run dev-install` - symlink the clone into `~/.vscode/extensions/local.catppuccin-markdown-<version>` and register it in `extensions.json`. VS Code must be **fully quit** first (it rewrites `extensions.json` on exit). Re-run after any `package.json` version bump. `VSCODE_EXTENSIONS` overrides the target dir.
- Verify changes: `Developer: Reload Window` in VS Code, then open a Markdown preview. The checked-out branch is what loads.

## Architecture

Three independent pieces, all wired up in `package.json` `contributes`:

- `styles/catppuccin-mocha.css` - via `markdown.previewStyles`. Palette defined as `--ctp-*` custom properties on `:root`; rules reference those vars. Task-list section styles the checkbox with an SVG mask tick so rendering is font-independent.
- `extension.js` - via `markdown.markdownItPlugins: true`. `activate()` returns `extendMarkdownIt`, which registers a markdown-it core rule (after `inline`) that converts a leading `[ ]`/`[x]` in a list item's first text token into a disabled `<input type="checkbox">`. It adds `task-list-item` / `task-list-item-checked` to the `<li>` and `contains-task-list` to the enclosing list - the CSS depends on these class names, so keep them in sync. Exists because this VS Code build's bundled `markdown-language-features` has no task-list plugin.
- `configurationDefaults` - defaults `workbench.editorAssociations` so `*.md` opens in `vscode.markdown.preview.editor`. A user-level setting overrides it.

## Releasing

- Bump `version` in `package.json`, then push a `v<version>` tag. `.github/workflows/release.yml` fails if the tag and `package.json` version disagree, then runs `npm run package` and attaches the `.vsix` to a GitHub release.
- `.vscodeignore` excludes `scripts/**` from the package.

## Gotchas

- Don't install a `.vsix` on a machine using the symlinked dev setup - both use the `local.catppuccin-markdown-<version>` directory and collide (`dev-install` errors if the path exists and isn't a symlink).
- A symlink alone doesn't load the extension; it must also be listed in `extensions.json`.
