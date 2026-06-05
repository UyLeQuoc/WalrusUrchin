export const DASHBOARD_PATH = "/dashboard"
export const DASHBOARDS_PATH = "/dashboards"
export const PROFILES_PATH = "/profiles"

const navigationEventName = "walrusurchin:navigation"

export function navigateTo(pathname: string) {
  if (window.location.pathname === pathname) {
    return
  }

  window.history.pushState({}, "", pathname)
  window.dispatchEvent(new Event(navigationEventName))
}

export function addNavigationListener(listener: () => void) {
  window.addEventListener("popstate", listener)
  window.addEventListener(navigationEventName, listener)

  return () => {
    window.removeEventListener("popstate", listener)
    window.removeEventListener(navigationEventName, listener)
  }
}
