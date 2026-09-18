import fs from "fs/promises";
import path from "path";
import { getVaultPath, ensureVaultExists } from "./vault";

export interface RAGChunk {
  title: string;
  relPath: string;
  category: string;
  excerpt: string;
  tags: string[];
  score: number;
}

export interface RAGSearchOptions {
  limit?: number;
  minScore?: number;
  category?: string;
}

/** Stop words to ignore during tokenization */
const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "cannot", "could", "couldn't",
  "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
  "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
  "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
  "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i",
  "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's",
  "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
  "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought",
  "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she",
  "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
  "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
  "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
  "they've", "this", "those", "through", "to", "too", "under", "until", "up",
  "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
  "weren't", "what", "what's", "when", "when's", "where", "where's", "which",
  "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
  "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
  "yourself", "yourselves",
  // Common conversation words that should not trigger vault notes
  "task", "tasks", "note", "notes", "file", "files", "folder", "folders",
  "memory", "memories", "agent", "agents", "please", "help", "can", "could",
  "want", "need", "make", "show", "tell", "give", "write", "know"
]);

/** Conversational greetings and small-talk patterns that should never trigger RAG */
const CONVERSATIONAL_REGEX = /^(hi|hello|hey|yo|greetings|good\s+(morning|afternoon|evening)|how\s+are\s+you|who\s+are\s+you|what\s+can\s+you\s+do|thanks|thank\s+you|ok|okay|bye|goodbye|test)[\s!.,?]*$/i;

/** Tokenize string into lowercase terms */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/** Recursively scan all markdown files in vault */
async function getAllMarkdownFiles(
  dir: string,
  baseDir: string
): Promise<{ fullPath: string; relPath: string }[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let files: { fullPath: string; relPath: string }[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(await getAllMarkdownFiles(full, baseDir));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push({
        fullPath: full,
        relPath: path.relative(baseDir, full).replace(/\\/g, "/"),
      });
    }
  }

  return files;
}

/** Search Obsidian vault for relevant context matching query */
export async function queryVaultRAG(
  query: string,
  options: RAGSearchOptions = {}
): Promise<RAGChunk[]> {
  const trimmed = query.trim();
  // Skip RAG for conversational greetings, short queries, or empty searches
  if (!trimmed || CONVERSATIONAL_REGEX.test(trimmed)) {
    return [];
  }

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0 || (trimmed.length < 12 && queryTokens.length < 2)) {
    return [];
  }

  const limit = options.limit || 3;
  const minScore = options.minScore || 4.5;
  await ensureVaultExists();

  const vaultPath = getVaultPath();
  const files = await getAllMarkdownFiles(vaultPath, vaultPath);

  const chunks: RAGChunk[] = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(file.fullPath, "utf-8");
      
      // Parse basic frontmatter
      let title = path.basename(file.relPath, ".md").replace(/[-_]/g, " ");
      let category = file.relPath.includes("/") ? file.relPath.split("/")[0] : "general";
      const tags: string[] = [];

      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      let body = content;
      if (fmMatch) {
        body = content.slice(fmMatch[0].length);
        const titleMatch = fmMatch[1].match(/title:\s*["']?([^"'\r\n]+)/);
        if (titleMatch) title = titleMatch[1].trim();

        const catMatch = fmMatch[1].match(/category:\s*["']?([^"'\r\n]+)/);
        if (catMatch) category = catMatch[1].trim();

        const tagMatch = fmMatch[1].match(/tags:\s*\[(.*?)\]/);
        if (tagMatch) {
          tagMatch[1].split(",").forEach((t) => {
            const clean = t.replace(/["'#\s]/g, "");
            if (clean) tags.push(clean);
          });
        }
      }

      if (options.category && category !== options.category) {
        continue;
      }

      // Score calculation
      let score = 0;
      const titleTokens = tokenize(title);
      const bodyTokens = tokenize(body);
      const tagTokens = tags.map((t) => t.toLowerCase());

      for (const qt of queryTokens) {
        // Title exact or partial match (High weight)
        if (titleTokens.includes(qt)) score += 5;
        else if (title.toLowerCase().includes(qt)) score += 3;

        // Tag match
        if (tagTokens.includes(qt)) score += 4;

        // Body match count
        const occurrences = bodyTokens.filter((bt) => bt === qt).length;
        if (occurrences > 0) {
          score += Math.min(occurrences * 0.8, 6);
        }
      }

      if (score >= minScore) {
        // Extract most relevant 200-300 char snippet
        let excerpt = body.trim().slice(0, 320).replace(/\r?\n+/g, " ");
        // Try to find first query token in body
        for (const qt of queryTokens) {
          const idx = body.toLowerCase().indexOf(qt);
          if (idx !== -1) {
            const start = Math.max(0, idx - 40);
            const end = Math.min(body.length, idx + 260);
            excerpt = (start > 0 ? "... " : "") + body.slice(start, end).replace(/\r?\n+/g, " ") + "...";
            break;
          }
        }

        chunks.push({
          title,
          relPath: file.relPath,
          category,
          excerpt,
          tags,
          score,
        });
      }
    } catch {
      // Ignore unreadable files
    }
  }

  // Sort descending by relevance score
  chunks.sort((a, b) => b.score - a.score);
  return chunks.slice(0, limit);
}

/** Format RAG chunks into a prompt grounding block */
export function formatRAGPromptContext(chunks: RAGChunk[]): string {
  if (!chunks || chunks.length === 0) return "";

  const notesList = chunks
    .map(
      (c, i) =>
        `[Context Note ${i + 1}: "${c.title}"] (Category: ${c.category})\n"${c.excerpt}"`
    )
    .join("\n\n");

  return `\n---
[BACKGROUND KNOWLEDGE CONTEXT]
The following background notes from the knowledge vault may provide helpful context if relevant to the user's inquiry. Use this information naturally in your answer. Do NOT force citations, brackets, or artificial tags unless specifically asked.

${notesList}
---
`;
}
