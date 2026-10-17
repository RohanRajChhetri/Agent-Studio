export interface LanguageMeta {
  id: string;
  label: string;
  ext: string;
  icon: string;
  color: string;
}

export const LANGUAGES: LanguageMeta[] = [
  { id: "typescript", label: "TypeScript", ext: "ts", icon: "🔷", color: "text-blue-400" },
  { id: "javascript", label: "JavaScript", ext: "js", icon: "🟨", color: "text-amber-400" },
  { id: "html", label: "HTML", ext: "html", icon: "🌐", color: "text-orange-400" },
  { id: "css", label: "CSS", ext: "css", icon: "🎨", color: "text-pink-400" },
  { id: "python", label: "Python", ext: "py", icon: "🐍", color: "text-emerald-400" },
  { id: "json", label: "JSON", ext: "json", icon: "📦", color: "text-yellow-400" },
  { id: "markdown", label: "Markdown", ext: "md", icon: "📝", color: "text-cyan-400" },
  { id: "sql", label: "SQL", ext: "sql", icon: "🗃️", color: "text-violet-400" },
  { id: "bash", label: "Bash", ext: "sh", icon: "🖥️", color: "text-emerald-400" },
  { id: "rust", label: "Rust", ext: "rs", icon: "🦀", color: "text-orange-500" },
  { id: "go", label: "Go", ext: "go", icon: "🐹", color: "text-sky-400" },
];

export function getLanguageForFile(filePath: string): LanguageMeta {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const matched = LANGUAGES.find((l) => l.ext === ext);
  return matched || LANGUAGES[0];
}

export function formatCodeSnippet(rawCode: string, langId: string): string {
  if (!rawCode || !rawCode.trim()) return rawCode;

  if (langId === "json") {
    try {
      const parsed = JSON.parse(rawCode);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return rawCode;
    }
  }

  if (langId === "html") {
    try {
      let formatted = "";
      let indentLevel = 0;
      const lines = rawCode.replace(/>\s*</g, ">\n<").split("\n");

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        if (line.match(/^<\//)) {
          indentLevel = Math.max(0, indentLevel - 1);
        }

        formatted += "  ".repeat(indentLevel) + line + "\n";

        if (
          line.match(/^<[^\/]/) &&
          !line.endsWith("/>") &&
          !line.match(/<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)/i) &&
          !line.includes("</")
        ) {
          indentLevel++;
        }
      }
      return formatted.trimEnd();
    } catch {
      return rawCode;
    }
  }

  if (langId === "css") {
    try {
      return rawCode
        .replace(/\s*{\s*/g, " {\n  ")
        .replace(/;\s*/g, ";\n  ")
        .replace(/\s*}\s*/g, "\n}\n\n")
        .replace(/\n\s*\n\s*\n/g, "\n\n")
        .trim();
    } catch {
      return rawCode;
    }
  }

  // Basic cleanup for JS / TS / other
  return rawCode
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd() + "\n";
}

/**
 * Script injected into the sandboxed preview iframe to stream console logs and capture errors
 */
export const PREVIEW_CONSOLE_BRIDGE_SCRIPT = `
<script>
(function() {
  function sendToParent(level, args) {
    try {
      var serialized = Array.from(args).map(function(item) {
        if (item === null) return 'null';
        if (item === undefined) return 'undefined';
        if (typeof item === 'object') {
          try { return JSON.stringify(item); } catch(e) { return String(item); }
        }
        return String(item);
      }).join(' ');
      window.parent.postMessage({
        type: 'preview-console',
        level: level,
        message: serialized,
        timestamp: Date.now()
      }, '*');
    } catch(err) {}
  }

  var origLog = console.log;
  var origWarn = console.warn;
  var origError = console.error;
  var origInfo = console.info;

  console.log = function() {
    sendToParent('log', arguments);
    if (origLog) origLog.apply(console, arguments);
  };
  console.warn = function() {
    sendToParent('warn', arguments);
    if (origWarn) origWarn.apply(console, arguments);
  };
  console.error = function() {
    sendToParent('error', arguments);
    if (origError) origError.apply(console, arguments);
  };
  console.info = function() {
    sendToParent('info', arguments);
    if (origInfo) origInfo.apply(console, arguments);
  };

  window.addEventListener('error', function(e) {
    sendToParent('error', [e.message + (e.filename ? ' (' + e.filename + ':' + e.lineno + ')' : '')]);
  });

  window.addEventListener('unhandledrejection', function(e) {
    sendToParent('error', ['Unhandled Promise Rejection: ' + (e.reason ? e.reason.message || e.reason : 'Unknown')]);
  });

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'preview-eval') {
      try {
        var evalResult = window.eval(e.data.code);
        sendToParent('eval', ['=> ' + (evalResult !== undefined ? JSON.stringify(evalResult) : 'undefined')]);
      } catch(err) {
        sendToParent('error', ['REPL Error: ' + err.message]);
      }
    }
  });
})();
</script>
`;
