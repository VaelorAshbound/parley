import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useRouteContext } from "@tanstack/react-router"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Spinner } from "@workspace/ui/components/spinner"
import { MonitorIcon, SmartphoneIcon } from "lucide-react"

import { authClient } from "@/lib/auth-client"

import { lastActive } from "./last-active"

/** Phones and tablets get a phone icon; the rest a screen. */
const mobile = /iPhone|iPad|Android/

/**
 * Where the account is signed in, and a way to sign any of them out (spec
 * §5 Auth). A signed-out device can take up to 5 minutes to notice (the
 * session cookie cache).
 */
export function SessionsCard() {
  const { orpc } = useRouteContext({ from: "/_app" })
  const queryClient = useQueryClient()
  const { data: sessions, dataUpdatedAt } = useSuspenseQuery(
    orpc.account.sessions.queryOptions()
  )
  // "Now" is when the list was read: the server's time travels with the
  // data, so the browser writes the same words on hydration.
  const now = new Date(dataUpdatedAt)
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: orpc.account.sessions.key() })

  const revoke = useMutation(
    orpc.account.revokeSession.mutationOptions({ onSettled: refresh })
  )
  const revokeOthers = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.revokeOtherSessions()
      if (error) throw new Error(error.message)
    },
    onSettled: refresh,
  })
  const others = sessions.filter((each) => !each.current)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Signed-in devices</h2>
        </CardTitle>
        <CardDescription>
          A device you sign out can take up to 5 minutes to notice.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ItemGroup>
          {sessions.map((session) => (
            <Item
              key={session.id}
              // ItemGroup is a div with role="list", so an <li> can't go
              // in it; shadcn's docs give its rows role="listitem".
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
              role="listitem"
              variant="outline"
              size="sm"
            >
              <ItemMedia variant="icon">
                {mobile.test(session.device) ? (
                  <SmartphoneIcon />
                ) : (
                  <MonitorIcon />
                )}
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  {session.device}
                  {session.current && (
                    <Badge variant="secondary">This device</Badge>
                  )}
                </ItemTitle>
                <ItemDescription>
                  {session.current
                    ? "Active now"
                    : lastActive(session.lastActiveAt, now)}
                </ItemDescription>
              </ItemContent>
              {!session.current && (
                <ItemActions>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate({ id: session.id })}
                  >
                    {revoke.isPending && revoke.variables.id === session.id && (
                      <Spinner data-icon="inline-start" />
                    )}
                    Sign out
                  </Button>
                </ItemActions>
              )}
            </Item>
          ))}
        </ItemGroup>
        {(revoke.isError || revokeOthers.isError) && (
          <Alert variant="destructive">
            <AlertDescription>
              We couldn’t sign that device out. Please try again.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      {others.length > 1 && (
        <CardFooter>
          <Button
            variant="outline"
            disabled={revokeOthers.isPending}
            onClick={() => revokeOthers.mutate()}
          >
            {revokeOthers.isPending && <Spinner data-icon="inline-start" />}
            Sign out all other devices
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
