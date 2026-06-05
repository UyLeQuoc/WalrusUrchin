import {
  BadgeCheckIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LockKeyholeIcon,
  ShieldCheckIcon,
  UserRoundIcon,
} from "lucide-react"
import { useCurrentAccount, useCurrentNetwork } from "@mysten/dapp-kit-react"

import { Badge } from "@workspace/cores/components/badge"
import { Button } from "@workspace/cores/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/cores/components/card"
import { Logo } from "@/components/logo"
import { ModeToggle } from "@/components/mode-toggle"
import { WalletConnectButton } from "@/components/wallet/wallet-connect-button"
import { DASHBOARDS_PATH, PROFILES_PATH, navigateTo } from "@/lib/navigation"

const profileExamples = [
  {
    title: "Primary creator",
    handle: "creator.sui",
    description:
      "Public creator identity resolved through SuiNS and tied to the connected wallet.",
    icon: UserRoundIcon,
  },
  {
    title: "Access policy",
    handle: "subscriber tiers",
    description:
      "Example route space for tier metadata, encrypted content gates, and paid access rules.",
    icon: KeyRoundIcon,
  },
  {
    title: "Verification",
    handle: "profile object",
    description:
      "Placeholder for reviewing ownership, display state, and profile publication status.",
    icon: ShieldCheckIcon,
  },
] as const

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function ProfilesHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo href="/" />
        <div className="flex items-center gap-2">
          <ModeToggle />
          <WalletConnectButton redirectTo={PROFILES_PATH} />
        </div>
      </div>
    </header>
  )
}

function DisconnectedProfiles() {
  return (
    <main className="mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-7xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <Card className="mx-auto w-full max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <LockKeyholeIcon aria-hidden="true" />
            Profiles locked
          </CardTitle>
          <CardDescription>
            Connect a Sui wallet to open the profile examples route.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WalletConnectButton redirectTo={PROFILES_PATH} size="lg" />
        </CardContent>
      </Card>
    </main>
  )
}

function ConnectedProfiles() {
  const account = useCurrentAccount()
  const network = useCurrentNetwork()

  if (!account) {
    return <DisconnectedProfiles />
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-5 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-3xl flex-col gap-3">
          <Badge className="w-fit" variant="secondary">
            <BadgeCheckIcon data-icon="inline-start" aria-hidden="true" />
            Connected on {network}
          </Badge>
          <div>
            <h1 className="text-3xl leading-tight font-black text-foreground sm:text-4xl">
              Profiles
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Example profile route for wallet{" "}
              <span className="font-medium text-foreground">
                {formatAddress(account.address)}
              </span>
              .
            </p>
          </div>
        </div>

        <Button
          className="w-fit"
          size="lg"
          variant="outline"
          onClick={() => navigateTo(DASHBOARDS_PATH)}
        >
          <LayoutDashboardIcon data-icon="inline-start" aria-hidden="true" />
          Open dashboards
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {profileExamples.map((item) => {
          const Icon = item.icon

          return (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon aria-hidden="true" />
                  {item.title}
                </CardTitle>
                <CardDescription>{item.handle}</CardDescription>
              </CardHeader>
              <CardContent>
                <CardDescription>{item.description}</CardDescription>
              </CardContent>
            </Card>
          )
        })}
      </section>
    </main>
  )
}

export function ProfilesPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <ProfilesHeader />
      <ConnectedProfiles />
    </div>
  )
}
