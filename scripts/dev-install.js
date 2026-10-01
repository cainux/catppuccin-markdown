// Symlinks this repo into the VS Code extensions directory and registers it in
// extensions.json, which VS Code requires before it will load the extension.
// Quit VS Code first: it rewrites extensions.json on exit and would drop the entry.
const fs = require('fs');
const os = require('os');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const { name, publisher, version } = require(path.join(repo, 'package.json'));
const id = `${publisher}.${name}`;
const dirName = `${id}-${version}`;
const extDir = process.env.VSCODE_EXTENSIONS || path.join(os.homedir(), '.vscode', 'extensions');
const link = path.join(extDir, dirName);
const registry = path.join(extDir, 'extensions.json');

fs.mkdirSync(extDir, { recursive: true });

// Remove symlinks left over from previous versions.
for (const entry of fs.readdirSync(extDir)) {
  const p = path.join(extDir, entry);
  if (entry.startsWith(`${id}-`) && entry !== dirName && fs.lstatSync(p).isSymbolicLink()) {
    fs.unlinkSync(p);
    console.log(`removed ${p}`);
  }
}

if (!fs.existsSync(link)) {
  fs.symlinkSync(repo, link, 'dir');
  console.log(`linked ${link} -> ${repo}`);
} else if (!fs.lstatSync(link).isSymbolicLink()) {
  console.error(`${link} exists and is not a symlink (an installed .vsix?); uninstall it first`);
  process.exit(1);
}

const entries = fs.existsSync(registry) ? JSON.parse(fs.readFileSync(registry, 'utf8')) : [];
fs.writeFileSync(registry, JSON.stringify([
  ...entries.filter((e) => e.identifier.id !== id),
  {
    identifier: { id },
    version,
    location: { $mid: 1, path: link, scheme: 'file' },
    relativeLocation: dirName,
  },
]));
console.log(`registered ${id} ${version} in ${registry}`);
