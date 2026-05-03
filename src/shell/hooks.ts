import { homedir } from "node:os";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ShellKind = "powershell" | "bash" | "zsh";

const startMarker = "# >>> agent-context-governor >>>";
const endMarker = "# <<< agent-context-governor <<<";

export interface HookInstallResult {
  shell: ShellKind;
  profilePath: string;
  installed: boolean;
  dryRun: boolean;
  backupPath?: string;
}

export interface HookRemoveResult {
  shell: ShellKind;
  profilePath: string;
  removed: boolean;
  dryRun: boolean;
  backupPath?: string;
}

export interface ShellHookOptions {
  dryRun?: boolean | undefined;
}

export function defaultShell(): ShellKind {
  if (process.platform === "win32") {
    return "powershell";
  }

  const shell = process.env.SHELL ?? "";

  if (shell.includes("zsh")) {
    return "zsh";
  }

  return "bash";
}

export function profilePathFor(shell: ShellKind): string {
  if (shell === "powershell") {
    return process.env.PROFILE ?? path.join(homedir(), "Documents", "PowerShell", "Microsoft.PowerShell_profile.ps1");
  }

  if (shell === "zsh") {
    return path.join(homedir(), ".zshrc");
  }

  return path.join(homedir(), ".bashrc");
}

export async function installShellHook(shell = defaultShell(), options: ShellHookOptions = {}): Promise<HookInstallResult> {
  const profilePath = profilePathFor(shell);
  const current = await readTextIfExists(profilePath);
  const next = appendHook(current, hookBlock(shell));
  const dryRun = options.dryRun ?? false;

  if (next === current) {
    return { shell, profilePath, installed: false, dryRun };
  }

  if (dryRun) {
    return { shell, profilePath, installed: true, dryRun };
  }

  await mkdir(path.dirname(profilePath), { recursive: true });
  const backupPath = await backupProfileIfNeeded(profilePath, current);
  await writeFile(profilePath, next, "utf8");
  return hookInstallResult(shell, profilePath, true, dryRun, backupPath);
}

export async function removeShellHook(shell = defaultShell(), options: ShellHookOptions = {}): Promise<HookRemoveResult> {
  const profilePath = profilePathFor(shell);
  const current = await readTextIfExists(profilePath);
  const next = stripHook(current);
  const dryRun = options.dryRun ?? false;

  if (next === current) {
    return { shell, profilePath, removed: false, dryRun };
  }

  if (dryRun) {
    return { shell, profilePath, removed: true, dryRun };
  }

  const backupPath = await backupProfileIfNeeded(profilePath, current);
  await writeFile(profilePath, next, "utf8");
  return hookRemoveResult(shell, profilePath, true, dryRun, backupPath);
}

export function hookBlock(shell: ShellKind): string {
  if (shell === "powershell") {
    return [
      startMarker,
      "function claude { agc run claude -- @args }",
      "function codex { agc run codex -- @args }",
      endMarker
    ].join("\n");
  }

  return [
    startMarker,
    "claude() { agc run claude -- \"$@\"; }",
    "codex() { agc run codex -- \"$@\"; }",
    endMarker
  ].join("\n");
}

function appendHook(current: string, block: string): string {
  const stripped = stripHook(current).trimEnd();
  return `${stripped}${stripped.length > 0 ? "\n\n" : ""}${block}\n`;
}

function stripHook(current: string): string {
  const pattern = new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}\\r?\\n?`, "u");
  return current.replace(pattern, "").trimEnd() + (current.length > 0 ? "\n" : "");
}

async function readTextIfExists(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

async function backupProfileIfNeeded(profilePath: string, current: string): Promise<string | undefined> {
  if (current.length === 0) {
    return undefined;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const backupPath = `${profilePath}.agent-context-governor.${timestamp}.bak`;
  await mkdir(path.dirname(backupPath), { recursive: true });
  await writeFile(backupPath, current, "utf8");
  return backupPath;
}

function hookInstallResult(
  shell: ShellKind,
  profilePath: string,
  installed: boolean,
  dryRun: boolean,
  backupPath: string | undefined
): HookInstallResult {
  const result: HookInstallResult = { shell, profilePath, installed, dryRun };
  if (backupPath !== undefined) {
    result.backupPath = backupPath;
  }
  return result;
}

function hookRemoveResult(
  shell: ShellKind,
  profilePath: string,
  removed: boolean,
  dryRun: boolean,
  backupPath: string | undefined
): HookRemoveResult {
  const result: HookRemoveResult = { shell, profilePath, removed, dryRun };
  if (backupPath !== undefined) {
    result.backupPath = backupPath;
  }
  return result;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
