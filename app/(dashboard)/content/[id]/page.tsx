import { ContentEditorClient } from "./content-editor-client";

export const metadata = { title: "Content" };

export default async function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContentEditorClient id={id} />;
}
