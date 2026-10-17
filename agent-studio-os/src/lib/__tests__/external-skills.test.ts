import { describe, it, expect } from "vitest";
import {
  listExternalSkills,
  addExternalSkill,
  executeExternalSkill,
  toggleExternalSkill,
  deleteExternalSkill,
} from "../external-skills";

describe("External Skills Engine", () => {
  it("lists preset external skills", async () => {
    const skills = await listExternalSkills();
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.some((s) => s.name === "crypto_price")).toBe(true);
    expect(skills.some((s) => s.name === "analyze_sentiment")).toBe(true);
  });

  it("can execute a script external skill", async () => {
    const res = await executeExternalSkill("analyze_sentiment", {
      text: "Agent Studio is fantastic and I love using it!",
    });
    expect(res.success).toBe(true);
    expect(res.output).toBeDefined();
    expect(res.output.sentiment).toBe("positive");
  });

  it("adds, toggles, and deletes a custom external skill", async () => {
    const custom = await addExternalSkill({
      name: "test_calc_skill",
      displayName: "Calculation Helper",
      description: "Multiplies two numbers",
      category: "Developer",
      type: "script",
      language: "javascript",
      code: "console.log(JSON.stringify({ result: (args.a || 0) * (args.b || 0) }));",
      parameters: [
        { name: "a", type: "number", description: "first number" },
        { name: "b", type: "number", description: "second number" },
      ],
      enabled: true,
    });

    expect(custom.name).toBe("test_calc_skill");

    // Execute custom skill
    const execRes = await executeExternalSkill("test_calc_skill", { a: 6, b: 7 });
    expect(execRes.success).toBe(true);
    expect(execRes.output.result).toBe(42);

    // Toggle skill off
    const toggled = await toggleExternalSkill(custom.id, false);
    expect(toggled?.enabled).toBe(false);

    // Disabled skill execution should fail with clear message
    const disabledExec = await executeExternalSkill("test_calc_skill", { a: 1, b: 1 });
    expect(disabledExec.success).toBe(false);
    expect(disabledExec.error).toContain("disabled");

    // Delete skill
    const deleted = await deleteExternalSkill(custom.id);
    expect(deleted).toBe(true);
  });
});
