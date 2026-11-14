// spec-lab3 T3: класифікація вижилих мутантів зі звіту Stryker.
// Запуск: node scripts/classify-mutants.mjs reports/mutation/mutation.json > docs/evidence/13-survivors-classified.md
// Правила — явні й перевірювані; усе, що не підпадає під правило, — «реальна прогалина».
import { readFileSync } from 'node:fs';

const report = JSON.parse(
  readFileSync(process.argv[2] ?? 'reports/mutation/mutation.json', 'utf8'),
);

/** @type {{ when: (m: any, line: string, file: string) => boolean, kind: string, why: string }[]} */
const RULES = [
  {
    kind: 'прийнятний',
    why: 'текст логу: формат запису не є контрактом (контракт AC10 — наявність requestId/userId, його перевіряє mixin)',
    when: (_m, line) => /logger\.(info|warn|error|debug)\(/.test(line),
  },
  {
    kind: 'прийнятний',
    why: 'текст повідомлення помилки: контракт API — поле `error` (код) і статус, `message` — для людини',
    when: (m, line) =>
      m.mutatorName === 'StringLiteral' && /(DomainError\(|message:|throw new Error\()/.test(line),
  },
  {
    kind: 'прийнятний',
    why: 'in-memory репозиторій прототипу (DATA_SOURCE=static) і тест-дабл; продакшн-шлях — *.pg.repository.ts, вбитий інтеграційними тестами',
    when: (_m, _line, file) =>
      /modules\/\w+\/\w+\.repository\.ts$/.test(file) && !file.includes('.pg.'),
  },
  {
    kind: 'еквівалентний',
    why: 'POINTS.loss = 0: `+= 0` і `-= 0` дають однаковий результат',
    when: (_m, line) => line.includes('POINTS.loss'),
  },
  {
    kind: 'еквівалентний',
    why: 'ранній вихід для порожнього списку — оптимізація: `unnest`/`ANY` від порожнього масиву дає той самий результат',
    when: (m, line) =>
      m.mutatorName === 'ConditionalExpression' && /length === 0\) return/.test(line),
  },
  {
    kind: 'еквівалентний',
    why: '`count(*)` завжди повертає рівно один рядок — `row?.` і `?? 0` недосяжні',
    when: (_m, line) => line.includes('row?.n ?? 0'),
  },
  {
    kind: 'еквівалентний',
    why: 'обробник викликається лише всередині HTTP-запиту, де контекст завжди є (contextMiddleware — перший)',
    when: (m, line) => m.mutatorName === 'OptionalChaining' && line.includes('currentContext()?.'),
  },
  {
    kind: 'прийнятний',
    why: 'шлях маршруту `/` у вкладеному роутері: порожній рядок express трактує так само (монтування через app.use)',
    when: (m, line) => m.mutatorName === 'StringLiteral' && /router\.(get|post)\('\/'/.test(line),
  },
  // ---- правила, перевірені вручну (мутант застосовано до коду й прогнано npm test) ----
  {
    kind: 'прийнятний',
    why: 'хибне виживання (обмеження інструмента): статичний мутант zod-схеми, яка будується під час імпорту модуля; vitest-runner не перезавантажує модуль, тож мутант не активується. Застосований вручну — вбивається тестами меж валідації',
    when: (m, _line, file) => m.static === true && /\.routes\.ts$/.test(file),
  },
  {
    kind: 'еквівалентний',
    why: "getTeamsByIds кидає NOT_FOUND, якщо бракує бодай однієї команди, тож `names.get(...)` завжди знаходить значення і `?? ''` недосяжне",
    when: (_m, line) => /names\.get\(m\.\w+\) \?\? ''/.test(line),
  },
  {
    kind: 'еквівалентний',
    why: 'CHECK у БД: status = finished ⇔ обидва рахунки NOT NULL, тож комбінацію «не finished, але з рахунком» не створити',
    when: (_m, line) => line.includes("m.status === 'finished' && m.homeGoals !== null"),
  },
  {
    kind: 'еквівалентний',
    why: 'BYE лише у фіксованому слоті 0 (це завжди `a`), а `b` за індексом у межах масиву — перевірка `b === undefined` існує лише для noUncheckedIndexedAccess',
    when: (_m, line) => line.includes('b === undefined) continue'),
  },
  {
    kind: 'еквівалентний',
    why: 'симетрія: інверсія чергування фіксованого слота (вдома в непарних турах замість парних) дає дзеркальний розклад із тим самим балансом S2',
    when: (m, line) =>
      line.includes('const aIsHome') && /round % 2 !== 0/.test(String(m.replacement)),
  },
  {
    kind: 'прийнятний',
    why: 'гілка гонки: матч завершили між findById і finishIfScheduled; повторне читання потрібне лише при паралельних запитах (PGlite їх серіалізує — не відтворюється)',
    when: (_m, line) => line.includes('(await repo.findById(matchId)) ?? match'),
  },
  {
    kind: 'прийнятний',
    why: 'інші помилки INSERT гравця (FK) недосяжні: сервіс перевіряє існування команди до вставки; трактувати їх як CONFLICT — некритично',
    when: (_m, line) => line.includes('if (isUniqueViolation(err))'),
  },
];

const rows = [];
const counts = {};
for (const [file, f] of Object.entries(report.files)) {
  const lines = f.source.split('\n');
  for (const m of f.mutants) {
    if (m.status !== 'Survived' && m.status !== 'NoCoverage') continue;
    const line = (lines[m.location.start.line - 1] ?? '').trim();
    const short = file.replace(/.*src\//, '');
    const rule = RULES.find((r) => r.when(m, line, short));
    const kind = rule?.kind ?? 'реальна прогалина';
    counts[kind] = (counts[kind] ?? 0) + 1;
    rows.push({
      short,
      line: m.location.start.line,
      status: m.status,
      mutator: m.mutatorName,
      code: line,
      replacement: String(m.replacement),
      kind,
      why: rule?.why ?? '',
    });
  }
}

const esc = (s) => s.replace(/\|/g, '\\|').replace(/`/g, "'").replace(/\s+/g, ' ');
console.info(
  '# Класифікація вижилих мутантів (автоматично за правилами scripts/classify-mutants.mjs)\n',
);
console.info('| Категорія | Кількість |\n| --- | --- |');
for (const [k, v] of Object.entries(counts)) console.info(`| ${k} | ${String(v)} |`);
console.info(
  '\n| Файл:рядок | Статус | Мутатор | Код → мутант | Категорія | Чому |\n| --- | --- | --- | --- | --- | --- |',
);
for (const r of rows) {
  console.info(
    `| \`${r.short}:${String(r.line)}\` | ${r.status} | ${r.mutator} | \`${esc(r.code).slice(0, 55)}\` → \`${esc(r.replacement).slice(0, 35)}\` | **${r.kind}** | ${r.why} |`,
  );
}
