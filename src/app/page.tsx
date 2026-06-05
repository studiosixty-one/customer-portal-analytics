import { redirect } from "next/navigation";

// The URL root is reserved for the admin app; public pages live at /<handle>.
export default function RootPage() {
  redirect("/admin");
}
