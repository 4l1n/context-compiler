import { access, readFile } from 'node:fs/promises';
import { constants as FS_CONSTANTS } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { defaultConfig, resolveConfig } from './types.js';
import type { ConfigValidationOptions, ContextCompilerConfig, ContextCompilerConfigInput } from './types.js';

export const DEFAULT_CONFIG_FILENAME = 'context-compiler.config.json';

export type LoadConfigOptions = ConfigValidationOptions & {
  cwd?: string;
  configPath?: string;
};

/**
 * Load config from disk with a tiny and explicit policy:
 * - `--config <path>`: required file, throws when missing/invalid.
 * - no explicit path: optional `<cwd>/context-compiler.config.json`.
 * - when no file exists: returns default config.
 */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<ContextCompilerConfig> {
  const cwd = options.cwd ?? process.cwd();

  if (options.configPath) {
    const explicitPath = resolveConfigPath(cwd, options.configPath);
    return readAndResolveConfig(explicitPath, true, options);
  }

  const defaultPath = resolve(cwd, DEFAULT_CONFIG_FILENAME);
  const exists = await fileExists(defaultPath);
  if (!exists) return defaultConfig;
  return readAndResolveConfig(defaultPath, false, options);
}

function resolveConfigPath(cwd: string, configPath: string): string {
  return isAbsolute(configPath) ? configPath : resolve(cwd, configPath);
}

async function readAndResolveConfig(
  path: string,
  required: boolean,
  validation: ConfigValidationOptions,
): Promise<ContextCompilerConfig> {
  if (!(await fileExists(path))) {
    if (required) throw new Error(`Config file not found: ${path}`);
    return defaultConfig;
  }

  let parsed: unknown;
  try {
    const raw = await readFile(path, 'utf8');
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse config file ${path}: ${messageOf(error)}`);
  }

  if (!isObject(parsed)) {
    throw new Error(`Config file must contain a JSON object: ${path}`);
  }

  try {
    return resolveConfig(parsed as ContextCompilerConfigInput, validation);
  } catch (error) {
    throw new Error(`Invalid config in ${path}: ${messageOf(error)}`);
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, FS_CONSTANTS.F_OK);
    return true;
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
