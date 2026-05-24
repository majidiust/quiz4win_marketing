import { BriefEditor } from "@/components/dashboard/brief-editor";

export const metadata = { title: "Edit Brief" };

export default async function EditBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BriefEditor mode="edit" id={id} />;
}
