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

// The email that confirms a new account's address (spec §5 Auth). Plain
// words, one button, and the link as text for mail apps that hide buttons.

export type VerifyEmailProps = { url: string }

export function VerifyEmail({ url }: VerifyEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Body style={s.body}>
        <Preview>Confirm your email to download and share your drafts.</Preview>
        <Container style={s.container}>
          <Text style={s.wordmark}>Parley</Text>
          <Section style={s.card}>
            <Heading as="h1" style={s.heading}>
              Confirm your email
            </Heading>
            <Text style={s.text}>
              Tap the button to confirm this is your email. Then you can
              download and share your drafts.
            </Text>
            <Button href={url} style={s.button}>
              Confirm email
            </Button>
            <Text style={s.small}>
              The link works for 1 hour. If the button doesn’t work, open this
              link:
            </Text>
            <Text style={s.link}>{url}</Text>
          </Section>
          <Hr style={s.rule} />
          <Text style={s.footer}>
            You get this email because someone signed up for Parley with this
            address. If it wasn’t you, you can ignore it.
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

VerifyEmail.PreviewProps = {
  url: "https://parley.runtimedrift.dev/api/auth/verify-email?token=preview",
} satisfies VerifyEmailProps

export default VerifyEmail
