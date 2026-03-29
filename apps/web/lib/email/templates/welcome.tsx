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

interface WelcomeEmailProps {
  userName?: string;
  locale?: string;
}

const translations = {
  en: {
    preview: "Welcome to AfriConnect - Your B2B Marketplace",
    heading: "Welcome to AfriConnect!",
    greeting: "Hello",
    intro: "Thank you for joining AfriConnect, the leading B2B marketplace connecting African businesses.",
    whatYouCanDo: "Here's what you can do:",
    feature1: "Browse thousands of products from verified African businesses",
    feature2: "Connect with suppliers and buyers across the continent",
    feature3: "Register your business to start selling",
    feature4: "Manage orders and track shipments",
    getStarted: "Get Started",
    questions: "If you have any questions, feel free to reach out to our support team.",
    thanks: "Thanks for joining us!",
    team: "The AfriConnect Team",
  },
  am: {
    preview: "እንኳን ደህና መጡ ወደ AfriConnect - የB2B ገበያ ቦታዎ",
    heading: "እንኳን ደህና መጡ ወደ AfriConnect!",
    greeting: "ሰላም",
    intro: "AfriConnectን ስለተቀላቀሉ እናመሰግናለን፣ የአፍሪካ ንግዶችን የሚያገናኝ ዋና የB2B ገበያ።",
    whatYouCanDo: "ማድረግ የሚችሉት፡",
    feature1: "ከተረጋገጡ የአፍሪካ ንግዶች በሺዎች የሚቆጠሩ ምርቶችን ያስሱ",
    feature2: "በአህጉሪቱ ውስጥ ከአቅራቢዎች እና ከገዢዎች ጋር ይገናኙ",
    feature3: "መሸጥ ለመጀመር ንግድዎን ያስመዝግቡ",
    feature4: "ትዕዛዞችን ያስተዳድሩ እና ጭነቶችን ይከታተሉ",
    getStarted: "ጀምር",
    questions: "ማንኛውም ጥያቄ ካለዎት፣ የድጋፍ ቡድናችንን ያግኙ።",
    thanks: "ስለተቀላቀሉን እናመሰግናለን!",
    team: "የAfriConnect ቡድን",
  },
  sw: {
    preview: "Karibu AfriConnect - Soko Lako la B2B",
    heading: "Karibu AfriConnect!",
    greeting: "Habari",
    intro: "Asante kwa kujiunga na AfriConnect, soko kuu la B2B linaloungana biashara za Afrika.",
    whatYouCanDo: "Hivi ndivyo unavyoweza kufanya:",
    feature1: "Vinjari bidhaa maelfu kutoka kwa biashara za Afrika zilizothibitishwa",
    feature2: "Ungana na wasambazaji na wanunuzi kote barani",
    feature3: "Sajili biashara yako ili uanze kuuza",
    feature4: "Simamia maagizo na fuatilia usafirishaji",
    getStarted: "Anza",
    questions: "Ikiwa una maswali yoyote, wasiliana na timu yetu ya msaada.",
    thanks: "Asante kwa kujiunga nasi!",
    team: "Timu ya AfriConnect",
  },
};

export function WelcomeEmail({ userName, locale = "en" }: WelcomeEmailProps) {
  const t = translations[locale as keyof typeof translations] || translations.en;
  const name = userName || "there";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://africonnect.africa.com";

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

            <Text style={paragraph}>
              <strong>{t.whatYouCanDo}</strong>
            </Text>

            <ul style={list}>
              <li style={listItem}>{t.feature1}</li>
              <li style={listItem}>{t.feature2}</li>
              <li style={listItem}>{t.feature3}</li>
              <li style={listItem}>{t.feature4}</li>
            </ul>

            <Section style={buttonContainer}>
              <Link href={`${baseUrl}/dashboard`} style={button}>
                {t.getStarted}
              </Link>
            </Section>

            <Hr style={hr} />

            <Text style={paragraph}>{t.questions}</Text>

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

const list = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "28px",
  margin: "16px 0",
  paddingLeft: "24px",
};

const listItem = {
  marginBottom: "8px",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#0f172a",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "bold" as const,
  padding: "12px 32px",
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

export default WelcomeEmail;
