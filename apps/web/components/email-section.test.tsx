import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { EmailSection } from "./email-section"

describe("EmailSection", () => {
  afterEach(() => {
    cleanup()
  })

  it("email が @sugara.local の場合「未設定」と表示する", () => {
    render(<EmailSection currentEmail="alice@sugara.local" emailVerified={false} />)
    expect(screen.getByText("未設定")).toBeDefined()
  })

  it("実アドレスかつ verified=true の場合マスクして表示する", () => {
    render(<EmailSection currentEmail="alice@gmail.com" emailVerified={true} />)
    expect(screen.getByText(/a\*+@gmail\.com/)).toBeDefined()
    expect(screen.queryByText("未確認")).toBeNull()
  })

  it("実アドレスかつ verified=false の場合「未確認」バッジを表示する", () => {
    render(<EmailSection currentEmail="alice@gmail.com" emailVerified={false} />)
    expect(screen.getByText("未確認")).toBeDefined()
  })
})
