import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Mask an API key for display: sk-or-v1-abc...xyz → sk-o...xyz */
export function maskKey(key: string): string {
  if (!key || key.length < 8) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/** Format date to relative time */
export function timeAgo(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return d.toLocaleDateString();
}

/** Generate a random emoji for agent avatars */
export function randomAgentEmoji(): string {
  const emojis = ["🤖", "🧠", "🦾", "🎯", "🔮", "⚡", "🌟", "🎨", "🔬", "📊", "🛡️", "🚀", "💡", "🔧", "📝", "🎭", "🦊", "🐙", "🦅", "🐋"];
  return emojis[Math.floor(Math.random() * emojis.length)];
}

/** Slugify a string for use as a profile name */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Parse frontmatter from markdown content */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      frontmatter[line.slice(0, colonIdx).trim()] = line
        .slice(colonIdx + 1)
        .trim();
    }
  }

  return { frontmatter, body: match[2] };
}

/**
 * Format response time / latency in milliseconds to minutes and seconds
 * Examples:
 *   250 -> "0.25s"
 *   3400 -> "3.4s"
 *   45000 -> "45s"
 *   75000 -> "1m 15s"
 *   185000 -> "3m 05s"
 */
export function formatResponseTime(ms: number | undefined | null): string {
  if (ms == null || isNaN(ms) || ms <= 0) return "0s";
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    if (totalSeconds < 1) {
      return `${totalSeconds.toFixed(2)}s`;
    }
    return totalSeconds < 10 ? `${totalSeconds.toFixed(1)}s` : `${Math.round(totalSeconds)}s`;
  }
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.round(totalSeconds % 60);
  return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
}

