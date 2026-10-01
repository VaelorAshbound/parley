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

// "Forgot password?" (spec §5 Auth). Plain words, one button, and the link
// as text for mail apps that hide buttons.

export type ResetPasswordProps = { url: string }

export function ResetPassword({ url }: ResetPasswordProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Body style={s.body}>
        <Preview>Choose a new password for Parley.</Preview>
        <Container style={s.container}>
          <Text style={s.wordmark}>Parley</Text>
          <Section style={s.card}>
            <Heading as="h1" style={s.heading}>
              Reset your password
            </Heading>
            <Text style={s.text}>
              Tap the button to choose a new password. For your safety, this
              signs you out on every device.
            </Text>
            <Button href={url} style={s.button}>
              Choose a new password
            </Button>
            <Text style={s.small}>
              The link works once, for 30 minutes. If the button doesn’t work,
              open this link:
            </Text>
            <Text style={s.link}>{url}</Text>
          </Section>
          <Hr style={s.rule} />
          <Text style={s.footer}>
            You get this email because someone asked to reset the password for
            this address. If it wasn’t you, you can ignore it: your password
            stays the same.
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

ResetPassword.PreviewProps = {
  url: "https://parley.runtimedrift.dev/reset-password?token=preview",
} satisfies ResetPasswordProps

export default ResetPassword
