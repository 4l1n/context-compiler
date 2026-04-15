export type StyleOptions = {
  useColor?: boolean;
};

type StyleFn = (text: string) => string;

const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  yellow: '\u001b[33m',
  green: '\u001b[32m',
  cyan: '\u001b[36m',
};

export type Styler = {
  heading: StyleFn;
  label: StyleFn;
  success: StyleFn;
  warning: StyleFn;
  error: StyleFn;
  muted: StyleFn;
};

export function shouldUseColor(options: { isTTY?: boolean; env?: NodeJS.ProcessEnv } = {}): boolean {
  const isTTY = options.isTTY ?? process.stdout.isTTY ?? false;
  const env = options.env ?? process.env;
  if (!isTTY) return false;
  if ('NO_COLOR' in env) return false;
  if (env.CLICOLOR === '0') return false;
  if (env.TERM === 'dumb') return false;
  return true;
}

export function createStyler(options: StyleOptions = {}): Styler {
  const enabled = options.useColor === true;
  const wrap = (prefix: string): StyleFn => {
    if (!enabled) return text => text;
    return text => `${prefix}${text}${ANSI.reset}`;
  };

  return {
    heading: wrap(`${ANSI.bold}${ANSI.cyan}`),
    label: wrap(ANSI.bold),
    success: wrap(`${ANSI.bold}${ANSI.green}`),
    warning: wrap(`${ANSI.bold}${ANSI.yellow}`),
    error: wrap(`${ANSI.bold}${ANSI.red}`),
    muted: wrap(ANSI.dim),
  };
}

export function containsAnsi(text: string): boolean {
  return /\u001b\[[0-9;]*m/.test(text);
}
