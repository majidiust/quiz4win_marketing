import { BriefDetailClient } from "./brief-detail-client";

export const metadata = { title: "Brief" };

export default async function BriefDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BriefDetailClient id={id} />;
}
