import { DAppKitProvider } from "@mysten/dapp-kit-react"

import { HomePage } from "@/pages/home-page"
import { dAppKit } from "@/lib/dapp-kit"

export function App() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <HomePage />
    </DAppKitProvider>
  )
}
