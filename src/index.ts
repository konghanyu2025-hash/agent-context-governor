export { MemoryStore } from "./store/memoryStore.js";
export type {
  AttemptInput,
  DecisionInput,
  DependencyReviewInput
} from "./store/memoryStore.js";
export { searchMemory, tokenize } from "./search/search.js";
export { generateContextPack, enforceTokenBudget } from "./pack/contextPack.js";
export { buildProjectIndex } from "./indexer/projectIndex.js";
export { reviewNpmPackage } from "./review/npmReview.js";
export { startMcpServer } from "./mcp/server.js";
export { formatDoctorReport, runDoctor } from "./doctor/doctor.js";
export type { DoctorCheck, DoctorReport, DoctorStatus } from "./doctor/doctor.js";
export { installShellHook, removeShellHook } from "./shell/hooks.js";
export type { HookInstallResult, HookRemoveResult, ShellHookOptions, ShellKind } from "./shell/hooks.js";
export { runToolWithContext } from "./wrap/runTool.js";
export type { RunToolOptions } from "./wrap/runTool.js";
export {
  getMcpToolStatus,
  installMcpServerForTool,
  mcpAddArgs,
  mcpRemoveArgs,
  mcpServerCommand,
  mcpServerName,
  removeMcpServerForTool,
  resolveMcpServerLaunch,
  supportedAgentTools
} from "./install/mcpInstall.js";
export type {
  AgentToolName,
  McpInstallOptions,
  McpInstallResult,
  McpRemoveResult,
  McpServerLaunch,
  McpToolStatus
} from "./install/mcpInstall.js";
export {
  inspectProjectInstructions,
  installProjectInstructions,
  removeProjectInstructions
} from "./install/projectInstructions.js";
export type {
  InstructionFileResult,
  ProjectInstructionChange,
  ProjectInstructionStatus
} from "./install/projectInstructions.js";
export type {
  AgentMemoryConfig,
  AttemptRecord,
  ContextPackOptions,
  DecisionRecord,
  DependencyReviewRecord,
  EvidenceRef,
  MemoryRecord,
  ProjectIndex,
  SearchResult
} from "./types.js";
