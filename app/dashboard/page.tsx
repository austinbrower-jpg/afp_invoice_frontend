import { redirect } from "next/navigation";

// The dashboard merged into the cockpit at /. Anything still pointing here lands on the
// cockpit rather than a dead route.
export default function DashboardRedirect() {
  redirect("/");
}
