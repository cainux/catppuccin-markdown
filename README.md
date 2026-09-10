# Catppuccin Markdown Preview

A small personal VS Code extension that restyles the **built-in Markdown preview**
with the [Catppuccin Mocha](https://github.com/catppuccin/catppuccin) palette, and
adds GFM-style task-list checkboxes.

## What it does

- **`styles/catppuccin-mocha.css`** — contributed via `markdown.previewStyles`, themes
  the preview pane (headings, code blocks, tables, blockquotes, links) to Catppuccin Mocha,
  including styled task-list checkboxes.
- **`configurationDefaults`** — contributes a default value for
  `workbench.editorAssociations` mapping `*.md` to `vscode.markdown.preview.editor`, so
  Markdown files open directly in the preview instead of the text editor. This is a
  *default*, so an explicit `workbench.editorAssociations` entry in your own `settings.json`
  still wins — remove it from user settings to let the extension supply the behavior.
  To edit a Markdown file, use **Open With…** (`Ctrl+Shift+P` → *View: Reopen Editor With*)
  and pick the text editor.
- **`extension.js`** — a minimal [markdown-it](https://github.com/markdown-it/markdown-it)
  plugin that turns `[ ]` / `[x]` at the start of a list item into a real disabled
  `<input type="checkbox">`, and tags the item with `task-list-item` /
  `task-list-item-checked` (and the parent list with `contains-task-list`) so the CSS can
  target it. This exists because the bundled `markdown-language-features` extension in this
  VS Code build doesn't ship a task-list plugin.

## Install

The extension is unpacked — VS Code loads it straight from the extensions directory.
This repo is symlinked into place:

```sh
ln -s ~/code/catppuccin-markdown ~/.vscode/extensions/local.catppuccin-markdown-1.1.0
```

Reload the VS Code window (`Developer: Reload Window`) after changing any of these files.
The directory name encodes the version, so bump the symlink name to match `package.json`
when the version changes.

## Development

There is no build step and no dependencies — `extension.js` is plain CommonJS and the CSS
is loaded as-is. Edit, reload the window, and open a Markdown preview to see the result.
