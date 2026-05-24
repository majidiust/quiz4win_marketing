import { ProjectEditor } from "../project-editor";

export const metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectEditor mode="edit" id={id} />;
}
