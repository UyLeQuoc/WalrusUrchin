import { type ComponentProps, useEffect, useRef, useState } from "react"
import type { DAppKitConnectModal } from "@mysten/dapp-kit-core/web"
import { useDAppKit, useWalletConnection } from "@mysten/dapp-kit-react"
import { ConnectModal } from "@mysten/dapp-kit-react/ui"
import { Avatar as Web3Avatar } from "web3-avatar-react"
import {
  CheckIcon,
  ChevronDownIcon,
  LogOutIcon,
  WalletIcon,
} from "lucide-react"

import { Button } from "@workspace/cores/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/cores/components/dropdown-menu"
import { cn } from "@workspace/cores/lib/utils"
import { formatAddress } from "@/lib/format-address"

type WalletConnectButtonProps = {
  className?: string
  size?: ComponentProps<typeof Button>["size"]
  variant?: ComponentProps<typeof Button>["variant"]
}

const modalOptions = {
  sortFn: (first: { name: string }, second: { name: string }) =>
    first.name.localeCompare(second.name),
}

export function WalletConnectButton({
  className,
  size = "default",
  variant = "default",
}: WalletConnectButtonProps) {
  const dAppKit = useDAppKit()
  const connection = useWalletConnection()
  const modalRef = useRef<DAppKitConnectModal | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    const modal = modalRef.current

    if (!modal) {
      return
    }

    const showOverlay = () => setIsModalOpen(true)
    const hideOverlay = () => setIsModalOpen(false)

    modal.addEventListener("open", showOverlay)
    modal.addEventListener("opened", showOverlay)
    modal.addEventListener("close", hideOverlay)
    modal.addEventListener("closed", hideOverlay)
    modal.addEventListener("cancel", hideOverlay)

    return () => {
      modal.removeEventListener("open", showOverlay)
      modal.removeEventListener("opened", showOverlay)
      modal.removeEventListener("close", hideOverlay)
      modal.removeEventListener("closed", hideOverlay)
      modal.removeEventListener("cancel", hideOverlay)
    }
  }, [])

  const openConnectModal = () => {
    void modalRef.current?.show()
  }

  const disconnectWallet = () => {
    void dAppKit.disconnectWallet()
  }

  if (connection.isConnected) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Connected wallet ${connection.account.address}`}
              className={cn("min-w-0 justify-start gap-2", className)}
              size={size}
              variant="outline"
            >
              <Web3Avatar
                address={connection.account.address}
                aria-hidden="true"
                className="size-5 shrink-0"
              />
              <span className="min-w-0 flex-1 truncate text-left">
                {formatAddress(connection.account.address)}
              </span>
              <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel
              className="truncate"
              title={connection.account.address}
            >
              {formatAddress(connection.account.address, 10, 8)}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {connection.wallet.accounts.map((account) => (
                <DropdownMenuItem
                  key={account.address}
                  onClick={() => {
                    if (account.address !== connection.account.address) {
                      void dAppKit.switchAccount({ account })
                    }
                  }}
                >
                  {account.address === connection.account.address ? (
                    <CheckIcon aria-hidden="true" />
                  ) : (
                    <WalletIcon aria-hidden="true" />
                  )}
                  {formatAddress(account.address)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={disconnectWallet}>
                <LogOutIcon aria-hidden="true" />
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {isModalOpen ? (
          <div className="wallet-connect-dialog-overlay" aria-hidden="true" />
        ) : null}
        <ConnectModal ref={modalRef} sortFn={modalOptions.sortFn} />
      </>
    )
  }

  return (
    <>
      <Button
        className={className}
        size={size}
        variant={variant}
        onClick={openConnectModal}
      >
        <WalletIcon data-icon="inline-start" aria-hidden="true" />
        Connect Wallet
      </Button>
      {isModalOpen ? (
        <div className="wallet-connect-dialog-overlay" aria-hidden="true" />
      ) : null}
      <ConnectModal ref={modalRef} sortFn={modalOptions.sortFn} />
    </>
  )
}
