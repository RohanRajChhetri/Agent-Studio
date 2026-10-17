import { NextResponse } from "next/server";
import {
  listExternalSkills,
  addExternalSkill,
  updateExternalSkill,
  deleteExternalSkill,
  toggleExternalSkill,
  executeExternalSkill,
} from "@/lib/external-skills";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const skills = await listExternalSkills();
    return NextResponse.json({
      success: true,
      skills,
      count: skills.length,
      activeCount: skills.filter((s) => s.enabled).length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to list external skills" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, skill, skillId, id, enabled, args, updates } = body;

    // 1. Add / Create a new external skill
    if (action === "add" || action === "create") {
      const skillPayload = skill || body;
      if (!skillPayload.name || !skillPayload.displayName) {
        return NextResponse.json(
          { error: "Skill name and display name are required" },
          { status: 400 }
        );
      }
      const created = await addExternalSkill(skillPayload);
      return NextResponse.json({ success: true, skill: created });
    }

    // 2. Toggle active state
    if (action === "toggle") {
      const targetId = skillId || id;
      if (!targetId) {
        return NextResponse.json({ error: "Skill ID is required to toggle" }, { status: 400 });
      }
      const updated = await toggleExternalSkill(targetId, enabled);
      if (!updated) {
        return NextResponse.json({ error: "Skill not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, skill: updated });
    }

    // 3. Update existing skill
    if (action === "update") {
      const targetId = skillId || id || updates?.id;
      if (!targetId) {
        return NextResponse.json({ error: "Skill ID is required to update" }, { status: 400 });
      }
      const updated = await updateExternalSkill(targetId, updates || skill || body);
      if (!updated) {
        return NextResponse.json({ error: "Skill not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, skill: updated });
    }

    // 4. Delete skill
    if (action === "delete") {
      const targetId = skillId || id;
      if (!targetId) {
        return NextResponse.json({ error: "Skill ID is required to delete" }, { status: 400 });
      }
      const deleted = await deleteExternalSkill(targetId);
      return NextResponse.json({ success: deleted });
    }

    // 5. Test or Execute skill
    if (action === "test" || action === "execute") {
      const targetIdentifier = skillId || id || body.name;
      if (!targetIdentifier) {
        return NextResponse.json(
          { error: "Skill ID or name is required for execution" },
          { status: 400 }
        );
      }
      const result = await executeExternalSkill(targetIdentifier, args || {});
      return NextResponse.json({
        success: result.success,
        result,
      });
    }

    return NextResponse.json({ error: `Unsupported action: "${action}"` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process external skills operation" },
      { status: 500 }
    );
  }
}
