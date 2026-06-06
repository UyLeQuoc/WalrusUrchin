import { SearchIcon } from "lucide-react"

import { Badge } from "@workspace/cores/components/badge"
import { Button } from "@workspace/cores/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/cores/components/card"
import { Input } from "@workspace/cores/components/input"
import { Separator } from "@workspace/cores/components/separator"
import { SocialAvatar } from "@/components/social/social-avatar"
import { formatAddress } from "@/lib/format-address"
import type {
  CreatorMetric,
  SocialTrend,
  SocialUser,
  SuggestedCreator,
} from "@/types/social"

type RightRailProps = {
  metrics: CreatorMetric[]
  suggestedCreators: SuggestedCreator[]
  trends: SocialTrend[]
  usersById: ReadonlyMap<string, SocialUser>
}

export function RightRail({
  metrics,
  suggestedCreators,
  trends,
  usersById,
}: RightRailProps) {
  return (
    <aside className="sticky top-0 hidden h-svh min-w-0 flex-col gap-4 overflow-y-auto px-4 py-4 lg:flex">
      <label className="relative block">
        <span className="sr-only">Search WalrusUrchin</span>
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label="Search WalrusUrchin"
          className="pl-10"
          placeholder="Search posts, creators, files"
        />
      </label>

      <Card
        className="rounded-lg border border-border shadow-none ring-0"
        size="sm"
      >
        <CardHeader>
          <CardTitle>Creator pulse</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {metrics.map((metric) => (
            <div key={metric.id} className="min-w-0">
              <p className="text-2xl leading-tight font-black">
                {metric.value}
              </p>
              <p className="text-sm font-medium">{metric.label}</p>
              <p className="text-xs text-muted-foreground">{metric.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card
        className="rounded-lg border border-border shadow-none ring-0"
        size="sm"
      >
        <CardHeader>
          <CardTitle>Trending</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {trends.map((trend, index) => (
            <div key={trend.id} className="flex flex-col gap-3">
              {index > 0 ? <Separator /> : null}
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{trend.label}</p>
                  <Badge variant="secondary">{trend.volumeLabel}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {trend.summary}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card
        className="rounded-lg border border-border shadow-none ring-0"
        size="sm"
      >
        <CardHeader>
          <CardTitle>Creators to follow</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {suggestedCreators.map((suggestion) => {
            const user = usersById.get(suggestion.userId)

            if (!user) {
              return null
            }

            return (
              <div
                key={suggestion.id}
                className="flex min-w-0 items-center gap-3"
              >
                <SocialAvatar
                  address={user.address}
                  aria-label={`${formatAddress(user.address)} avatar`}
                  className="size-9"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium"
                    title={user.address}
                  >
                    {formatAddress(user.address)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {suggestion.reason}
                  </p>
                </div>
                <Button size="sm" variant="outline">
                  {suggestion.accessLabel}
                </Button>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </aside>
  )
}
