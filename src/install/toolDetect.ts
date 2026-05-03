import { spawn, type StdioOptions } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

export interface DetectedTool {
  name: string;
  available: boolean;
  path?: string;
}

export interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv | undefined;
}

export async function detectTool(name: string, env: NodeJS.ProcessEnv = process.env): Promise<DetectedTool> {
  const resolved = await resolveCommand(name, env);
  const result: DetectedTool = {
    name,
    available: resolved !== undefined
  };

  if (resolved !== undefined) {
    result.path = resolved;
  }

  return result;
}

export async function resolveCommand(command: string, env: NodeJS.ProcessEnv = process.env): Promise<string | undefined> {
  if (isPathLike(command)) {
    return (await exists(command)) ? command : undefined;
  }

  const pathEntries = (envValue(env, "PATH") ?? "").split(path.delimiter).filter(Boolean);
  const extensions = process.platform === "win32"
    ? candidateExtensions(command, env)
    : [""];

  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(entry, `${command}${extension}`);
      if (await exists(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}

export async function runCommand(command: string, args: string[], options: RunCommandOptions = {}): Promise<CommandResult> {
  const env = {
    ...process.env,
    ...options.env
  };
  const commandPath = await resolveCommand(command, env);

  if (commandPath === undefined) {
    return {
      status: 127,
      stdout: "",
      stderr: `Command not found: ${command}`
    };
  }

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const child = spawnPortable(commandPath, args, {
      cwd: options.cwd ?? process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      resolve({
        status: 127,
        stdout,
        stderr: stderr.length > 0 ? stderr : error.message
      });
    });
    child.on("close", (code) => {
      resolve({
        status: code ?? 1,
        stdout,
        stderr
      });
    });
  });
}

export function spawnPortable(
  commandPath: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    stdio: StdioOptions;
  }
) {
  const extension = path.extname(commandPath).toLowerCase();

  if (process.platform === "win32" && (extension === ".cmd" || extension === ".bat")) {
    const shell = envValue(options.env, "ComSpec") ?? "cmd.exe";
    return spawn(shell, ["/d", "/c", "call", commandPath, ...args], {
      cwd: options.cwd,
      env: options.env,
      stdio: options.stdio,
      shell: false
    });
  }

  return spawn(commandPath, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: options.stdio,
    shell: false
  });
}

function candidateExtensions(command: string, env: NodeJS.ProcessEnv): string[] {
  if (path.extname(command)) {
    return [""];
  }

  const values = (envValue(env, "PATHEXT") ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .map((extension) => extension.trim())
    .filter(Boolean);
  return [...new Set(values.flatMap((extension) => [extension.toLowerCase(), extension.toUpperCase()]))];
}

function envValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
  if (env[key] !== undefined) {
    return env[key];
  }

  const match = Object.keys(env).find((name) => name.toLowerCase() === key.toLowerCase());
  return match === undefined ? undefined : env[match];
}

function isPathLike(command: string): boolean {
  return path.isAbsolute(command) || command.includes("/") || command.includes("\\");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
