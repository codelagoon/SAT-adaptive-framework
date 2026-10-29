/** Compatibility route. Legacy UI is intentionally retired; learning data is untouched. */
import { redirect } from "next/navigation";

export default function LegacyMasteryRedirect() {
  redirect("/mastery");
}
