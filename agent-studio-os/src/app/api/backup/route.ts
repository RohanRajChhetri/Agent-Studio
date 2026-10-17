import { NextResponse } from "next/server";
import {
  createSystemSnapshot,
  listSystemSnapshots,
  deleteSystemSnapshot,
} from "@/lib/backup-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshots = await listSystemSnapshots();
    return NextResponse.json({ success: true, snapshots });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to list snapshots" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const snapshot = await createSystemSnapshot();
    return NextResponse.json({ success: true, snapshot }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create snapshot" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { fileName } = await request.json();
    if (!fileName) {
      return NextResponse.json({ success: false, error: "Missing fileName" }, { status: 400 });
    }
    const deleted = await deleteSystemSnapshot(fileName);
    return NextResponse.json({ success: deleted });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete snapshot" },
      { status: 500 }
    );
  }
}
