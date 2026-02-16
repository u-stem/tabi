import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "よくある質問 - sugara",
};

const faqItems = [
  {
    question: "「パターン」とは何ですか？",
    answer:
      "1日の行程に対して、最大3つの代替プランを作成できる機能です。「晴れの日プラン」「雨の日プラン」のように、状況に応じた候補を並行して検討できます。日程表のタブから切り替え・追加できます。",
  },
  {
    question: "「候補」と「予定」は何が違いますか？",
    answer:
      "「候補」は、まだ日程に割り当てていない行き先のストックです。気になる場所をとりあえず追加しておき、後から日程にドラッグして「予定」として配置できます。",
  },
  {
    question: "旅行のステータスが自動で変わるのはなぜですか？",
    answer:
      "旅行の開始日・終了日に基づいて、ステータスが自動的に「計画済み → 進行中 → 完了」と遷移します。手動で変更することもできます。",
  },
  {
    question: "メンバーの「編集者」と「閲覧者」は何が違いますか？",
    answer:
      "「編集者」は予定の追加・編集・削除ができます。「閲覧者」は旅行の内容を見ることだけできます。メンバーの追加・削除やロール変更はオーナーのみが行えます。",
  },
  {
    question: "共有リンクとメンバー招待はどう使い分けますか？",
    answer:
      "共有リンクは、リンクを知っている人なら誰でも旅行の内容を閲覧できます（読み取り専用）。メンバー招待は、特定のユーザーに編集権限を含むロールを付与できます。一緒に計画を作るならメンバー招待、完成した計画を見せるだけなら共有リンクが適しています。",
  },
  {
    question: "メンバーを追加するにはどうすればよいですか？",
    answer:
      "旅行の詳細画面からメンバー管理を開き、相手の「ユーザーID」を入力して追加します。ユーザーIDは設定画面で確認できます。フレンド登録済みの相手は、フレンドリストからワンタップで追加できます。",
  },
  {
    question: "旅行や予定に上限はありますか？",
    answer:
      "旅行は1ユーザーあたり10件、予定は1旅行あたり300件、メンバーは1旅行あたり20人、パターンは1日あたり3つ、フレンドは100人までです。",
  },
];

export default function FaqPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo href="/" />
      </header>

      <main className="container max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">よくある質問</h1>

        <Accordion type="single" collapsible className="mt-8">
          {faqItems.map((item) => (
            <AccordionItem key={item.question} value={item.question}>
              <AccordionTrigger className="hover:no-underline">{item.question}</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground leading-relaxed">{item.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>

      <footer className="container flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-4 text-sm text-muted-foreground">
        <Link href="/news" className="underline underline-offset-4 hover:text-foreground">
          お知らせ
        </Link>
        <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
          利用規約
        </Link>
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          プライバシーポリシー
        </Link>
      </footer>
    </div>
  );
}
