const { PrismaClient } = require("@prisma/client");
const { createProfile, setConfig, enableTool } = require("../src/lib/hermes.ts");

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.agent.count();
  console.log("Current agent count:", count);

  const newAgents = [
    {
      name: "athena",
      displayName: "Athena (Research)",
      avatar: "🔬",
      description: "Deep research, document analysis, and synthesis",
      systemPrompt:
        "You are Athena, an elite AI research specialist. You provide structured, cited analysis, synthesize data, and summarize findings with clarity.",
      themeColor: "#0ea5e9",
      tools: ["web_search", "read_vault"],
    },
    {
      name: "mercury",
      displayName: "Mercury (Copywriter)",
      avatar: "✍️",
      description: "Copywriting, pitches, and communication strategy",
      systemPrompt:
        "You are Mercury, an expert marketing strategist and copywriter. You write punchy, persuasive copy and campaign frameworks.",
      themeColor: "#f59e0b",
      tools: ["web_search", "write_vault"],
    },
  ];

  for (const a of newAgents) {
    const existing = await prisma.agent.findUnique({ where: { name: a.name } });
    if (!existing) {
      try {
        await createProfile(a.name, {
          cloneFrom: "default",
          description: a.description,
        });
        await setConfig("model.default", "liquid/lfm-2.5-2.6b:free", a.name);
        await setConfig("agent.system_prompt", a.systemPrompt, a.name);
      } catch (e) {
        console.log("Hermes profile note:", e.message);
      }

      await prisma.agent.create({
        data: {
          name: a.name,
          displayName: a.displayName,
          avatar: a.avatar,
          description: a.description,
          systemPrompt: a.systemPrompt,
          themeColor: a.themeColor,
          model: "liquid/lfm-2.5-2.6b:free",
          profilePath: a.name,
          tools: {
            create: a.tools.map((t) => ({ toolId: t, enabled: true })),
          },
        },
      });
      console.log("Created agent in DB and Hermes profile:", a.displayName);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
