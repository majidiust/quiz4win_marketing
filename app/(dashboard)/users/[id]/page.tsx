import { UserEditor } from "../user-editor";

export const metadata = { title: "User" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserEditor mode="edit" id={id} />;
}
