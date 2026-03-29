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

interface BusinessRegisteredEmailProps {
  businessName: string;
  ownerName?: string;
  category: string;
  country: string;
  locale?: string;
}

const translations = {
  en: {
    preview: "Your business registration has been submitted",
    heading: "Business Registration Received",
    greeting: "Hello",
    intro: "Thank you for registering your business on AfriConnect!",
    details: "Registration Details:",
    businessName: "Business Name",
    category: "Category",
    country: "Country",
    status: "Status",
    pending: "Pending Review",
    nextSteps: "What happens next?",
    step1: "Our team will review your business registration",
    step2: "You'll receive an email once your business is verified",
    step3: "Once verified, you can start listing products and receiving orders",
    reviewTime: "Review typically takes 1-2 business days.",
    viewProfile: "View Business Profile",
    questions: "If you have any questions, please contact our support team.",
    thanks: "Thank you for choosing AfriConnect!",
    team: "The AfriConnect Team",
  },
  am: {
    preview: "የንግድ ምዝገባዎ ገብቷል",
    heading: "የንግድ ምዝገባ ተቀብሏል",
    greeting: "ሰላም",
    intro: "ንግድዎን በAfriConnect ስለመዘገቡ እናመሰግናለን!",
    details: "የምዝገባ ዝርዝሮች፡",
    businessName: "የንግድ ስም",
    category: "ምድብ",
    country: "ሀገር",
    status: "ሁኔታ",
    pending: "በመገምገም ላይ",
    nextSteps: "ቀጥሎ ምን ይሆናል?",
    step1: "ቡድናችን የንግድ ምዝገባዎን ይገመግማል",
    step2: "ንግድዎ ሲረጋገጥ ኢሜይል ይደርስዎታል",
    step3: "ከተረጋገጠ በኋላ ምርቶችን መዘርዘር እና ትዕዛዞችን መቀበል ይችላሉ",
    reviewTime: "ግምገማ በተለምዶ ከ1-2 የስራ ቀናት ይወስዳል።",
    viewProfile: "የንግድ መገለጫ ይመልከቱ",
    questions: "ማንኛውም ጥያቄ ካለዎት፣ የድጋፍ ቡድናችንን ያግኙ።",
    thanks: "AfriConnectን ስለመረጡ እናመሰግናለን!",
    team: "የAfriConnect ቡድን",
  },
  sw: {
    preview: "Usajili wa biashara yako umewasilishwa",
    heading: "Usajili wa Biashara Umepokelewa",
    greeting: "Habari",
    intro: "Asante kwa kusajili biashara yako kwenye AfriConnect!",
    details: "Maelezo ya Usajili:",
    businessName: "Jina la Biashara",
    category: "Kategoria",
    country: "Nchi",
    status: "Hali",
    pending: "Inasubiri Ukaguzi",
    nextSteps: "Nini kinatokea baadaye?",
    step1: "Timu yetu itakagua usajili wa biashara yako",
    step2: "Utapokea barua pepe biashara yako itakapothibitishwa",
    step3: "Baada ya kuthibitishwa, unaweza kuanza kuorodhesha bidhaa na kupokea maagizo",
    reviewTime: "Ukaguzi kwa kawaida huchukua siku 1-2 za kazi.",
    viewProfile: "Angalia Wasifu wa Biashara",
    questions: "Ikiwa una maswali yoyote, wasiliana na timu yetu ya msaada.",
    thanks: "Asante kwa kuchagua AfriConnect!",
    team: "Timu ya AfriConnect",
  },
};

export function BusinessRegisteredEmail({
  businessName,
  ownerName,
  category,
  country,
  locale = "en",
}: BusinessRegisteredEmailProps) {
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
            <Heading style={heading}>{t.heading}</Heading>

            <Text style={paragraph}>
              {t.greeting} {name},
            </Text>

            <Text style={paragraph}>{t.intro}</Text>

            <Section style={detailsBox}>
              <Text style={detailsHeading}>{t.details}</Text>
              <table style={detailsTable}>
                <tbody>
                  <tr>
                    <td style={detailLabel}>{t.businessName}:</td>
                    <td style={detailValue}>{businessName}</td>
                  </tr>
                  <tr>
                    <td style={detailLabel}>{t.category}:</td>
                    <td style={detailValue}>{category}</td>
                  </tr>
                  <tr>
                    <td style={detailLabel}>{t.country}:</td>
                    <td style={detailValue}>{country}</td>
                  </tr>
                  <tr>
                    <td style={detailLabel}>{t.status}:</td>
                    <td style={detailValue}>
                      <span style={statusBadge}>{t.pending}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Text style={paragraph}>
              <strong>{t.nextSteps}</strong>
            </Text>

            <ol style={list}>
              <li style={listItem}>{t.step1}</li>
              <li style={listItem}>{t.step2}</li>
              <li style={listItem}>{t.step3}</li>
            </ol>

            <Text style={reviewNote}>{t.reviewTime}</Text>

            <Section style={buttonContainer}>
              <Link href={`${baseUrl}/business/profile`} style={button}>
                {t.viewProfile}
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

const detailsBox = {
  backgroundColor: "#f6f9fc",
  borderRadius: "8px",
  padding: "24px",
  margin: "24px 0",
};

const detailsHeading = {
  color: "#0f172a",
  fontSize: "14px",
  fontWeight: "bold" as const,
  margin: "0 0 16px 0",
  textTransform: "uppercase" as const,
};

const detailsTable = {
  width: "100%",
  borderCollapse: "collapse" as const,
};

const detailLabel = {
  color: "#8898aa",
  fontSize: "14px",
  padding: "8px 16px 8px 0",
  verticalAlign: "top" as const,
  width: "40%",
};

const detailValue = {
  color: "#0f172a",
  fontSize: "14px",
  fontWeight: "500" as const,
  padding: "8px 0",
  verticalAlign: "top" as const,
};

const statusBadge = {
  backgroundColor: "#fef3c7",
  color: "#92400e",
  borderRadius: "4px",
  fontSize: "12px",
  fontWeight: "bold" as const,
  padding: "4px 8px",
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

const reviewNote = {
  color: "#8898aa",
  fontSize: "14px",
  fontStyle: "italic" as const,
  margin: "16px 0",
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

export default BusinessRegisteredEmail;
