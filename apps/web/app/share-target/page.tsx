import { ShareTargetContent } from "@/components/share-target-content";

type Props = {
  searchParams: Promise<{ url?: string; title?: string; text?: string }>;
};

export default async function ShareTargetPage({ searchParams }: Props) {
  const params = await searchParams;
  return <ShareTargetContent url={params.url} title={params.title} text={params.text} />;
}
