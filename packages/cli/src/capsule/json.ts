import { ORACLE_CAPSULE_LIMITS } from '../constants.js';
import type { Finding, SourceLocation } from '../types.js';
import type {
  JsonValue,
  StrictJsonDocument,
  StrictJsonOptions,
  StrictJsonResult,
} from './types.js';

class JsonFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly path: string,
    readonly offset: number,
  ) {
    super(message);
  }
}

function pointerSegment(value: string): string {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

function decodeInput(input: string | Uint8Array): string {
  if (typeof input === 'string') return input;
  if (input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf)
    throw new JsonFailure('capsule-encoding', 'UTF-8 byte-order marks are forbidden.', '/', 0);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(input);
  } catch {
    throw new JsonFailure('capsule-encoding', 'Input must be valid UTF-8.', '/', 0);
  }
}

class StrictJsonParser {
  private offset = 0;
  private nodes = 0;
  private readonly lineStarts = [0];
  readonly locations = new Map<string, SourceLocation>();

  constructor(
    private readonly source: string,
    private readonly options: Required<
      Pick<StrictJsonOptions, 'maxDepth' | 'maxNodes' | 'maxScalarLength'>
    >,
  ) {
    for (let index = 0; index < source.length; index += 1) {
      if (source.charCodeAt(index) === 0x0a) this.lineStarts.push(index + 1);
    }
  }

  parse(): JsonValue {
    this.skipWhitespace();
    const value = this.parseValue('/', 0);
    this.skipWhitespace();
    if (this.offset !== this.source.length)
      this.fail('capsule-json-syntax', 'Unexpected trailing content.', '/');
    return value;
  }

  private location(offset: number): SourceLocation {
    let low = 0;
    let high = this.lineStarts.length;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if ((this.lineStarts[middle] ?? 0) <= offset) low = middle;
      else high = middle;
    }
    return { line: low + 1, column: offset - (this.lineStarts[low] ?? 0) + 1 };
  }

  failureLocation(offset: number): SourceLocation {
    return this.location(offset);
  }

  private fail(code: string, message: string, path: string, offset = this.offset): never {
    throw new JsonFailure(code, message, path, offset);
  }

  private node(path: string, depth: number): void {
    if (depth > this.options.maxDepth)
      this.fail('capsule-limit', `JSON exceeds maximum depth ${this.options.maxDepth}.`, path);
    this.nodes += 1;
    if (this.nodes > this.options.maxNodes)
      this.fail('capsule-limit', `JSON exceeds maximum node count ${this.options.maxNodes}.`, path);
    this.locations.set(path, this.location(this.offset));
  }

  private skipWhitespace(): void {
    while (/[\t\n\r ]/.test(this.source[this.offset] ?? '')) this.offset += 1;
  }

  private parseValue(path: string, depth: number): JsonValue {
    this.node(path, depth);
    const character = this.source[this.offset];
    if (character === '{') return this.parseObject(path, depth);
    if (character === '[') return this.parseArray(path, depth);
    if (character === '"') return this.parseString(path);
    if (character === '-' || (character !== undefined && /[0-9]/.test(character)))
      return this.parseNumber(path);
    if (this.source.startsWith('true', this.offset)) {
      this.offset += 4;
      return true;
    }
    if (this.source.startsWith('false', this.offset)) {
      this.offset += 5;
      return false;
    }
    if (this.source.startsWith('null', this.offset)) {
      this.offset += 4;
      return null;
    }
    return this.fail('capsule-json-syntax', 'Expected a JSON value.', path);
  }

  private parseObject(path: string, depth: number): { [key: string]: JsonValue } {
    const result: { [key: string]: JsonValue } = {};
    const seen = new Set<string>();
    this.offset += 1;
    this.skipWhitespace();
    if (this.source[this.offset] === '}') {
      this.offset += 1;
      return result;
    }
    while (true) {
      if (this.source[this.offset] !== '"')
        this.fail('capsule-json-syntax', 'Object names must be JSON strings.', path);
      const keyOffset = this.offset;
      const key = this.parseString(path);
      const childPath = path === '/' ? `/${pointerSegment(key)}` : `${path}/${pointerSegment(key)}`;
      if (seen.has(key))
        this.fail(
          'capsule-duplicate-key',
          `Duplicate object name ${JSON.stringify(key)}.`,
          childPath,
          keyOffset,
        );
      seen.add(key);
      this.skipWhitespace();
      if (this.source[this.offset] !== ':')
        this.fail('capsule-json-syntax', 'Expected a colon after the object name.', childPath);
      this.offset += 1;
      this.skipWhitespace();
      result[key] = this.parseValue(childPath, depth + 1);
      this.skipWhitespace();
      const separator = this.source[this.offset];
      if (separator === '}') {
        this.offset += 1;
        return result;
      }
      if (separator !== ',')
        this.fail('capsule-json-syntax', 'Expected a comma or closing brace.', path);
      this.offset += 1;
      this.skipWhitespace();
    }
  }

  private parseArray(path: string, depth: number): JsonValue[] {
    const result: JsonValue[] = [];
    this.offset += 1;
    this.skipWhitespace();
    if (this.source[this.offset] === ']') {
      this.offset += 1;
      return result;
    }
    while (true) {
      const childPath = path === '/' ? `/${result.length}` : `${path}/${result.length}`;
      result.push(this.parseValue(childPath, depth + 1));
      this.skipWhitespace();
      const separator = this.source[this.offset];
      if (separator === ']') {
        this.offset += 1;
        return result;
      }
      if (separator !== ',')
        this.fail('capsule-json-syntax', 'Expected a comma or closing bracket.', path);
      this.offset += 1;
      this.skipWhitespace();
    }
  }

  private parseString(path: string): string {
    this.offset += 1;
    let value = '';
    while (this.offset < this.source.length) {
      const code = this.source.charCodeAt(this.offset);
      if (code === 0x22) {
        this.offset += 1;
        if (value.length > this.options.maxScalarLength)
          this.fail(
            'capsule-limit',
            `String exceeds maximum length ${this.options.maxScalarLength}.`,
            path,
          );
        return value;
      }
      if (code < 0x20)
        this.fail('capsule-json-syntax', 'Unescaped control character in string.', path);
      if (code === 0x5c) {
        value += this.parseEscape(path);
        continue;
      }
      if (code >= 0xd800 && code <= 0xdbff) {
        const low = this.source.charCodeAt(this.offset + 1);
        if (!Number.isInteger(low) || low < 0xdc00 || low > 0xdfff)
          this.fail('capsule-unicode', 'Lone high surrogate is not I-JSON compatible.', path);
        value += this.source.slice(this.offset, this.offset + 2);
        this.offset += 2;
        continue;
      }
      if (code >= 0xdc00 && code <= 0xdfff)
        this.fail('capsule-unicode', 'Lone low surrogate is not I-JSON compatible.', path);
      value += this.source[this.offset] ?? '';
      this.offset += 1;
    }
    return this.fail('capsule-json-syntax', 'Unterminated JSON string.', path);
  }

  private parseEscape(path: string): string {
    this.offset += 1;
    const escape = this.source[this.offset];
    const simple: Record<string, string> = {
      '"': '"',
      '\\': '\\',
      '/': '/',
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
    };
    if (escape !== undefined && escape in simple) {
      this.offset += 1;
      return simple[escape] ?? '';
    }
    if (escape !== 'u') return this.fail('capsule-json-syntax', 'Invalid JSON escape.', path);
    const first = this.readUnicodeEscape(path);
    if (first >= 0xd800 && first <= 0xdbff) {
      if (this.source.slice(this.offset, this.offset + 2) !== '\\u')
        return this.fail(
          'capsule-unicode',
          'Escaped high surrogate must be followed by a low surrogate.',
          path,
        );
      const second = this.readUnicodeEscape(path);
      if (second < 0xdc00 || second > 0xdfff)
        return this.fail(
          'capsule-unicode',
          'Escaped high surrogate must be followed by a low surrogate.',
          path,
        );
      return String.fromCharCode(first, second);
    }
    if (first >= 0xdc00 && first <= 0xdfff)
      return this.fail('capsule-unicode', 'Lone escaped low surrogate is forbidden.', path);
    return String.fromCharCode(first);
  }

  private readUnicodeEscape(path: string): number {
    const digitsAt =
      this.source[this.offset] === 'u'
        ? this.offset + 1
        : this.source.slice(this.offset, this.offset + 2) === '\\u'
          ? this.offset + 2
          : -1;
    if (digitsAt < 0) return this.fail('capsule-json-syntax', 'Invalid Unicode escape.', path);
    const hex = this.source.slice(digitsAt, digitsAt + 4);
    if (!/^[0-9a-fA-F]{4}$/.test(hex))
      return this.fail(
        'capsule-json-syntax',
        'Unicode escapes require four hexadecimal digits.',
        path,
      );
    this.offset = digitsAt + 4;
    return Number.parseInt(hex, 16);
  }

  private parseNumber(path: string): number {
    const remaining = this.source.slice(this.offset);
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(remaining);
    if (!match) return this.fail('capsule-json-syntax', 'Invalid JSON number.', path);
    const token = match[0];
    const following = remaining[token.length];
    if (following !== undefined && !/[\t\n\r ,\]}]/.test(following))
      return this.fail('capsule-json-syntax', 'Invalid character after JSON number.', path);
    this.offset += token.length;
    const value = Number(token);
    if (!Number.isFinite(value))
      return this.fail('capsule-number', 'Non-finite numbers are not I-JSON compatible.', path);
    if (Number.isInteger(value) && !Number.isSafeInteger(value))
      return this.fail(
        'capsule-number',
        'Integers must be within the interoperable safe-integer range.',
        path,
      );
    return value;
  }
}

function finding(error: JsonFailure, location: SourceLocation): Finding {
  return {
    severity: 'error',
    code: error.code,
    message: error.message,
    path: error.path,
    location,
  };
}

export function parseCapsuleJson(
  input: string | Uint8Array,
  options: StrictJsonOptions = {},
): StrictJsonResult {
  const sourceName = options.sourceName ?? '<memory>';
  let source: string;
  try {
    source = decodeInput(input);
  } catch (error) {
    const failure = error as JsonFailure;
    return { ok: false, findings: [finding(failure, { line: 1, column: 1 })] };
  }
  const maxBytes = options.maxBytes ?? ORACLE_CAPSULE_LIMITS.maxBytes;
  if (Buffer.byteLength(source, 'utf8') > maxBytes) {
    return {
      ok: false,
      findings: [
        {
          severity: 'error',
          code: 'capsule-file-too-large',
          message: `Input exceeds ${maxBytes} bytes.`,
          path: '/',
          location: { line: 1, column: 1 },
        },
      ],
    };
  }
  if (source.charCodeAt(0) === 0xfeff) {
    return {
      ok: false,
      findings: [
        {
          severity: 'error',
          code: 'capsule-encoding',
          message: 'UTF-8 byte-order marks are forbidden.',
          path: '/',
          location: { line: 1, column: 1 },
        },
      ],
    };
  }
  const parser = new StrictJsonParser(source, {
    maxDepth: options.maxDepth ?? ORACLE_CAPSULE_LIMITS.maxDepth,
    maxNodes: options.maxNodes ?? ORACLE_CAPSULE_LIMITS.maxNodes,
    maxScalarLength: options.maxScalarLength ?? ORACLE_CAPSULE_LIMITS.maxScalarLength,
  });
  try {
    const value = parser.parse();
    const document: StrictJsonDocument = {
      value,
      raw: source,
      sourceName,
      locations: parser.locations,
    };
    return { ok: true, document, findings: [] };
  } catch (error) {
    const failure =
      error instanceof JsonFailure
        ? error
        : new JsonFailure('capsule-json-syntax', String(error), '/', 0);
    return { ok: false, findings: [finding(failure, parser.failureLocation(failure.offset))] };
  }
}
