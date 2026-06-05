import { DAppKitProvider } from "@mysten/dapp-kit-react"

import { DashboardPage } from "@/pages/dashboard-page"
import { HomePage } from "@/pages/home-page"
import { ProfilesPage } from "@/pages/profiles-page"
import { usePathname } from "@/hooks/use-pathname"
import { dAppKit } from "@/lib/dapp-kit"
import {
  DASHBOARD_PATH,
  DASHBOARDS_PATH,
  PROFILES_PATH,
} from "@/lib/navigation"

function Router() {
  const pathname = usePathname()

  if (pathname === DASHBOARD_PATH || pathname === DASHBOARDS_PATH) {
    return <DashboardPage />
  }

  if (pathname === PROFILES_PATH) {
    return <ProfilesPage />
  }

  return <HomePage />
}

export function App() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <Router />
    </DAppKitProvider>
  )
}
