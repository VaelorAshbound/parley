import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "react-email"

import { emailStyles as s } from "./styles"

// Changing the email (spec §5 Auth): the current address approves first,
// so someone at an unlocked computer can't move the account to their own
// inbox. Then the new address gets its own confirmation link.

export type ChangeEmailProps = { url: string; newEmail: string }

export function ChangeEmail({ url, newEmail }: ChangeEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Body style={s.body}>
        <Preview>Approve changing your Parley email to {newEmail}.</Preview>
        <Container style={s.container}>
          <Text style={s.wordmark}>Parley</Text>
          <Section style={s.card}>
            <Heading as="h1" style={s.heading}>
              Approve your new email
            </Heading>
            <Text style={s.text}>
              You asked to change your Parley email to {newEmail}. Tap the
              button to approve. Then we send a link to the new address, and the
              change is done when you open it.
            </Text>
            <Button href={url} style={s.button}>
              Approve the change
            </Button>
            <Text style={s.small}>
              The link works for 1 hour. If the button doesn’t work, open this
              link:
            </Text>
            <Text style={s.link}>{url}</Text>
          </Section>
          <Hr style={s.rule} />
          <Text style={s.footer}>
            If you didn’t ask for this, ignore this email: your email stays the
            same. Then change your password, in case someone else is signed in.
          </Text>
          <Text style={s.footer}>
            Parley is a demo. Not legal advice. Do not use it for real
            agreements.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

ChangeEmail.PreviewProps = {
  url: "https://parley.runtimedrift.dev/api/auth/verify-email?token=preview",
  newEmail: "ana@new.example",
} satisfies ChangeEmailProps

export default ChangeEmail
