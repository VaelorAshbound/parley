import { revalidateLogic } from "@tanstack/react-form"
import { useQueryClient } from "@tanstack/react-query"
import { useRouteContext } from "@tanstack/react-router"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { useState } from "react"
import QRCode from "react-qr-code"
import { z } from "zod"

import type { Login } from "@/features/account/confirm-identity"
import { authErrorMessage } from "@/features/auth/messages"
import { authClient } from "@/lib/auth-client"
import { useAppForm } from "@/lib/form"

import { BackupCodes } from "./backup-codes"
import { CodeField } from "./code-field"
import { PasswordStep } from "./password-step"

// Settings → Two-factor sign-in (spec §5 Auth, T23b). Turning it on takes
// the password, then a code from the app for the QR code (it is on only
// once that code is right), then shows the 10 backup codes once. Turning
// it off and new backup codes take the password too.

export function TwoFactorCard({ account }: { account: Login }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Two-factor sign-in</h2>
        </CardTitle>
        <CardDescription>
          {!account.hasPassword
            ? "Add a password first. Google and GitHub have their own two-factor sign-in."
            : account.twoFactor
              ? "When you sign in with your password, Parley also asks for a code from your authenticator app."
              : "Also ask for a code from an authenticator app when you sign in with your password."}
        </CardDescription>
        {account.twoFactor && (
          <CardAction>
            <Badge>On</Badge>
          </CardAction>
        )}
      </CardHeader>
      {account.hasPassword && (
        <CardContent className="flex flex-wrap gap-2">
          {account.twoFactor ? (
            <>
              <NewCodesDialog />
              <TurnOffDialog />
            </>
          ) : (
            <TurnOnDialog />
          )}
        </CardContent>
      )}
    </Card>
  )
}

/** Reads the account again: the card, and the renewed session's device. */
function useRefresh() {
  const { orpc } = useRouteContext({ from: "/_app" })
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.account.get.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.account.sessions.key() }),
    ])
}

type Setup =
  | { step: "password" }
  | { step: "scan"; uri: string; backupCodes: string[] }
  | { step: "codes"; backupCodes: string[] }

function TurnOnDialog() {
  const refresh = useRefresh()
  const [open, setOpen] = useState(false)
  const [setup, setSetup] = useState<Setup>({ step: "password" })

  function openChange(next: boolean) {
    setOpen(next)
    if (next) return
    // Closed after the code: it is on now. Closed before, it stays off.
    if (setup.step === "codes") void refresh()
    setSetup({ step: "password" })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next, { reason }) => {
        // The backup codes are shown once: only Done or the close button
        // ends that step, never Escape or a click beside the dialog.
        if (!next && setup.step === "codes" && reason !== "close-press") return
        openChange(next)
      }}
    >
      <DialogTrigger render={<Button />}>Turn on</DialogTrigger>
      <DialogContent>
        {setup.step === "password" && (
          <>
            <DialogHeader>
              <DialogTitle>Turn on two-factor sign-in</DialogTitle>
              <DialogDescription>
                First, confirm it’s you. You need an authenticator app, like
                Google Authenticator, 1Password or Authy.
              </DialogDescription>
            </DialogHeader>
            <PasswordStep
              action="Continue"
              onPassword={async (password) => {
                const { data, error } = await authClient.twoFactor.enable({
                  password,
                })
                if (error) return error
                // "otp" (codes by email) isn't configured, so this can't be.
                if (data.method !== "totp") return { status: 500 }
                setSetup({
                  step: "scan",
                  uri: data.totpURI,
                  backupCodes: data.backupCodes,
                })
                return null
              }}
            />
          </>
        )}
        {setup.step === "scan" && (
          <>
            <DialogHeader>
              <DialogTitle>Scan the QR code</DialogTitle>
              <DialogDescription>
                Scan it with your authenticator app, then enter the 6-digit code
                the app shows.
              </DialogDescription>
            </DialogHeader>
            <ScanStep
              uri={setup.uri}
              onVerified={() =>
                setSetup({ step: "codes", backupCodes: setup.backupCodes })
              }
            />
          </>
        )}
        {setup.step === "codes" && (
          <>
            <DialogHeader>
              <DialogTitle>Two-factor sign-in is on</DialogTitle>
              <DialogDescription>
                Save these backup codes somewhere safe. If you lose your phone,
                each one signs you in once. You won’t see them again.
              </DialogDescription>
            </DialogHeader>
            <BackupCodes codes={setup.backupCodes} />
            <DialogFooter>
              <Button onClick={() => openChange(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** The key in the QR code, in groups of 4, for typing into an app. */
function secretOf(uri: string) {
  const secret = new URL(uri).searchParams.get("secret") ?? ""
  return secret.match(/.{1,4}/g)?.join(" ") ?? ""
}

const codeSchema = z.object({
  code: z.string().length(6, "Enter all 6 digits."),
})

function ScanStep({
  uri,
  onVerified,
}: {
  uri: string
  onVerified: () => void
}) {
  const [error, setError] = useState<string>()

  const form = useAppForm({
    defaultValues: { code: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: codeSchema },
    onSubmit: async ({ value }) => {
      setError(undefined)
      const { error } = await authClient.twoFactor.verifyTotp({
        code: value.code,
      })
      if (error) {
        setError(authErrorMessage(error))
        return
      }
      onVerified()
    },
  })

  return (
    <form
      method="post"
      noValidate
      className="contents"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <div className="flex flex-col items-center gap-3">
        {/* Dark on white in both themes: scanners need the contrast. */}
        <div className="rounded-lg bg-white p-3">
          <QRCode
            value={uri}
            size={168}
            // react-qr-code draws an <svg>; the role gives it a name.
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
            role="img"
            aria-label="QR code for your authenticator app"
          />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Can’t scan it? Enter this key in the app:
          <br />
          <code className="font-mono text-foreground select-all">
            {secretOf(uri)}
          </code>
        </p>
      </div>
      <FieldGroup>
        <form.AppField name="code">
          {() => (
            <CodeField
              kind="app"
              label="6-digit code"
              onComplete={() => {
                if (!form.state.isSubmitting) void form.handleSubmit()
              }}
            />
          )}
        </form.AppField>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
      <DialogFooter showCloseButton>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button type="submit" disabled={submitting}>
              {submitting && <Spinner data-icon="inline-start" />}
              Turn on
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  )
}

function NewCodesDialog() {
  const [codes, setCodes] = useState<string[]>()

  return (
    <Dialog onOpenChange={(open) => !open && setCodes(undefined)}>
      <DialogTrigger render={<Button variant="outline" />}>
        New backup codes
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New backup codes</DialogTitle>
          <DialogDescription>
            {codes
              ? "Save these somewhere safe. Your old codes no longer work, and you won’t see these again."
              : "Your old backup codes stop working. Confirm it’s you first."}
          </DialogDescription>
        </DialogHeader>
        {codes ? (
          <>
            <BackupCodes codes={codes} />
            <DialogFooter showCloseButton />
          </>
        ) : (
          <PasswordStep
            action="Make new codes"
            onPassword={async (password) => {
              const { data, error } =
                await authClient.twoFactor.generateBackupCodes({ password })
              if (error) return error
              setCodes(data.backupCodes)
              return null
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TurnOffDialog() {
  const refresh = useRefresh()
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        Turn off
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Turn off two-factor sign-in?</DialogTitle>
          <DialogDescription>
            Your password alone will sign you in. Your backup codes and trusted
            devices stop working.
          </DialogDescription>
        </DialogHeader>
        <PasswordStep
          action="Turn off"
          destructive
          onPassword={async (password) => {
            const { error } = await authClient.twoFactor.disable({ password })
            if (error) return error
            await refresh()
            setOpen(false)
            return null
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
