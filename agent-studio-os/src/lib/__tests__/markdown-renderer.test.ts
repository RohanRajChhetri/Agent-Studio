import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { getExcellenceCore } from "@/lib/context-management";

describe("MarkdownRenderer Enhancement & Cleaner Formatting", () => {
  it("should strip literal --- horizontal dividers and not render them as paragraphs", () => {
    const rawContent = `## Section One
Here is some introductory text.

---

### Section Two
Another thought here.

---`;

    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: rawContent }));
    
    // Ensure "---" does not appear as raw paragraph text
    expect(html).not.toContain("<p>---</p>");
    expect(html).not.toContain("---");
    expect(html).toContain("Section One");
    expect(html).toContain("Section Two");
  });

  it("should strip YAML frontmatter cleanly", () => {
    const rawWithFrontmatter = `---
title: System Deliverable
author: Jarvis
status: completed
---
### Final Result
The task completed with 100% test coverage.`;

    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: rawWithFrontmatter }));

    expect(html).not.toContain("title: System Deliverable");
    expect(html).not.toContain("status: completed");
    expect(html).toContain("Final Result");
    expect(html).toContain("The task completed with 100% test coverage.");
  });

  it("should render fenced code blocks with language labels and pre/code formatting", () => {
    const codeSnippet = `Here is the code:

\`\`\`typescript
const greeting: string = "Hello Agent Studio OS";
console.log(greeting);
\`\`\``;

    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: codeSnippet }));

    expect(html).toContain("<pre");
    expect(html).toContain("<code");
    expect(html).toContain("typescript");
    expect(html).toContain("const greeting: string = &quot;Hello Agent Studio OS&quot;;");
  });

  it("should render standard markdown links and obsidian wiki links", () => {
    const contentWithLinks = `See the [Kanban Board](/kanban) or [External Docs](https://docs.agentstudio.ai) and [[Architecture Note]].`;

    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: contentWithLinks }));

    expect(html).toContain("href=\"/kanban\"");
    expect(html).toContain("Kanban Board");
    expect(html).toContain("href=\"https://docs.agentstudio.ai\"");
    expect(html).toContain("href=\"/memory?note=Architecture%20Note\"");
  });

  it("should enforce the clean formatting rule in getExcellenceCore", () => {
    const corePrompt = getExcellenceCore("Jarvis", "Lead Architect");
    expect(corePrompt).toContain("Never use literal horizontal line dividers");
    expect(corePrompt).toContain("---");
  });

  it("should transform raw file.create tool call into structured markdown and download link", () => {
    const rawToolCall = `<|tool_call:start|>file.create(content='# Darwin Job Opportunities\\n\\n## Overview\\nJob openings in Darwin.\\n', path='Darwin_Jobs_October_2026.doc')<|tool_call_end|>`;
    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: rawToolCall }));

    expect(html).not.toContain("&lt;|tool_call");
    expect(html).not.toContain("file.create(");
    expect(html).toContain("Darwin Job Opportunities");
    expect(html).toContain("Deliverable Ready for Download");
    expect(html).toContain("/downloads/Darwin_Jobs_October_2026.doc");
  });

  it("should not contain <div> descendants inside paragraphs when rendering download links", () => {
    const rawParagraphWithDownload = `Click here to get your report: [Download Report](/downloads/report.pdf)`;
    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: rawParagraphWithDownload }));

    // Verify <p> does not contain nested <div>
    const paragraphMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    expect(paragraphMatch).not.toBeNull();
    if (paragraphMatch) {
      expect(paragraphMatch[1]).not.toContain("<div");
    }
  });

  it("should render user messages with text-foreground without forcing invisible text-white", () => {
    const userMessage = `# Goal\nPlease execute **task 1** with \`code\` and *italic* note:\n- Item A\n- Item B`;
    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: userMessage, isUser: true }));

    // Must use text-foreground so it is visible in light mode (black) and dark mode (white)
    expect(html).toContain("text-foreground");
    expect(html).not.toContain("text-white");
    expect(html).not.toContain("divide-white");
  });
});
