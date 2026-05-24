import { BriefEditor } from "@/components/dashboard/brief-editor";

export const metadata = { title: "New Brief" };

export default function NewBriefPage() {
  return <BriefEditor mode="create" />;
}
