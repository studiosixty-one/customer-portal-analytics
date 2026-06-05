import { redirect } from "next/navigation";

export default function SignupPage() {
  // Public sign-up is disabled — accounts are provisioned by an administrator.
  redirect("/login");
}
