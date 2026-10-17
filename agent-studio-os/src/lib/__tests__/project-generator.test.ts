import { describe, it, expect } from "vitest";
import {
  extractProjectFiles,
  sanitizeProjectRelativePath,
  detectLanguageFromPath,
} from "../project-generator";

describe("Project Generator & Multi-File Parser", () => {
  it("detects programming languages accurately from file extensions", () => {
    expect(detectLanguageFromPath("index.html")).toBe("html");
    expect(detectLanguageFromPath("style.css")).toBe("css");
    expect(detectLanguageFromPath("src/App.tsx")).toBe("typescript");
    expect(detectLanguageFromPath("script.js")).toBe("javascript");
    expect(detectLanguageFromPath("main.py")).toBe("python");
    expect(detectLanguageFromPath("README.md")).toBe("markdown");
  });

  it("sanitizes relative paths inside project workspaces", () => {
    expect(sanitizeProjectRelativePath("/index.html")).toBe("index.html");
    expect(sanitizeProjectRelativePath("agent-workspace/my-app/src/App.tsx")).toBe("src/App.tsx");
    expect(sanitizeProjectRelativePath("`components/Header.tsx`")).toBe("components/Header.tsx");
    expect(sanitizeProjectRelativePath("styles.css:")).toBe("styles.css");
  });

  it("extracts multiple files from tagged code blocks (```file:path)", () => {
    const text = `
Here is the complete application:

\`\`\`file:index.html
<!DOCTYPE html>
<html>
<head><title>Clock</title></head>
<body><h1>Clock</h1></body>
</html>
\`\`\`

\`\`\`file:styles.css
body { background: #000; color: #fff; }
\`\`\`

\`\`\`file:app.js
console.log("Clock started");
\`\`\`
`;

    const files = extractProjectFiles(text);
    expect(files.length).toBe(3);
    expect(files.map((f) => f.path)).toEqual(["index.html", "styles.css", "app.js"]);
    expect(files[0].language).toBe("html");
    expect(files[0].isPrimary).toBe(true);
    expect(files[1].language).toBe("css");
    expect(files[2].language).toBe("javascript");
  });

  it("extracts files from header preceded markdown blocks", () => {
    const text = `
### File: index.html
\`\`\`html
<!DOCTYPE html>
<html><body><h1>Calculator</h1></body></html>
\`\`\`

### File: calculator.js
\`\`\`javascript
function add(a, b) { return a + b; }
\`\`\`
`;

    const files = extractProjectFiles(text);
    expect(files.length).toBe(2);
    expect(files[0].path).toBe("index.html");
    expect(files[1].path).toBe("calculator.js");
  });

  it("extracts files from first-line comments inside code blocks", () => {
    const text = `
\`\`\`html
<!-- index.html -->
<!DOCTYPE html>
<html><body><h1>App</h1></body></html>
\`\`\`

\`\`\`css
/* styles.css */
body { margin: 0; }
\`\`\`
`;

    const files = extractProjectFiles(text);
    expect(files.length).toBe(2);
    expect(files[0].path).toBe("index.html");
    expect(files[1].path).toBe("styles.css");
  });

  it("extracts files from LLM tool calls format", () => {
    const text = `<|tool_call_start|>[create_file(path='index.html', content='<!DOCTYPE html><html><body>Test</body></html>'), create_file(path='styles.css', content='body { color: blue; }')]<|tool_call_end|>`;

    const files = extractProjectFiles(text);
    expect(files.length).toBe(2);
    expect(files[0].path).toBe("index.html");
    expect(files[1].path).toBe("styles.css");
  });

  it("falls back to smart file detection for single code block without headers", () => {
    const htmlText = `
Here is your button:
\`\`\`html
<!DOCTYPE html>
<html><body><button>Click me</button></body></html>
\`\`\`
`;
    const files = extractProjectFiles(htmlText);
    expect(files.length).toBe(1);
    expect(files[0].path).toBe("index.html");
    expect(files[0].content).toContain("<button>Click me</button>");
  });
});
