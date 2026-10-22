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

// OpenSpec spec.md only: collapse each "Scenario:" heading and its body into a closed <details>,
// tag SHALL / SHALL NOT, GIVEN/WHEN/THEN steps, ## sections and Requirement headings for styling,
// then drop the redundant "Requirement:" / "Scenario:" heading prefixes.
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
    let inScenarios = false;

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
        if (!inScenarios) out.push(html('<p class="spec-scenarios">Scenarios</p>\n'));
        inScenarios = true;
        out.push(html('<details class="spec-scenario">\n<summary>'));
        out.push(token, tokens[i + 1], tokens[i + 2]);
        out.push(html("</summary>\n"));
        openLevel = level;
        i += 2;
      } else {
        inScenarios = false;
        out.push(token);
      }
    }
    close();
    return out;
  };

  const shallRe = /\b(SHALL NOT|SHALL)\b/;

  // Clones inline tokens rather than mutating them: the token array is cached by VS Code.
  const tagShall = (tokens) =>
    tokens.map((token) => {
      if (token.type !== "inline" || !token.children) return token;

      const children = [];
      for (const child of token.children) {
        if (child.type !== "text" || !shallRe.test(child.content)) {
          children.push(child);
          continue;
        }
        child.content.split(new RegExp(shallRe.source, "g")).forEach((part, idx) => {
          if (!part) return;
          const t = new child.constructor(idx % 2 ? "html_inline" : "text", "", 0);
          if (idx % 2) {
            const cls = part === "SHALL NOT" ? "spec-shall-not" : "spec-shall";
            t.content = `<span class="${cls}">${part}</span>`;
          } else {
            t.content = part;
          }
          children.push(t);
        });
      }
      return Object.assign(Object.create(Object.getPrototypeOf(token)), token, { children });
    });

  const stepRe = /^(GIVEN|WHEN|THEN|AND|BUT)$/;

  const tagSteps = (tokens) =>
    tokens.map((token) => {
      if (token.type !== "inline" || !token.children) return token;

      const children = token.children.map((child, i) => {
        const next = token.children[i + 1];
        if (child.type !== "strong_open" || !next || !stepRe.test(next.content)) return child;

        const clone = Object.assign(Object.create(Object.getPrototypeOf(child)), child);
        clone.attrs = child.attrs ? child.attrs.map((a) => a.slice()) : null;
        clone.attrJoin("class", `spec-step spec-${next.content.toLowerCase()}`);
        return clone;
      });
      return Object.assign(Object.create(Object.getPrototypeOf(token)), token, { children });
    });

  const headingClass = (token, next) => {
    if (token.tag === "h2") return "spec-section";
    if (/^Requirement:/i.test(next.content)) return "spec-requirement";
    return null;
  };

  const tagHeadings = (tokens) =>
    tokens.map((token, i) => {
      const cls = token.type === "heading_open" && headingClass(token, tokens[i + 1]);
      if (!cls) return token;

      const clone = Object.assign(Object.create(Object.getPrototypeOf(token)), token);
      clone.attrs = token.attrs ? token.attrs.map((a) => a.slice()) : null;
      clone.attrJoin("class", cls);
      return clone;
    });

  const prefixRe = /^(Requirement|Scenario):\s*/i;

  // Runs after the heading tags and collapse, which match on these prefixes.
  const stripPrefixes = (tokens) =>
    tokens.map((token, i) => {
      const prev = tokens[i - 1];
      if (token.type !== "inline" || !prev || prev.type !== "heading_open" || !prefixRe.test(token.content)) {
        return token;
      }

      const children = token.children.slice();
      const first = children[0];
      if (first && first.type === "text") {
        children[0] = Object.assign(Object.create(Object.getPrototypeOf(first)), first, {
          content: first.content.replace(prefixRe, ""),
        });
      }
      return Object.assign(Object.create(Object.getPrototypeOf(token)), token, {
        content: token.content.replace(prefixRe, ""),
        children,
      });
    });

  const render = md.renderer.render.bind(md.renderer);
  md.renderer.render = (tokens, options, env) =>
    render(
      isSpecFile(env) && tokens.length ? stripPrefixes(collapse(tagHeadings(tagSteps(tagShall(tokens))))) : tokens,
      options,
      env,
    );
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
