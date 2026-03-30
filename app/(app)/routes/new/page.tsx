import { redirect } from "next/navigation";

export default function NewRoutePage() {
  redirect("/map?mode=builder");
}
