import { useEffect, useState } from "react"

import { addNavigationListener } from "@/lib/navigation"

function getPathname() {
  return window.location.pathname
}

export function usePathname() {
  const [pathname, setPathname] = useState(getPathname)

  useEffect(() => {
    return addNavigationListener(() => {
      setPathname(getPathname())
    })
  }, [])

  return pathname
}
