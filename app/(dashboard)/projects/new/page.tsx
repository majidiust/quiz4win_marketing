import { ProjectEditor } from "../project-editor";

export const metadata = { title: "New Project" };

export default function NewProjectPage() {
  return <ProjectEditor mode="create" />;
}
