"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function PipelineRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/workflows?tab=pipeline");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-3">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Redirecting to Multi-Agent Pipeline Studio...</p>
    </div>
  );
}
