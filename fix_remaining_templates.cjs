const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace any template literal in className, title, aria-label, etc., or general template literals that cause esbuild errors.
// Specifically, let's find all backtick strings containing ${...}
// A general regex to find backtick strings with ${} and convert them to string concatenations or clean strings.

// Let's inspect line 8884 and surroundings first or handle backtick templates generally.
// Let's write a robust parser/replacer or specific replacements for any remaining backtick issues.

console.log('Scanning for backticks...');
let matches = content.match(/`[^`]*\$\{[^}]+\}[^`]*`/g);
if (matches) {
  console.log(`Found ${matches.length} template literals with \${}`);
  matches.forEach((m, idx) => {
    console.log(`[${idx}] ${m}`);
  });
}

// Let's replace template literals in className or anywhere else.
// For example: `absolute top-full left-8 -mt-1 w-2.5 h-2.5 bg-zinc-900 border-r border-b ${isDatabaseMutatingState ? 'border-amber-400/90' : 'border-amber-500/60'} rotate-45`
content = content.replace(
  /`absolute top-full left-8 -mt-1 w-2\.5 h-2\.5 bg-zinc-900 border-r border-b \$\{([^}]+)\} rotate-45`/g,
  "'absolute top-full left-8 -mt-1 w-2.5 h-2.5 bg-zinc-900 border-r border-b ' + ($1) + ' rotate-45'"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed tooltip caret template successfully');
