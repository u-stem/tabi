import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { pageTitle } from "@/lib/constants";

export const metadata: Metadata = {
  title: pageTitle("よくある質問"),
};

const faqItems = [
  {
    question: "sugaraで何ができますか？",
    answer:
      "旅行計画を作成し、メンバーと共同編集できるWebアプリです。日程・行き先の管理、日程調整の投票、ブックマークの保存、Excel/CSV出力、印刷に対応しています。",
  },
  {
    question: "「パターン」とは何ですか？",
    answer:
      "1日の行程に対して最大3つの代替プランを作成できる機能です。「晴れの日プラン」「雨の日プラン」のように、状況に応じた候補を並行して管理できます。",
  },
  {
    question: "「候補」と「予定」は何が違いますか？",
    answer:
      "「候補」はまだ日程に割り当てていない行き先のストックです。気になる場所をとりあえず追加しておき、後からドラッグ&ドロップで日程に配置すると「予定」になります。",
  },
  {
    question: "旅行のステータスが自動で変わるのはなぜですか？",
    answer:
      "旅行の開始日・終了日に基づいて、ステータスが自動的に「計画済み → 進行中 → 完了」と遷移します。手動で変更することもできます。",
  },
  {
    question: "「日程調整」とは何ですか？",
    answer:
      "旅行の日程をメンバーと投票で決められる機能です。複数の日程案を提示し、参加者が「OK / たぶん / NG」で回答します。結果を見てオーナーが日程を確定すると、旅行の日付が自動設定されます。",
  },
  {
    question: "日程調整に参加者を招待するにはどうすればよいですか？",
    answer:
      "通常の旅行と同じように、メンバー管理からユーザーを追加します。旅行のメンバーは日程調整にアクセスすると自動的に回答できるようになります。共有リンクを発行すると回答状況を外部に公開できますが、リンク経由では投票できません（閲覧専用）。日程確定後、投票参加者は自動的に旅行のメンバー（編集者）に追加されます。",
  },
  {
    question: "メンバーの「編集者」と「閲覧者」は何が違いますか？",
    answer:
      "「編集者」は予定の追加・編集・削除ができます。「閲覧者」は旅行の内容を見ることだけできます。メンバーの管理（追加・削除・ロール変更）はオーナーのみ行えます。",
  },
  {
    question: "メンバーを追加するにはどうすればよいですか？",
    answer:
      "旅行の詳細画面からメンバー管理を開き、相手の「ユーザーID」を入力して追加します。ユーザーIDは設定画面で確認できます。フレンド登録済みの相手は、フレンドリストやグループからまとめて追加できます。",
  },
  {
    question: "共有リンクとメンバー招待はどう使い分けますか？",
    answer:
      "共有リンクは、リンクを知っている人なら誰でも旅行の内容を閲覧できます（読み取り専用）。メンバー招待は、特定のユーザーに編集権限を含むロールを付与できます。一緒に計画を作るならメンバー招待、完成した計画を見せるだけなら共有リンクが便利です。",
  },
  {
    question: "複数人で同時に編集できますか？",
    answer:
      "はい。メンバーが同時にアクセスしている場合、他のメンバーの変更がリアルタイムで反映されます。誰がどの日程を閲覧中かも表示されます。",
  },
  {
    question: "「ブックマーク」とは何ですか？",
    answer:
      "行き先をリストにまとめて保存・共有できる機能です。旅行中に見つけた場所をブックマークに保存し、別の旅行で再利用できます。リストの公開範囲は「非公開」「フレンドのみ」「公開」から選べます。",
  },
  {
    question: "「グループ」は何に使いますか？",
    answer:
      "よく一緒に旅行するメンバーをグループにまとめておくと、旅行にメンバーを追加する際にグループから一括追加できます。",
  },
  {
    question: "旅行の計画を書き出せますか？",
    answer:
      "Excel (.xlsx) または CSV 形式でエクスポートできます。CSVは区切り文字や改行コードをカスタマイズ可能です。また、印刷用レイアウトでブラウザから印刷・PDF保存もできます。",
  },
  {
    question: "キーボードショートカットはありますか？",
    answer:
      "はい。「?」キーでショートカット一覧を表示できます。日程の切り替え（数字キー・[ ]キー）、予定の追加（aキー）、候補の追加（cキー）などが使えます。",
  },
  {
    question: "旅行や予定に上限はありますか？",
    answer:
      "旅行は1ユーザーあたり10件、予定は1旅行あたり300件、メンバーは1旅行あたり20人、パターンは1日あたり3つ、ブックマークリストは5件、フレンドは100人、グループは10件までです。",
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
