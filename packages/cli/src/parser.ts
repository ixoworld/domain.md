import type { Heading, Root, YAML as MdastYaml } from 'mdast';
import remarkFrontmatter from 'remark-frontmatter';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit as visitTree } from 'unist-util-visit';
import { isAlias, parseDocument, visit as visitYaml } from 'yaml';

import {
  MAX_DOMAIN_BYTES,
  MAX_SCALAR_LENGTH,
  MAX_YAML_DEPTH,
  MAX_YAML_NODES,
} from './constants.js';
import type { DomainRecord, DomainSection, Finding, ParseOptions, ParseResult } from './types.js';

const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function finding(code: string, message: string, path = '/'): Finding {
  return { severity: 'error', code, message, path, location: { line: 1, column: 1 } };
}

function isRecord(value: unknown): value is DomainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nodeText(value: unknown): string {
  if (!isRecord(value)) return '';
  if (typeof value.value === 'string') return value.value;
  return Array.isArray(value.children) ? value.children.map(nodeText).join('') : '';
}

function parseFrontmatter(source: string, findings: Finding[]): DomainRecord | undefined {
  const match = FRONTMATTER.exec(source);
  if (!match?.[1]) {
    findings.push(
      finding(
        'missing-frontmatter',
        'A domain.md must begin with YAML frontmatter.',
        '/frontmatter',
      ),
    );
    return undefined;
  }
  const yaml = parseDocument(match[1], { prettyErrors: true, uniqueKeys: true, version: '1.2' });
  if (yaml.errors.length > 0 || yaml.warnings.length > 0) {
    findings.push(
      finding(
        'unsafe-yaml',
        [...yaml.errors, ...yaml.warnings].map((item) => item.message).join('; '),
        '/frontmatter',
      ),
    );
    return undefined;
  }
  const unsafe = new Set<string>();
  let nodes = 0;
  let depth = 0;
  let scalarTooLong = false;
  visitYaml(yaml, {
    Node(_key, node, path) {
      const candidate = node as { anchor?: string; tag?: string; value?: unknown };
      nodes += 1;
      depth = Math.max(depth, path.length + 1);
      if (typeof candidate.value === 'string' && candidate.value.length > MAX_SCALAR_LENGTH)
        scalarTooLong = true;
      if (isAlias(node)) unsafe.add('alias');
      if (candidate.anchor) unsafe.add('anchor');
      if (candidate.tag?.startsWith('!')) unsafe.add('custom-tag');
    },
    Pair(_key, pair) {
      const key = pair.key as { value?: unknown } | null;
      if (key?.value === '<<') unsafe.add('merge-key');
    },
  });
  if (nodes > MAX_YAML_NODES || depth > MAX_YAML_DEPTH || scalarTooLong) {
    findings.push(
      finding('unsafe-yaml', 'YAML exceeds the node, depth, or scalar limits.', '/frontmatter'),
    );
    return undefined;
  }
  if (unsafe.size > 0) {
    findings.push(
      finding(
        'unsafe-yaml',
        `Forbidden YAML feature(s): ${[...unsafe].sort().join(', ')}.`,
        '/frontmatter',
      ),
    );
    return undefined;
  }
  let value: unknown;
  try {
    value = yaml.toJS({ maxAliasCount: 0 });
  } catch (error) {
    findings.push(
      finding(
        'unsafe-yaml',
        error instanceof Error ? error.message : String(error),
        '/frontmatter',
      ),
    );
    return undefined;
  }
  if (!isRecord(value)) {
    findings.push(
      finding('frontmatter-shape', 'YAML frontmatter must be a mapping.', '/frontmatter'),
    );
    return undefined;
  }
  return value;
}

function extractSections(tree: Root, source: string): DomainSection[] {
  const headings: Heading[] = [];
  visitTree(tree, 'heading', (node: Heading) => {
    if (node.depth === 2) headings.push(node);
  });
  return headings.map((heading, index) => {
    const next = headings[index + 1];
    const start = heading.position?.start.offset ?? 0;
    const end = next?.position?.start.offset ?? source.length;
    const title = nodeText(heading);
    return {
      heading: title,
      content: source.slice(start, end).trimEnd(),
      location: {
        line: heading.position?.start.line ?? 1,
        column: heading.position?.start.column ?? 1,
        ...(heading.position?.end.line === undefined ? {} : { endLine: heading.position.end.line }),
        ...(heading.position?.end.column === undefined
          ? {}
          : { endColumn: heading.position.end.column }),
      },
    };
  });
}

export function parseDomain(content: string, options: ParseOptions = {}): ParseResult {
  const sourceName = options.sourceName ?? '<memory>';
  const findings: Finding[] = [];
  const maxBytes = options.maxBytes ?? MAX_DOMAIN_BYTES;
  if (Buffer.byteLength(content, 'utf8') > maxBytes) {
    return { ok: false, findings: [finding('file-too-large', `Input exceeds ${maxBytes} bytes.`)] };
  }
  if (content.charCodeAt(0) === 0xfeff) {
    findings.push(finding('encoding', 'UTF-8 byte-order marks are forbidden.'));
  }
  const frontmatter = parseFrontmatter(content, findings);
  if (!frontmatter) return { ok: false, findings };

  const tree = unified().use(remarkParse).use(remarkFrontmatter, ['yaml']).parse(content);
  const yamlNodes: MdastYaml[] = [];
  visitTree(tree, 'yaml', (node: MdastYaml) => yamlNodes.push(node));
  const frontmatterLength = FRONTMATTER.exec(content)?.[0].length ?? 0;
  const additionalFence = /(?:^|\r?\n)---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.test(
    content.slice(frontmatterLength),
  );
  if (yamlNodes.length !== 1 || tree.children[0]?.type !== 'yaml' || additionalFence) {
    findings.push(
      finding(
        'frontmatter-fence',
        'Exactly one YAML frontmatter block must appear at the start.',
        '/frontmatter',
      ),
    );
  }
  const document = {
    frontmatter,
    sections: extractSections(tree, content),
    sourceName,
    raw: content,
  };
  return { ok: findings.every((item) => item.severity !== 'error'), document, findings };
}
