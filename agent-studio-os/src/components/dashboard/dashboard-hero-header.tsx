"use client";

interface DashboardHeroHeaderProps {
  agentCount: number;
}

export function DashboardHeroHeader({ agentCount }: DashboardHeroHeaderProps) {
  return (
    <div className="text-center space-y-3">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e6f3fe] text-[#0075de] text-[11px] font-medium border border-[#0075de]/20">
        <span className="w-1.5 h-1.5 rounded-full bg-[#0075de]" />
        <span>Agent Studio OS</span>
        <span className="opacity-40">•</span>
        <span>{agentCount} Autonomous Specialists</span>
      </div>

      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground leading-tight">
        Where teams and agents{" "}
        <span className="inline-block px-3 py-0.5 mx-1 rounded-full bg-[#f6d5b8] text-black font-semibold text-2xl sm:text-3xl lg:text-4xl align-baseline">
          orchestrate
        </span>{" "}
        together
      </h1>
      <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
        Type{" "}
        <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-foreground font-semibold">
          /agents
        </code>{" "}
        to activate the autonomous A2A chain of command across your specialist team, chat with
        personas, or queue tasks to Kanban.
      </p>
    </div>
  );
}
