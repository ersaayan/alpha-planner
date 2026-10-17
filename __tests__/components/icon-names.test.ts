/**
 * Every icon name the app uses must be mapped in components/icon.tsx; an unmapped
 * name renders a plain circle. Names come from two places:
 * - the source: <Icon name="…">, `icon="…"` props, `icon:`/`focusedName:` keys and
 *   `…Icon`/`…icon` variables (string literals, through ?: and ||/??);
 * - the data: achievements and default categories.
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

import { hasIcon } from '@/components/icon';
import { ACHIEVEMENTS } from '@/constants/gamification';
import { DEFAULT_CATEGORIES } from '@/types';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null, MaterialCommunityIcons: () => null }));

const ROOT = path.resolve(__dirname, '../..');

function listFiles(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(rel);
    return /\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

function literals(node: ts.Node): string[] {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isParenthesizedExpression(node)) return literals(node.expression);
  if (ts.isConditionalExpression(node)) return [...literals(node.whenTrue), ...literals(node.whenFalse)];
  if (ts.isBinaryExpression(node)) return [...literals(node.left), ...literals(node.right)];
  if (ts.isJsxExpression(node) && node.expression) return literals(node.expression);
  return [];
}

function iconNamesIn(file: string): { name: string; where: string }[] {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: { name: string; where: string }[] = [];
  const add = (node: ts.Node, names: string[]) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    for (const name of names) found.push({ name, where: `${file}:${line + 1}` });
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.initializer) {
      const attr = node.name.getText(sf);
      const tag = (node.parent.parent as ts.JsxOpeningLikeElement).tagName?.getText(sf);
      if ((attr === 'name' && tag === 'Icon') || attr === 'icon') add(node, literals(node.initializer));
    } else if (ts.isPropertyAssignment(node)) {
      const key = node.name.getText(sf);
      const siblings = ts.isObjectLiteralExpression(node.parent) ? node.parent.properties.map((p) => p.name?.getText(sf)) : [];
      if (key === 'icon' || key === 'focusedName' || (key === 'name' && siblings.includes('focusedName'))) {
        add(node, literals(node.initializer));
      }
    } else if (ts.isVariableDeclaration(node) && node.initializer && /icon$/i.test(node.name.getText(sf))) {
      add(node, literals(node.initializer));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe('icon names', () => {
  it('every icon name in the source is mapped', () => {
    const files = ['app', 'components', 'constants', 'services', 'types'].flatMap(listFiles);
    const used = files.flatMap(iconNamesIn).filter(({ name }) => !/^#|^rgb/.test(name));
    expect(used.length).toBeGreaterThan(50);
    expect(used.filter(({ name }) => !hasIcon(name)).map(({ name, where }) => `${where} ${name}`)).toEqual([]);
  });

  it('every icon in the achievement and category data is mapped', () => {
    const names = [...ACHIEVEMENTS.map((a) => a.icon), ...DEFAULT_CATEGORIES.map((c) => c.icon)].filter(
      (name): name is string => Boolean(name)
    );
    expect(names.filter((name) => !hasIcon(name))).toEqual([]);
  });

  it('maps to glyphs that exist in the icon fonts', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/icon.tsx'), 'utf8');
    const glyphs = (font: string): Record<string, number> =>
      JSON.parse(
        fs.readFileSync(
          path.join(ROOT, 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps', `${font}.json`),
          'utf8'
        )
      );
    const feather = glyphs('Feather');
    const material = glyphs('MaterialCommunityIcons');
    const entries = [...source.matchAll(/pack: '(feather|material)', name: '([^']+)'/g)];
    expect(entries.length).toBeGreaterThan(100);
    const missing = entries.filter(([, pack, name]) => !((pack === 'feather' ? feather : material)[name] !== undefined));
    expect(missing.map(([, pack, name]) => `${pack}:${name}`)).toEqual([]);
  });
});
