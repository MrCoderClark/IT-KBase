import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AssistantView } from "@/components/assistant/assistant-view";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";

export default function AssistantPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <AssistantGate />
    </Suspense>
  );
}

async function AssistantGate() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Open to every signed-in role (spec 20 Q1). Drafting stays author+.
  return <AssistantView canDraft={can(session.role, "article.create")} />;
}
