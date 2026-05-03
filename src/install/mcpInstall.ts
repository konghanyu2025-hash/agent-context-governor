import { access } from "node:fs/promises";
import path from "node:path";
import { detectTool, runCommand, type CommandResult, type DetectedTool } from "./toolDetect.js";

export type AgentToolName = "claude" | "codex";

export const mcpServerName = "agent-context-governor";
export const mcpServerCommand = "agent-context-mcp";

export interface McpServerLaunch {
  available: boolean;
  command: string;
  args: string[];
  source: "path" | "local-dist" | "missing";
}

export interface McpToolStatus {
  tool: AgentToolName;
  detected: DetectedTool;
  registered: boolean;
  listStatus?: number;
  error?: string;
}

export interface McpInstallResult extends McpToolStatus {
  action: "installed" | "already-installed" | "skipped" | "failed";
  commandArgs: string[];
}

export interface McpRemoveResult extends McpToolStatus {
  action: "removed" | "not-installed" | "skipped" | "failed";
  commandArgs: string[];
}

export interface McpInstallOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
}

const agentTools: AgentToolName[] = ["claude", "codex"];

export function supportedAgentTools(): AgentToolName[] {
  return [...agentTools];
}

export async function resolveMcpServerLaunch(cwd: string, env: NodeJS.ProcessEnv = process.env): Promise<McpServerLaunch> {
  const detected = await detectTool(mcpServerCommand, env);

  if (detected.available) {
    return {
      available: true,
      command: mcpServerCommand,
      args: [],
      source: "path"
    };
  }

  const localServer = path.join(cwd, "dist", "mcp", "server.js");
  if (await exists(localServer)) {
    return {
      available: true,
      command: process.execPath,
      args: [localServer],
      source: "local-dist"
    };
  }

  return {
    available: false,
    command: mcpServerCommand,
    args: [],
    source: "missing"
  };
}

export async function getMcpToolStatus(tool: AgentToolName, options: McpInstallOptions): Promise<McpToolStatus> {
  const env = options.env ?? process.env;
  const detected = await detectTool(tool, env);

  if (!detected.available) {
    return {
      tool,
      detected,
      registered: false
    };
  }

  const result = await runAgentMcpCommand(tool, ["mcp", "list"], options);
  const status: McpToolStatus = {
    tool,
    detected,
    registered: result.status === 0 && result.stdout.includes(mcpServerName),
    listStatus: result.status
  };

  if (result.status !== 0) {
    status.error = normalizeCommandError(result);
  }

  return status;
}

export async function installMcpServerForTool(
  tool: AgentToolName,
  launch: McpServerLaunch,
  options: McpInstallOptions
): Promise<McpInstallResult> {
  const status = await getMcpToolStatus(tool, options);
  const commandArgs = mcpAddArgs(tool, launch);

  if (!status.detected.available || !launch.available) {
    return {
      ...status,
      action: "skipped",
      commandArgs
    };
  }

  if (status.registered) {
    return {
      ...status,
      action: "already-installed",
      commandArgs
    };
  }

  const result = await runAgentMcpCommand(tool, commandArgs, options);
  return {
    ...status,
    registered: result.status === 0,
    action: result.status === 0 ? "installed" : "failed",
    commandArgs,
    ...(result.status === 0 ? {} : { error: normalizeCommandError(result) })
  };
}

export async function removeMcpServerForTool(tool: AgentToolName, options: McpInstallOptions): Promise<McpRemoveResult> {
  const status = await getMcpToolStatus(tool, options);
  const commandArgs = mcpRemoveArgs(tool);

  if (!status.detected.available) {
    return {
      ...status,
      action: "skipped",
      commandArgs
    };
  }

  if (!status.registered) {
    return {
      ...status,
      action: "not-installed",
      commandArgs
    };
  }

  const result = await runAgentMcpCommand(tool, commandArgs, options);
  return {
    ...status,
    registered: result.status !== 0,
    action: result.status === 0 ? "removed" : "failed",
    commandArgs,
    ...(result.status === 0 ? {} : { error: normalizeCommandError(result) })
  };
}

export function mcpAddArgs(tool: AgentToolName, launch: McpServerLaunch): string[] {
  if (tool === "claude") {
    return [
      "mcp",
      "add",
      "--transport",
      "stdio",
      "--scope",
      "local",
      mcpServerName,
      "--",
      launch.command,
      ...launch.args
    ];
  }

  return ["mcp", "add", mcpServerName, "--", launch.command, ...launch.args];
}

export function mcpRemoveArgs(tool: AgentToolName): string[] {
  return ["mcp", "remove", mcpServerName];
}

async function runAgentMcpCommand(
  tool: AgentToolName,
  args: string[],
  options: McpInstallOptions
): Promise<CommandResult> {
  return runCommand(tool, args, {
    cwd: options.cwd,
    env: options.env
  });
}

function normalizeCommandError(result: CommandResult): string {
  const message = `${result.stderr}\n${result.stdout}`.trim();
  return message.length > 0 ? message : `command exited with status ${result.status}`;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
