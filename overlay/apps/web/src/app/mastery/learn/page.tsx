import { Suspense } from "react";
import MasteryWorkspace from "../workspace-ui";

export default function LearnPage() {
  return <Suspense fallback={<main>Loading your study workspace…</main>}><MasteryWorkspace section="learn" /></Suspense>;
}
