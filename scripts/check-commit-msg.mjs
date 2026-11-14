// DoD A7: перевірка формату Conventional Commits без зовнішніх залежностей.
import { readFileSync } from 'node:fs';

const TYPES = ['feat', 'fix', 'refactor', 'docs', 'test', 'build', 'ci', 'chore', 'perf', 'style'];
const PATTERN = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9-]+\\))?!?: \\S.{0,99}$`);

const file = process.argv[2];
if (!file) {
  console.error('usage: check-commit-msg.mjs <commit-msg-file>');
  process.exit(2);
}

const header = readFileSync(file, 'utf8').split(/\r?\n/)[0] ?? '';

if (header.startsWith('Merge ') || PATTERN.test(header)) {
  process.exit(0);
}

console.error(`✖ Commit message does not follow Conventional Commits:\n  "${header}"`);
console.error(`  Expected: <type>(<scope>)?: <description>, type ∈ {${TYPES.join(', ')}}`);
console.error('  See standards/commits-and-branches.md');
process.exit(1);
