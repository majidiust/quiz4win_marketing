import { UserEditor } from "../user-editor";

export const metadata = { title: "New User" };

export default function NewUserPage() {
  return <UserEditor mode="create" />;
}
