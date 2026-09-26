import path from "path";
import fs from "fs/promises";

/** Resolve HERMES_HOME — never hardcode ~/.hermes */
export function getHermesHome(): string {
  return process.env.HERMES_HOME || path.join(process.env.LOCALAPPDATA || process.env.HOME || "", "hermes");
}

/** Get profile .env path */
export function getProfileEnvPath(profileName?: string): string {
  const home = getHermesHome();
  if (!profileName || profileName === "default") {
    return path.join(home, ".env");
  }
  return path.join(home, "profiles", profileName, ".env");
}

/** Read .env file and return key-value pairs */
export async function readEnvFile(
  envPath: string
): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(envPath, "utf-8");
    const result: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let value = trimmed.slice(eqIdx + 1).trim();
          // Remove surrounding quotes
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          result[key] = value;
        }
      }
    }
    return result;
  } catch {
    return {};
  }
}

/** Write/update a key in a .env file — ONLY place secrets go */
export async function writeEnvKey(
  envPath: string,
  key: string,
  value: string
): Promise<void> {
  let content = "";
  try {
    content = await fs.readFile(envPath, "utf-8");
  } catch {
    // File doesn't exist yet, we'll create it
  }

  const lines = content ? content.split("\n") : [];
  let found = false;
  const updatedLines = lines.map((line) => {
    if (line.trim().startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    if (updatedLines.length > 0 && updatedLines[updatedLines.length - 1] === "") {
      updatedLines[updatedLines.length - 1] = `${key}=${value}`;
    } else {
      updatedLines.push(`${key}=${value}`);
    }
  }

  await fs.writeFile(envPath, updatedLines.join("\n"), "utf-8");
}
