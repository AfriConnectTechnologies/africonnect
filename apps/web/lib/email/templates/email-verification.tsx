import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";
import * as React from "react";

interface EmailVerificationProps {
  userName?: string;
  verificationUrl: string;
  locale?: string;
}

const translations = {
  en: {
    preview: "Verify your email address - AfriConnect",
    heading: "Verify Your Email",
    greeting: "Hello",
    intro: "Thank you for signing up for AfriConnect! Please verify your email address by clicking the button below.",
    verifyButton: "Verify Email Address",
    expiryNote: "This link will expire in 24 hours.",
    ignoreNote: "If you didn't create an account with AfriConnect, you can safely ignore this email.",
    alternativeLink: "If the button above doesn't work, copy and paste this link into your browser:",
    thanks: "Thanks,",
    team: "The AfriConnect Team",
  },
  am: {
    preview: "ኢሜልዎን ያረጋግጡ - AfriConnect",
    heading: "ኢሜልዎን ያረጋግጡ",
    greeting: "ሰላም",
    intro: "AfriConnectን ስለተመዘገቡ እናመሰግናለን! እባክዎ ከታች ያለውን አዝራር በመጫን የኢሜል አድራሻዎን ያረጋግጡ።",
    verifyButton: "ኢሜል አድራሻ አረጋግጥ",
    expiryNote: "ይህ ማገናኛ በ24 ሰዓታት ውስጥ ይጠፋል።",
    ignoreNote: "በAfriConnect መለያ ካልፈጠሩ ይህን ኢሜል መተው ይችላሉ።",
    alternativeLink: "ከላይ ያለው አዝራር ካልሰራ ይህን ማገናኛ ወደ አሳሽዎ ይቅዱ:",
    thanks: "እናመሰግናለን፣",
    team: "የAfriConnect ቡድን",
  },
  sw: {
    preview: "Thibitisha anwani yako ya barua pepe - AfriConnect",
    heading: "Thibitisha Barua Pepe Yako",
    greeting: "Habari",
    intro: "Asante kwa kujisajili AfriConnect! Tafadhali thibitisha anwani yako ya barua pepe kwa kubofya kitufe hapa chini.",
    verifyButton: "Thibitisha Anwani ya Barua Pepe",
    expiryNote: "Kiungo hiki kitaisha muda wake baada ya masaa 24.",
    ignoreNote: "Ikiwa hukuunda akaunti na AfriConnect, unaweza kupuuza barua pepe hii kwa usalama.",
    alternativeLink: "Ikiwa kitufe hapo juu hakifanyi kazi, nakili na ubandike kiungo hiki kwenye kivinjari chako:",
    thanks: "Asante,",
    team: "Timu ya AfriConnect",
  },
};

export function EmailVerificationEmail({ 
  userName, 
  verificationUrl, 
  locale = "en" 
}: EmailVerificationProps) {
  const t = translations[locale as keyof typeof translations] || translations.en;
  const name = userName || "there";

  return (
    <Html>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={logo}>AfriConnect</Heading>
          </Section>

          <Section style={content}>
            <Heading style={heading}>{t.heading}</Heading>

            <Text style={paragraph}>
              {t.greeting} {name},
            </Text>

            <Text style={paragraph}>{t.intro}</Text>

            <Section style={buttonContainer}>
              <Link href={verificationUrl} style={button}>
                {t.verifyButton}
              </Link>
            </Section>

            <Text style={smallText}>{t.expiryNote}</Text>

            <Hr style={hr} />

            <Text style={paragraph}>{t.alternativeLink}</Text>
            <Text style={linkText}>{verificationUrl}</Text>

            <Hr style={hr} />

            <Text style={smallText}>{t.ignoreNote}</Text>

            <Text style={paragraph}>
              {t.thanks}
              <br />
              {t.team}
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              AfriConnect - Connecting African Businesses
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "600px",
};

const header = {
  padding: "32px 48px",
  backgroundColor: "#0f172a",
};

const logo = {
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: "bold" as const,
  margin: "0",
  textAlign: "center" as const,
};

const content = {
  padding: "0 48px",
};

const heading = {
  color: "#0f172a",
  fontSize: "24px",
  fontWeight: "bold" as const,
  margin: "32px 0 16px",
};

const paragraph = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "16px 0",
};

const smallText = {
  color: "#8898aa",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "16px 0",
};

const linkText = {
  color: "#0f172a",
  fontSize: "14px",
  lineHeight: "20px",
  wordBreak: "break-all" as const,
  margin: "8px 0",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#16a34a",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "bold" as const,
  padding: "14px 40px",
  textDecoration: "none",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "32px 0",
};

const footer = {
  padding: "32px 48px",
  backgroundColor: "#f6f9fc",
};

const footerText = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  margin: "0",
  textAlign: "center" as const,
};

export default EmailVerificationEmail;
