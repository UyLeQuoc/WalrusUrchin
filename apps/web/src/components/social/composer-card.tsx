import { Button } from "@workspace/cores/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/cores/components/card"
import { Textarea } from "@workspace/cores/components/textarea"
import { SocialAvatar } from "@/components/social/social-avatar"
import type { SocialComposerAction, SocialUser } from "@/types/social"

type ComposerCardProps = {
  actions: SocialComposerAction[]
  viewer: SocialUser
}

export function ComposerCard({ actions, viewer }: ComposerCardProps) {
  return (
    <Card
      className="rounded-none border-y border-border shadow-none ring-0 md:rounded-lg md:border"
      size="sm"
    >
      <CardHeader>
        <CardTitle>What are you sharing?</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3">
          <SocialAvatar
            address={viewer.address}
            aria-label="Current wallet avatar"
          />
          <label className="min-w-0 flex-1">
            <span className="sr-only">Create a post</span>
            <Textarea
              aria-label="Create a post"
              placeholder="Post publicly, tease a paid drop, or attach a private file."
            />
          </label>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {actions.map((action) => {
            const Icon = action.icon

            return (
              <Button
                key={action.id}
                aria-label={action.label}
                size="sm"
                variant="ghost"
              >
                <Icon data-icon="inline-start" aria-hidden="true" />
                <span className="hidden sm:inline">{action.label}</span>
              </Button>
            )
          })}
        </div>
        <Button className="sm:w-fit">Publish</Button>
      </CardFooter>
    </Card>
  )
}
