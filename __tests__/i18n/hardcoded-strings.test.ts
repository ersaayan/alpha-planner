/**
 * Static scan for user-facing text that bypasses i18n.
 *
 * Key parity between en.json and tr.json says nothing about strings that never reach
 * the locale files, which is how "0 hard-coded strings" was once claimed while whole
 * screens were English. This test parses every screen, component, hook and
 * notification service with the TypeScript compiler and fails on letters in:
 *
 * - JSX text (`<Text>Done</Text>`) and string/template literals rendered as children
 *   (`{isOpen ? 'Open' : 'Closed'}`);
 * - text props: placeholder, title, label, accessibilityLabel, accessibilityHint, …;
 * - the same names as object properties (navigator `options`, notification content);
 * - Alert.alert(...) arguments and button texts;
 * - AccessibilityInfo.announceForAccessibility(...).
 *
 * Strings without letters (symbols, numbers, emoji) are fine. Anything else that is
 * really not user-facing goes in ALLOWED with a reason.
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const ROOT = path.resolve(__dirname, '../..');
const SCANNED_DIRS = ['app', 'components', 'hooks', 'services/notifications'];

/** Props (and object keys) whose string value is shown or read to the user. */
const TEXT_PROPS = new Set([
  'accessibilityHint',
  'accessibilityLabel',
  'aria-label',
  'body',
  'caption',
  'description',
  'emptyText',
  'headerBackTitle',
  'headerTitle',
  'label',
  'message',
  'placeholder',
  'prefix',
  'subtitle',
  'suffix',
  'tabBarAccessibilityLabel',
  'tabBarLabel',
  'text',
  'title',
  'valueLabel',
]);

/** `file: text` pairs that are deliberately not translated. */
const ALLOWED: Record<string, string> = {};

const LETTER = /\p{L}/u;

interface Finding {
  file: string;
  line: number;
  text: string;
  kind: string;
}

function listFiles(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(rel);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [rel] : [];
  });
}

/** The static text of a string or template literal, or null for anything else. */
function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' ');
  }
  return null;
}

/** String literals an expression can evaluate to (through ?:, ||, ?? and parentheses). */
function renderedLiterals(node: ts.Expression): ts.Expression[] {
  if (ts.isParenthesizedExpression(node)) return renderedLiterals(node.expression);
  if (ts.isConditionalExpression(node)) {
    return [...renderedLiterals(node.whenTrue), ...renderedLiterals(node.whenFalse)];
  }
  if (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
  ) {
    const right = renderedLiterals(node.right);
    return node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      ? right
      : [...renderedLiterals(node.left), ...right];
  }
  return literalText(node) === null ? [] : [node];
}

function propertyName(name: ts.PropertyName | ts.JsxAttributeName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isJsxNamespacedName(name)) return `${name.namespace.text}:${name.name.text}`;
  return null;
}

function isCall(node: ts.CallExpression, object: string, method: string): boolean {
  const callee = node.expression;
  return (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    callee.expression.text === object &&
    callee.name.text === method
  );
}

function scanFile(file: string, source = fs.readFileSync(path.join(ROOT, file), 'utf8')): Finding[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: Finding[] = [];

  const report = (node: ts.Node, text: string, kind: string) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!LETTER.test(clean)) return;
    if (`${file}: ${clean}` in ALLOWED) return;
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    findings.push({ file, line: line + 1, text: clean, kind });
  };
  const reportLiterals = (expr: ts.Expression, kind: string) => {
    for (const literal of renderedLiterals(expr)) report(literal, literalText(literal) ?? '', kind);
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      report(node, node.text, 'JSX text');
    } else if (
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      reportLiterals(node.expression, 'JSX child');
    } else if (ts.isJsxAttribute(node)) {
      const name = propertyName(node.name);
      if (name && TEXT_PROPS.has(name) && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) report(node.initializer, node.initializer.text, `prop ${name}`);
        else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          reportLiterals(node.initializer.expression, `prop ${name}`);
        }
      }
    } else if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name);
      if (name && TEXT_PROPS.has(name)) reportLiterals(node.initializer, `property ${name}`);
    } else if (ts.isCallExpression(node)) {
      if (isCall(node, 'Alert', 'alert')) {
        node.arguments.slice(0, 2).forEach((arg) => reportLiterals(arg, 'Alert.alert'));
      } else if (isCall(node, 'AccessibilityInfo', 'announceForAccessibility')) {
        node.arguments.forEach((arg) => reportLiterals(arg, 'announcement'));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}

describe('hard-coded user-facing strings', () => {
  const files = SCANNED_DIRS.flatMap(listFiles);

  it('scans the UI source tree', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain('components/navigation/root-stack.tsx');
  });

  it('finds none outside the locale files', () => {
    const findings = files.flatMap((file) => scanFile(file)).map((f) => `${f.file}:${f.line} [${f.kind}] ${f.text}`);
    expect(findings).toEqual([]);
  });

  it('allowlist entries still exist (no stale exceptions)', () => {
    for (const entry of Object.keys(ALLOWED)) {
      const [file, text] = entry.split(': ');
      expect(fs.readFileSync(path.join(ROOT, file), 'utf8')).toContain(text);
    }
  });
});

describe('scanner self-test', () => {
  const scanSource = (source: string) => scanFile('fixture.tsx', source).map((f) => f.text);

  it('catches each kind of hard-coded text', () => {
    const found = scanSource(`
      const a = <Text>Hello</Text>;
      const b = <Text>{open ? 'Open' : t('closed')}</Text>;
      const c = <Input placeholder="Search" accessibilityLabel={'Clear'} />;
      const d = { title: 'Todo Details' };
      Alert.alert('Delete?', \`Remove \${name}\`, [{ text: 'Cancel' }]);
      AccessibilityInfo.announceForAccessibility('Saved');
    `);
    expect(found).toEqual(['Hello', 'Open', 'Search', 'Clear', 'Todo Details', 'Delete?', 'Remove', 'Cancel', 'Saved']);
  });

  it('ignores translated text, symbols and numbers', () => {
    expect(
      scanSource(`
        const a = <Text>{t('x')} · {count} / 5 ✨</Text>;
        const b = <Input placeholder={t('y')} title={\`\${n}%\`} />;
      `)
    ).toEqual([]);
  });
});
