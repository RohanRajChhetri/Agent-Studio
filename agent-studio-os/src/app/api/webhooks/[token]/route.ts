import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeChatCompletion } from "@/lib/llm-router";
import { writeVaultFile, ensureVaultExists } from "@/lib/vault";
import { slugify, formatResponseTime } from "@/lib/utils";
import { getTelegramConfig, processTelegramUpdate } from "@/lib/telegram-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const url = new URL(request.url);
  const promptParam = url.searchParams.get("prompt") || url.searchParams.get("message") || url.searchParams.get("text");

  // If a prompt is passed via query params (e.g. browser URL test or GET webhook)
  if (promptParam) {
    return handleWebhookExecution(token, {
      prompt: promptParam,
      title: url.searchParams.get("title") || `GET Webhook: ${promptParam.slice(0, 30)}`,
      agent: url.searchParams.get("agent") || undefined,
    });
  }

  // Interactive HTML test console for browser requests
  const acceptHeader = request.headers.get("accept") || "";
  if (acceptHeader.includes("text/html")) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Agent Studio OS - Webhook Sandbox</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090d16; color: #f1f5f9; padding: 40px 20px; line-height: 1.6; }
    .container { max-width: 680px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    h1 { margin-top: 0; font-size: 22px; color: #38bdf8; display: flex; align-items: center; gap: 8px; }
    .badge { display: inline-block; padding: 3px 8px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border-radius: 6px; font-size: 12px; font-weight: bold; }
    label { display: block; margin-top: 18px; font-size: 13px; font-weight: 600; color: #94a3b8; }
    input, textarea { width: 100%; box-sizing: border-box; background: #1e293b; border: 1px solid #334155; border-radius: 8px; color: #fff; padding: 10px 12px; margin-top: 6px; font-size: 14px; }
    button { margin-top: 20px; background: linear-gradient(135deg, #0284c7, #2563eb); color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-weight: bold; cursor: pointer; transition: opacity 0.2s; }
    button:hover { opacity: 0.9; }
    .curl-box { background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; color: #a5f3fc; overflow-x: auto; margin-top: 8px; }
    #response { margin-top: 20px; padding: 16px; border-radius: 8px; background: #020617; border: 1px solid #334155; display: none; white-space: pre-wrap; font-family: monospace; font-size: 13px; max-height: 350px; overflow-y: auto; }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚡ Webhook Sandbox <span class="badge">ACTIVE</span></h1>
    <p style="color: #94a3b8; font-size: 14px;">This webhook token is ready to receive automated triggers, custom cURL events, or IoT device dispatches.</p>
    
    <div>
      <label>Endpoint URL (POST or GET with ?prompt=...)</label>
      <input type="text" readonly value="${request.url}" style="color: #38bdf8;">
    </div>

    <form id="testForm" onsubmit="event.preventDefault(); triggerWebhook();">
      <label>Test Message / Prompt</label>
      <textarea id="promptInput" rows="3" placeholder="Enter instructions for the agent...">Hello Agent, what is your status and what can you do?</textarea>
      
      <button type="submit" id="submitBtn">🚀 Send Test Event</button>
    </form>

    <div id="response"></div>

    <label style="margin-top: 28px;">Quick cURL Command</label>
    <div class="curl-box">curl -X POST "${request.url}" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Deploy release v1.0"}'</div>
  </div>

  <script>
    async function triggerWebhook() {
      const btn = document.getElementById('submitBtn');
      const resBox = document.getElementById('response');
      const text = document.getElementById('promptInput').value.trim();
      btn.disabled = true;
      btn.innerText = 'Processing...';
      resBox.style.display = 'block';
      resBox.innerText = 'Sending request to autonomous agent...';
      
      try {
        const res = await fetch('${request.url}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        });
        const data = await res.json();
        resBox.innerText = JSON.stringify(data, null, 2);
      } catch (err) {
        resBox.innerText = 'Error: ' + err.message;
      } finally {
        btn.disabled = false;
        btn.innerText = '🚀 Send Test Event';
      }
    }
  </script>
</body>
</html>`;
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.json({
    status: "active",
    webhookUrl: `/api/webhooks/${token}`,
    supportedEvents: ["generic_task", "message", "prompt", "github_push", "cron_routine"],
    usage: {
      postBodyExample: { message: "Hello agent", agent: "Rohan" },
      getExample: `/api/webhooks/${token}?prompt=Hello+Agent`,
    },
    timestamp: new Date().toISOString(),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json().catch(() => ({}));
  return handleWebhookExecution(token, body);
}

async function handleWebhookExecution(token: string, body: Record<string, any>) {
  try {
    // Basic token validation
    if (!token || token.length < 3) {
      return NextResponse.json({ error: "Invalid webhook token" }, { status: 401 });
    }

    // Detect if this payload is an incoming Telegram update
    if (body.update_id && (body.message || body.edited_message)) {
      const { token: tgToken, assignedAgents } = await getTelegramConfig();
      if (tgToken) {
        await processTelegramUpdate(body, tgToken, assignedAgents[0] || {});
        return NextResponse.json({ ok: true, source: "telegram_routed" });
      }
    }

    // Extract user instructions from various possible JSON field conventions
    const userPrompt =
      body.message ||
      body.prompt ||
      body.text ||
      body.content ||
      body.query ||
      body.input ||
      body.instruction ||
      "";

    let taskTitle =
      body.title ||
      body.taskTitle ||
      (userPrompt ? `Webhook: ${userPrompt.slice(0, 45)}` : "External Automated Webhook Event");
    
    let taskDesc = body.description || userPrompt || "";
    let priority = body.priority || "medium";
    let targetAgentName = body.agent || body.agentName || body.agentId;

    // Detect GitHub Push Webhook
    if (body.head_commit || body.commits) {
      const commit = body.head_commit || body.commits?.[0];
      const repo = body.repository?.name || "Repository";
      taskTitle = `GitHub Push: ${repo} - "${commit?.message?.slice(0, 50) || "Code Update"}"`;
      taskDesc = `Automated code commit by ${commit?.author?.name || "developer"}.\nModified files: ${commit?.modified?.join(", ") || "various"}.\nCommit ID: ${commit?.id?.slice(0, 7) || "latest"}`;
      priority = "high";
      targetAgentName = targetAgentName || "vulcan-devops";
    }

    // Resolve assigned agent
    let assignedAgent = null;
    if (targetAgentName) {
      assignedAgent = await prisma.agent.findFirst({
        where: {
          OR: [
            { id: targetAgentName },
            { name: targetAgentName },
            { displayName: targetAgentName },
          ],
        },
      });
    }

    // Check if webhook platform has an assigned agent in Setting
    if (!assignedAgent) {
      const webhookSetting = await prisma.setting.findUnique({
        where: { key: "integration:webhook" },
      });
      if (webhookSetting) {
        try {
          const parsed = JSON.parse(webhookSetting.value);
          if (parsed.assignedAgentId) {
            assignedAgent = await prisma.agent.findUnique({
              where: { id: parsed.assignedAgentId },
            });
          }
        } catch {}
      }
    }

    if (!assignedAgent) {
      assignedAgent = await prisma.agent.findFirst({
        orderBy: { createdAt: "asc" },
      });
    }

    // Create the task in database
    const task = await prisma.task.create({
      data: {
        title: taskTitle,
        description: taskDesc,
        status: "in_progress",
        priority: priority,
        agentId: assignedAgent?.id || null,
      },
      include: { agent: true },
    });

    // Execute agent autonomously
    const prompt = userPrompt
      ? `WEBHOOK INSTRUCTION RECEIVED (Token: ${token})
User Query: "${userPrompt}"
Execute this request and provide a clear, accurate, and direct response.`
      : `AUTOMATED TRIGGER EVENT RECEIVED VIA WEBHOOK (Token: ${token})
Task: "${task.title}"
Details: "${task.description}"
Priority: ${task.priority.toUpperCase()}

Execute this request immediately and provide a structured, production-grade output or operational summary.`;

    const execution = await executeChatCompletion({
      prompt,
      model: assignedAgent?.model || "auto/fast",
      systemPrompt: assignedAgent?.systemPrompt,
      agentName: assignedAgent?.name,
      useVaultRAG: true,
      useEpisodicMemory: true,
    });

    // Format latency to mins and seconds
    const timeFormatted = formatResponseTime(execution.latency);

    // Move task to review with deliverable
    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "review",
        result: execution.content,
      },
      include: { agent: true },
    });

    // Save deliverable to vault
    try {
      await ensureVaultExists();
      const filename = `tasks/webhook-${slugify(task.title)}.md`;
      const vaultContent = `---
title: "${task.title.replace(/"/g, '\\"')}"
status: "review"
priority: "${task.priority}"
type: "webhook_trigger"
token: "${token}"
agent: "${assignedAgent ? assignedAgent.displayName : "Agent"}"
date: "${new Date().toISOString()}"
tags:
  - webhook
  - automation
  - deliverable
---

# ${task.title}

> [!NOTE]
> Autonomous event triggered via external webhook. Processed by **${assignedAgent ? assignedAgent.displayName : "Agent"}** in ${timeFormatted}.

${execution.content}
`;
      await writeVaultFile(filename, vaultContent);
    } catch (vaultErr) {
      console.warn("Failed to write webhook task to vault:", vaultErr);
    }

    // Record activity log
    await prisma.activityLog.create({
      data: {
        type: "webhook_received",
        message: `Webhook trigger executed "${task.title}" via ${assignedAgent?.displayName || "Agent"} (${timeFormatted})`,
        agentId: assignedAgent?.id || null,
      },
    });

    return NextResponse.json({
      success: true,
      reply: execution.content,
      content: execution.content,
      taskId: task.id,
      task: updatedTask,
      execution: {
        latency: execution.latency,
        latencyFormatted: timeFormatted,
        source: execution.source,
        model: execution.modelUsed,
      },
    });
  } catch (error) {
    console.error("[Webhook API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to process webhook event",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
