import { mkdir, readFile, rename, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";

export async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export async function readJsonl<T>(filePath: string): Promise<T[]> {
  let raw = "";
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line) as T;
      } catch (error) {
        throw new Error(`Invalid JSONL at ${filePath}:${index + 1}: ${String(error)}`);
      }
    });
}

export async function appendJsonl<T>(filePath: string, record: T): Promise<void> {
  await ensureParentDir(filePath);
  await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
}

export async function writeJsonl<T>(filePath: string, records: T[]): Promise<void> {
  await ensureParentDir(filePath);
  const tempPath = `${filePath}.${process.pid}.tmp`;
  const body = records.map((record) => JSON.stringify(record)).join("\n");
  await writeFile(tempPath, body.length > 0 ? `${body}\n` : "", "utf8");
  await rename(tempPath, filePath);
}

export async function upsertJsonl<T extends { id: string }>(
  filePath: string,
  record: T
): Promise<T> {
  const records = await readJsonl<T>(filePath);
  const index = records.findIndex((candidate) => candidate.id === record.id);

  if (index === -1) {
    await appendJsonl(filePath, record);
    return record;
  }

  records[index] = record;
  await writeJsonl(filePath, records);
  return record;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
