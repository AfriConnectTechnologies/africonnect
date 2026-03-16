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

interface BusinessVerifiedEmailProps {
  businessName: string;
  ownerName?: string;
  locale?: string;
}

const translations = {
  en: {
    preview: "Congratulations! Your business has been verified",
    heading: "Your Business is Verified!",
    greeting: "Hello",
    intro: "Great news! Your business has been successfully verified on AfriConnect.",
    businessLabel: "Business:",
    whatThisMeans: "What this means for you:",
    benefit1: "Your business is now visible on AfriConnect",
    benefit2: "You can list products on the marketplace",
    benefit3: "Buyers can discover and purchase from your business",
    benefit4: "You'll receive notifications when orders come in",
    getStarted: "Ready to get started?",
    addProducts: "Add your first products to the marketplace and start receiving orders from businesses across Africa.",
    startSelling: "Start Selling",
    viewMarketplace: "View Marketplace",
    questions: "If you have any questions, our support team is here to help.",
    congrats: "Congratulations again!",
    team: "The AfriConnect Team",
  },
  am: {
    preview: "እንኳን ደስ አለዎት! ንግድዎ ተረጋግጧል",
    heading: "ንግድዎ ተረጋግጧል!",
    greeting: "ሰላም",
    intro: "ጥሩ ዜና! ንግድዎ በAfriConnect በተሳካ ሁኔታ ተረጋግጧል።",
    businessLabel: "ንግድ፡",
    whatThisMeans: "ይህ ለእርስዎ ምን ማለት ነው፡",
    benefit1: "ንግድዎ አሁን በAfriConnect ላይ ይታያል",
    benefit2: "በገበያ ቦታ ላይ ምርቶችን መዘርዘር ይችላሉ",
    benefit3: "ገዢዎች ንግድዎን ማግኘት እና መግዛት ይችላሉ",
    benefit4: "ትዕዛዞች ሲመጡ ማሳወቂያዎችን ይቀበላሉ",
    getStarted: "ለመጀመር ዝግጁ ነዎት?",
    addProducts: "የመጀመሪያ ምርቶችዎን ወደ ገበያ ቦታ ይጨምሩ እና ከአፍሪካ ንግዶች ትዕዛዞችን መቀበል ይጀምሩ።",
    startSelling: "መሸጥ ጀምር",
    viewMarketplace: "ገበያ ቦታ ይመልከቱ",
    questions: "ማንኛውም ጥያቄ ካለዎት፣ የድጋፍ ቡድናችን ለመርዳት ዝግጁ ነው።",
    congrats: "እንደገና እንኳን ደስ አለዎት!",
    team: "የAfriConnect ቡድን",
  },
  sw: {
    preview: "Hongera! Biashara yako imethibitishwa",
    heading: "Biashara Yako Imethibitishwa!",
    greeting: "Habari",
    intro: "Habari njema! Biashara yako imethibitishwa kwa mafanikio kwenye AfriConnect.",
    businessLabel: "Biashara:",
    whatThisMeans: "Hii inamaanisha nini kwako:",
    benefit1: "Biashara yako sasa inaonekana kwenye AfriConnect",
    benefit2: "Unaweza kuorodhesha bidhaa kwenye soko",
    benefit3: "Wanunuzi wanaweza kugundua na kununua kutoka kwa biashara yako",
    benefit4: "Utapokea arifa maagizo yatakapokuja",
    getStarted: "Uko tayari kuanza?",
    addProducts: "Ongeza bidhaa zako za kwanza kwenye soko na uanze kupokea maagizo kutoka kwa biashara kote Afrika.",
    startSelling: "Anza Kuuza",
    viewMarketplace: "Angalia Soko",
    questions: "Ikiwa una maswali yoyote, timu yetu ya msaada ipo hapa kusaidia.",
    congrats: "Hongera tena!",
    team: "Timu ya AfriConnect",
  },
};

export function BusinessVerifiedEmail({
  businessName,
  ownerName,
  locale = "en",
}: BusinessVerifiedEmailProps) {
  const t = translations[locale as keyof typeof translations] || translations.en;
  const name = ownerName || "there";
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
            <Section style={successBanner}>
              <Text style={checkmark}>✓</Text>
              <Heading style={heading}>{t.heading}</Heading>
            </Section>

            <Text style={paragraph}>
              {t.greeting} {name},
            </Text>

            <Text style={paragraph}>{t.intro}</Text>

            <Section style={businessBox}>
              <Text style={businessLabel}>{t.businessLabel}</Text>
              <Text style={businessNameText}>{businessName}</Text>
            </Section>

            <Text style={paragraph}>
              <strong>{t.whatThisMeans}</strong>
            </Text>

            <ul style={list}>
              <li style={listItem}>{t.benefit1}</li>
              <li style={listItem}>{t.benefit2}</li>
              <li style={listItem}>{t.benefit3}</li>
              <li style={listItem}>{t.benefit4}</li>
            </ul>

            <Text style={paragraph}>
              <strong>{t.getStarted}</strong>
            </Text>

            <Text style={paragraph}>{t.addProducts}</Text>

            <Section style={buttonContainer}>
              <Link href={`${baseUrl}/products`} style={buttonPrimary}>
                {t.startSelling}
              </Link>
              <Link href={`${baseUrl}/marketplace`} style={buttonSecondary}>
                {t.viewMarketplace}
              </Link>
            </Section>

            <Hr style={hr} />

            <Text style={paragraph}>{t.questions}</Text>

            <Text style={paragraph}>
              {t.congrats}
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

const successBanner = {
  textAlign: "center" as const,
  margin: "32px 0 16px",
};

const checkmark = {
  backgroundColor: "#10b981",
  borderRadius: "50%",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "32px",
  height: "64px",
  lineHeight: "64px",
  margin: "0 auto 16px",
  width: "64px",
};

const heading = {
  color: "#10b981",
  fontSize: "24px",
  fontWeight: "bold" as const,
  margin: "0",
};

const paragraph = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "16px 0",
};

const businessBox = {
  backgroundColor: "#ecfdf5",
  borderRadius: "8px",
  padding: "16px 24px",
  margin: "24px 0",
  textAlign: "center" as const,
};

const businessLabel = {
  color: "#059669",
  fontSize: "12px",
  fontWeight: "bold" as const,
  margin: "0 0 4px 0",
  textTransform: "uppercase" as const,
};

const businessNameText = {
  color: "#065f46",
  fontSize: "20px",
  fontWeight: "bold" as const,
  margin: "0",
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

const buttonPrimary = {
  backgroundColor: "#10b981",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "bold" as const,
  padding: "12px 32px",
  textDecoration: "none",
  marginRight: "12px",
};

const buttonSecondary = {
  backgroundColor: "#ffffff",
  border: "2px solid #e5e7eb",
  borderRadius: "8px",
  color: "#0f172a",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "bold" as const,
  padding: "10px 32px",
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

export default BusinessVerifiedEmail;
