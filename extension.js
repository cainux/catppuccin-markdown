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

module.exports = {
  activate() {
    return {
      extendMarkdownIt(md) {
        return md.use(taskLists);
      },
    };
  },
};
