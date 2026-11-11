import type { ReactNode } from "react";
import styles from "./code-suggestion.module.css";

/* A small TypeScript and JavaScript highlighter, one line at a time: comments, strings (with ${} kept plain), numbers,
   keywords, types and function calls. Enough for a diff preview; swap in Shiki or Prism for a full editor. */
const KEYWORDS = new Set([
  "as", "async", "await", "break", "case", "catch", "class", "const", "continue", "default", "delete", "do", "else", "enum",
  "export", "extends", "finally", "for", "from", "function", "if", "implements", "import", "in", "instanceof", "interface",
  "let", "new", "of", "private", "public", "readonly", "return", "static", "switch", "throw", "try", "type", "typeof", "var",
  "void", "while", "yield",
]);
const LITERALS = new Set(["true", "false", "null", "undefined", "this"]);
const TOKEN = /(\/\/.*$)|(`(?:[^`\\]|\\.)*`?|"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(\d[\w.]*)|([A-Za-z_$][\w$]*)|([^\w\s`"'/]+|\/|\s+)/g;

function templateParts(text: string, key: number): ReactNode[] {
  return text.split(/(\$\{[^}]*\})/).filter(Boolean).map((part, index) => part.startsWith("${")
    ? <span key={`${key}-${index}`} className={styles.tPunct}>{part}</span>
    : <span key={`${key}-${index}`} className={styles.tString}>{part}</span>);
}

export function highlightLine(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let match: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(line))) {
    const [text, comment, string, number, word] = match;
    const key = match.index;
    if (comment) out.push(<span key={key} className={styles.tComment}>{text}</span>);
    else if (string) out.push(...(string.startsWith("`") ? templateParts(string, key) : [<span key={key} className={styles.tString}>{text}</span>]));
    else if (number) out.push(<span key={key} className={styles.tNumber}>{text}</span>);
    else if (word) {
      const next = line.slice(key + text.length).match(/^\s*(.)/)?.[1];
      const className = KEYWORDS.has(word) ? styles.tKeyword
        : LITERALS.has(word) ? styles.tNumber
        : next === "(" ? styles.tFunction
        : /^[A-Z]/.test(word) ? styles.tType
        : undefined;
      out.push(className ? <span key={key} className={className}>{text}</span> : text);
    } else out.push(text);
    if (text.length === 0) TOKEN.lastIndex++;
  }
  return out;
}
