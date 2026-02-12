import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "利用規約 - sugara",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo href="/" />
      </header>

      <main className="container max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">利用規約</h1>

        <section className="mt-8 space-y-6">
          <div>
            <h2 className="text-lg font-semibold">第1条（適用）</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              本規約は、sugara（以下「本サービス」）の利用に関する条件を定めるものです。ユーザーは、本規約に同意した上で本サービスを利用するものとします。
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">第2条（アカウント）</h2>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>ユーザーは、正確な情報を登録してアカウントを作成するものとします。</li>
              <li>ユーザーは、自己のアカウント情報を適切に管理する責任を負います。</li>
              <li>アカウントの第三者への譲渡、貸与、共有は禁止します。</li>
            </ol>
          </div>

          <div>
            <h2 className="text-lg font-semibold">第3条（禁止事項）</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              ユーザーは、本サービスの利用にあたり、以下の行為を行ってはなりません。
            </p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>不正アクセスまたはそのおそれのある行為</li>
              <li>虚偽の情報を登録する行為</li>
              <li>本サービスの運営を妨害する行為（過度な負荷をかける行為を含む）</li>
              <li>他のユーザーまたは第三者の権利を侵害する行為</li>
              <li>法令または公序良俗に反する行為</li>
              <li>本サービスを利用して取得した情報を、本サービスの目的外で利用する行為</li>
              <li>その他、運営者が不適切と判断する行為</li>
            </ol>
          </div>

          <div>
            <h2 className="text-lg font-semibold">第4条（サービスの変更・停止）</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              運営者は、事前の通知なく、本サービスの内容を変更し、または提供を停止・終了することができます。これによりユーザーに生じた損害について、運営者は一切の責任を負いません。
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">第5条（免責事項）</h2>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>
                本サービスは「現状有姿」で提供され、その完全性、正確性、有用性等について保証しません。
              </li>
              <li>
                ユーザーが本サービスを利用して作成した旅行計画等のデータについて、運営者はその保全を保証しません。
              </li>
              <li>
                通信障害、システム障害その他の事由により本サービスを利用できなかった場合の損害について、運営者は一切の責任を負いません。
              </li>
            </ol>
          </div>

          <div>
            <h2 className="text-lg font-semibold">第6条（知的財産権）</h2>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>本サービスに関する知的財産権は、運営者に帰属します。</li>
              <li>
                ユーザーが本サービスに入力したコンテンツ（旅行計画データ等）の権利は、ユーザーに帰属します。
              </li>
              <li>
                運営者は、サービス提供に必要な範囲でユーザーのコンテンツを利用できるものとします。
              </li>
            </ol>
          </div>

          <div>
            <h2 className="text-lg font-semibold">第7条（アカウント削除）</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              ユーザーは、運営者に連絡することでアカウントの削除を申請できます。アカウント削除後、当該ユーザーに関連するデータは合理的な期間内に削除されます。
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">第8条（準拠法・管轄裁判所）</h2>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>本規約は日本法に準拠し、解釈されます。</li>
              <li>
                本サービスに関する紛争については、[管轄裁判所]を第一審の専属的合意管轄裁判所とします。
              </li>
            </ol>
          </div>

          <div>
            <h2 className="text-lg font-semibold">第9条（規約の変更）</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              運営者は、必要に応じて本規約を変更することができます。変更後の規約は本ページに掲載した時点で効力を生じます。重要な変更がある場合は、サービス内で通知いたします。
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">第10条（施行日）</h2>
            <p className="mt-2 text-sm text-muted-foreground">2026年2月12日 制定</p>
          </div>
        </section>
      </main>

      <footer className="container flex h-14 items-center justify-center gap-4 text-sm text-muted-foreground">
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          プライバシーポリシー
        </Link>
        <span>sugara</span>
      </footer>
    </div>
  );
}
