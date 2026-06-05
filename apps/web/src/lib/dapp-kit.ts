import { createDAppKit } from "@mysten/dapp-kit-core"
import { SuiGrpcClient } from "@mysten/sui/grpc"

const SUI_GRPC_URLS = {
  testnet: "https://fullnode.testnet.sui.io:443",
} as const

export const dAppKit = createDAppKit({
  networks: ["testnet"],
  defaultNetwork: "testnet",
  createClient: (network) =>
    new SuiGrpcClient({
      network,
      baseUrl: SUI_GRPC_URLS[network],
    }),
  autoConnect: true,
  storageKey: "walrus-urchin:dapp-kit:selected-wallet",
})

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit
  }
}
