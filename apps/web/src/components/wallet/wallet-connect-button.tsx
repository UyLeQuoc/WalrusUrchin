import { type ComponentProps, useEffect, useRef, useState } from "react"
import type { DAppKitConnectModal } from "@mysten/dapp-kit-core/web"
import { useDAppKit, useWalletConnection } from "@mysten/dapp-kit-react"
import { ConnectModal } from "@mysten/dapp-kit-react/ui"
import {
  CheckIcon,
  ChevronDownIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  UserRoundIcon,
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
import {
  DASHBOARDS_PATH,
  DASHBOARD_PATH,
  PROFILES_PATH,
  navigateTo,
} from "@/lib/navigation"

type WalletConnectButtonProps = {
  className?: string
  redirectTo?: string
  size?: ComponentProps<typeof Button>["size"]
  variant?: ComponentProps<typeof Button>["variant"]
}

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const modalOptions = {
  sortFn: (first: { name: string }, second: { name: string }) =>
    first.name.localeCompare(second.name),
}

export function WalletConnectButton({
  className,
  redirectTo = DASHBOARD_PATH,
  size = "default",
  variant = "default",
}: WalletConnectButtonProps) {
  const dAppKit = useDAppKit()
  const connection = useWalletConnection()
  const connectedAddress = connection.account?.address
  const modalRef = useRef<DAppKitConnectModal | null>(null)
  const previousStatus = useRef(connection.status)
  const hasMounted = useRef(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    const wasConnected = previousStatus.current === "connected"
    const isConnected = connection.status === "connected"

    previousStatus.current = connection.status

    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }

    if (!isConnected || wasConnected || !connectedAddress) {
      return
    }

    navigateTo(redirectTo)
  }, [connectedAddress, connection.status, redirectTo])

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
              aria-label={`Connected wallet ${formatAddress(connection.account.address)}`}
              className={className}
              size={size}
              variant="outline"
            >
              <WalletIcon data-icon="inline-start" aria-hidden="true" />
              {formatAddress(connection.account.address)}
              <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              {connection.wallet.name}
              <span className="mt-0.5 block truncate text-xs text-foreground">
                {formatAddress(connection.account.address)}
              </span>
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
              <DropdownMenuItem onClick={() => navigateTo(PROFILES_PATH)}>
                <UserRoundIcon aria-hidden="true" />
                Profiles
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigateTo(DASHBOARDS_PATH)}>
                <LayoutDashboardIcon aria-hidden="true" />
                Dashboards
              </DropdownMenuItem>
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
