"use strict";

// Minimal GFM task-list plugin for markdown-it, since this VSCode build's
// bundled markdown-language-features extension doesn't include one.
function taskLists(md) {
  const taskRe = /^\[([ xX])\]\s+(.*)$/;

  md.core.ruler.after("inline", "task-lists", (state) => {
    const tokens = state.tokens;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type !== "list_item_open") continue;

      // find the inline token belonging to this list item (first paragraph_open/inline pair)
      let j = i + 1;
      while (j < tokens.length && tokens[j].type !== "inline") {
        if (tokens[j].type === "list_item_close") break;
        j++;
      }
      if (j >= tokens.length || tokens[j].type !== "inline") continue;

      const inline = tokens[j];
      const firstChild = inline.children && inline.children[0];
      if (!firstChild || firstChild.type !== "text") continue;

      const match = taskRe.exec(firstChild.content);
      if (!match) continue;

      const checked = match[1].toLowerCase() === "x";
      const rest = match[2];

      // strip the "[ ] "/"[x] " prefix from the text token
      firstChild.content = rest;

      // build checkbox token
      const checkbox = new state.Token("html_inline", "", 0);
      checkbox.content = `<input type="checkbox" disabled${checked ? " checked" : ""}> `;
      inline.children.unshift(checkbox);

      // mark list item + containing list as task-list for styling
      token.attrJoin("class", "task-list-item" + (checked ? " task-list-item-checked" : ""));

      // find the enclosing bullet_list_open/ordered_list_open and mark it too
      for (let k = i - 1; k >= 0; k--) {
        if (tokens[k].type === "bullet_list_open" || tokens[k].type === "ordered_list_open") {
          tokens[k].attrJoin("class", "contains-task-list");
          break;
        }
        if (tokens[k].type === "bullet_list_close" || tokens[k].type === "ordered_list_close") {
          break;
        }
      }
    }
  });
}

// OpenSpec spec.md only: collapse each "Scenario:" heading and its body into a closed <details>.
// Done at render time because tokenizing runs without env.currentDocument; only render() knows the file.
function specScenarios(md) {
  const isSpecFile = (env) => {
    const doc = env && env.currentDocument;
    const path = doc && (typeof doc === "string" ? doc : doc.path || doc.fsPath);
    return typeof path === "string" && /(^|[\\/])spec\.md$/i.test(path);
  };

  const collapse = (tokens) => {
    const Token = tokens[0].constructor;
    const html = (content) => {
      const t = new Token("html_block", "", 0);
      t.content = content;
      return t;
    };
    const out = [];
    let openLevel = 0;

    const close = () => {
      if (openLevel) out.push(html("</details>\n"));
      openLevel = 0;
    };

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type !== "heading_open") {
        out.push(token);
        continue;
      }

      const level = Number(token.tag.slice(1));
      if (openLevel && level <= openLevel) close();

      if (/^Scenario:/i.test(tokens[i + 1].content)) {
        out.push(html('<details class="spec-scenario">\n<summary>'));
        out.push(token, tokens[i + 1], tokens[i + 2]);
        out.push(html("</summary>\n"));
        openLevel = level;
        i += 2;
      } else {
        out.push(token);
      }
    }
    close();
    return out;
  };

  const render = md.renderer.render.bind(md.renderer);
  md.renderer.render = (tokens, options, env) =>
    render(isSpecFile(env) && tokens.length ? collapse(tokens) : tokens, options, env);
}

module.exports = {
  activate() {
    return {
      extendMarkdownIt(md) {
        return md.use(taskLists).use(specScenarios);
      },
    };
  },
};
