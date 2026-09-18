const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const agents = await prisma.agent.findMany();
  console.log("Total agents:", agents.length);

  if (agents.length === 0) return;

  // Find or designate top orchestrator
  let orchestrator = agents.find(a => a.role === "orchestrator" || a.name.includes("architect") || a.name.includes("default") || a.name.includes("chief"));
  if (!orchestrator) {
    orchestrator = agents[0];
  }

  // Update orchestrator
  await prisma.agent.update({
    where: { id: orchestrator.id },
    data: {
      role: "orchestrator",
      department: orchestrator.department || "Executive Leadership",
      reportsToId: null,
    },
  });
  console.log(`Orchestrator set: ${orchestrator.displayName} (${orchestrator.id})`);

  // Update remaining agents
  for (const agent of agents) {
    if (agent.id === orchestrator.id) continue;

    let role = agent.role || "specialist";
    let department = agent.department;
    const nameLower = (agent.displayName || agent.name).toLowerCase();

    if (nameLower.includes("manager") || nameLower.includes("lead")) {
      role = "manager";
      department = department || "Operations";
    } else if (nameLower.includes("research") || nameLower.includes("athena")) {
      role = "specialist";
      department = department || "Research & Intelligence";
    } else if (nameLower.includes("copy") || nameLower.includes("mercury") || nameLower.includes("design")) {
      role = "specialist";
      department = department || "Creative Strategy";
    } else if (nameLower.includes("worker") || nameLower.includes("routine") || nameLower.includes("task")) {
      role = "worker";
      department = department || "Operations";
    } else {
      role = role || "specialist";
      department = department || "Engineering";
    }

    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        role,
        department,
        reportsToId: agent.reportsToId || orchestrator.id,
      },
    });
    console.log(`Updated agent: ${agent.displayName} -> Role: ${role}, Dept: ${department}, ReportsTo: ${orchestrator.displayName}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
