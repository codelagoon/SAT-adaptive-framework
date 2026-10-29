import { Suspense } from "react";
import MasteryWorkspace from "./workspace-ui";

export default function MasteryHome() {
  return <Suspense fallback={<main>Loading your study workspace…</main>}><MasteryWorkspace section="home" /></Suspense>;
}
