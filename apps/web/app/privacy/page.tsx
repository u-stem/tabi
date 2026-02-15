import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "プライバシーポリシー - sugara",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo href="/" />
      </header>

      <main className="container max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">プライバシーポリシー</h1>

        <section className="mt-8 space-y-6">
          <div>
            <h2 className="text-lg font-semibold">1. はじめに</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              sugara（以下「本サービス」）は、ユーザーの個人情報の保護を重要と考えています。本プライバシーポリシーは、本サービスにおける個人情報の取り扱いについて定めるものです。
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">2. 運営者への連絡</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              本サービスは個人が運営しています。お問い合わせはサービス内のフィードバック機能をご利用ください。
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">3. 収集する情報</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              本サービスでは、以下の情報を収集します。
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>
                アカウント情報: ユーザー名、表示名、パスワード（ハッシュ値として保存）
              </li>
              <li>
                旅行計画データ:
                旅行タイトル、目的地、日程、スケジュール、メモなどユーザーが入力した情報
              </li>
              <li>アクセスログ: IPアドレス、User-Agent（セッション管理のために取得）</li>
              <li>操作履歴: 共同編集の追跡のための操作ログ</li>
              <li>フィードバック: ユーザーが送信したフィードバック内容（GitHub Issues に保存）</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold">4. 利用目的</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              収集した情報は、以下の目的で利用します。
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>旅行計画の作成・共有機能の提供</li>
              <li>ユーザー認証およびセッション管理</li>
              <li>不正アクセスの防止およびセキュリティの確保</li>
              <li>サービスの改善および新機能の開発</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold">5. 第三者提供</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              ユーザーの個人情報は、法令に基づく場合を除き、本人の同意なく第三者に提供しません。ただし、本サービスの運営にあたり、以下の業務委託先にデータの取り扱いを委託しています。
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Supabase, Inc. - データベースおよびリアルタイム通信の提供</li>
              <li>Vercel Inc. - アプリケーションのホスティング</li>
              <li>GitHub, Inc. - フィードバック機能における情報の保存</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold">6. Cookie の利用</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              本サービスでは、認証・セッション管理のためにセッション Cookie を使用しています。この
              Cookie は httpOnly、Secure、SameSite=Lax
              属性を持ち、認証の維持にのみ使用されます。アクセス解析や広告目的の Cookie
              は使用していません。
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">7. 安全管理措置</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              個人情報の安全管理のため、パスワードのハッシュ化、通信の暗号化（SSL/TLS）など適切な技術的措置を講じています。
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">8. 開示・訂正・削除の請求</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              ユーザーは、設定画面からアカウントおよび関連データを削除できます。その他の開示・訂正・利用停止の請求は、フィードバック機能よりご連絡ください。
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">9. ポリシーの変更</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              本ポリシーは、法令の改正やサービスの変更に伴い、事前の通知なく変更することがあります。変更後のポリシーは本ページに掲載した時点で効力を生じます。重要な変更がある場合は、サービス内で通知いたします。
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">10. 施行日</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              2026年2月12日 制定
              <br />
              2026年2月15日 改定
            </p>
          </div>
        </section>
      </main>

      <footer className="container flex h-14 items-center justify-center gap-4 text-sm text-muted-foreground">
        <Link href="/faq" className="underline underline-offset-4 hover:text-foreground">
          よくある質問
        </Link>
        <Link href="/news" className="underline underline-offset-4 hover:text-foreground">
          お知らせ
        </Link>
        <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
          利用規約
        </Link>
      </footer>
    </div>
  );
}
