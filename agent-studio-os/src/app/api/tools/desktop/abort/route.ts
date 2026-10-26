import { NextResponse } from "next/server";
import { abortAutonomousDesktopLoop } from "@/lib/autonomous-desktop-loop";

export async function POST() {
  try {
    abortAutonomousDesktopLoop();
    return NextResponse.json({
      success: true,
      message: "Emergency killswitch triggered: halting autonomous desktop loop",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to trigger killswitch" },
      { status: 500 }
    );
  }
}
