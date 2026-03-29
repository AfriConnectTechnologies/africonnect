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

interface BusinessRejectedEmailProps {
  businessName: string;
  ownerName?: string;
  locale?: string;
}

const translations = {
  en: {
    preview: "Update required for your business registration",
    heading: "Business Registration Update Required",
    greeting: "Hello",
    intro: "We've reviewed your business registration on AfriConnect and unfortunately, we were unable to verify it at this time.",
    businessLabel: "Business:",
    whyThisHappens: "Why this might happen:",
    reason1: "Incomplete or inaccurate business information",
    reason2: "Unable to verify business legitimacy",
    reason3: "Business category doesn't match the provided details",
    reason4: "Missing required documentation",
    whatYouCanDo: "What you can do:",
    action1: "Review and update your business profile with accurate information",
    action2: "Ensure all required fields are filled correctly",
    action3: "Make sure your business details are verifiable",
    updateProfile: "Update Business Profile",
    contactSupport: "Contact Support",
    supportText: "If you believe this was a mistake or need assistance, please contact our support team.",
    reapply: "Once you've updated your information, your business will automatically be submitted for review again.",
    thanks: "Thank you for your understanding.",
    team: "The AfriConnect Team",
  },
  am: {
    preview: "ለንግድ ምዝገባዎ ማዘመን ያስፈልጋል",
    heading: "የንግድ ምዝገባ ማዘመን ያስፈልጋል",
    greeting: "ሰላም",
    intro: "የንግድ ምዝገባዎን በAfriConnect ላይ ገምግመናል እና በሚያሳዝን ሁኔታ፣ በዚህ ጊዜ ማረጋገጥ አልቻልንም።",
    businessLabel: "ንግድ፡",
    whyThisHappens: "ይህ ለምን ሊሆን ይችላል፡",
    reason1: "ያልተሟላ ወይም ትክክል ያልሆነ የንግድ መረጃ",
    reason2: "የንግድ ሕጋዊነትን ማረጋገጥ አልተቻለም",
    reason3: "የንግድ ምድብ ከቀረቡት ዝርዝሮች ጋር አይዛመድም",
    reason4: "አስፈላጊ ሰነዶች ይጎድላሉ",
    whatYouCanDo: "ምን ማድረግ ይችላሉ፡",
    action1: "የንግድ መገለጫዎን በትክክለኛ መረጃ ይገምግሙ እና ያዘምኑ",
    action2: "ሁሉም አስፈላጊ መስኮች በትክክል መሞላታቸውን ያረጋግጡ",
    action3: "የንግድ ዝርዝሮችዎ ሊረጋገጡ የሚችሉ መሆናቸውን ያረጋግጡ",
    updateProfile: "የንግድ መገለጫ ያዘምኑ",
    contactSupport: "ድጋፍን ያግኙ",
    supportText: "ይህ ስህተት ነው ብለው ካመኑ ወይም እርዳታ ከፈለጉ፣ እባክዎ የድጋፍ ቡድናችንን ያግኙ።",
    reapply: "መረጃዎን ካዘመኑ በኋላ ንግድዎ ለግምገማ በራስ-ሰር እንደገና ይገባል።",
    thanks: "ስለተረዱ እናመሰግናለን።",
    team: "የAfriConnect ቡድን",
  },
  sw: {
    preview: "Sasisho linahitajika kwa usajili wa biashara yako",
    heading: "Sasisho la Usajili wa Biashara Linahitajika",
    greeting: "Habari",
    intro: "Tumekagua usajili wa biashara yako kwenye AfriConnect na kwa bahati mbaya, hatukuweza kuithibitisha kwa wakati huu.",
    businessLabel: "Biashara:",
    whyThisHappens: "Kwa nini hii inaweza kutokea:",
    reason1: "Maelezo ya biashara hayakukamilika au si sahihi",
    reason2: "Haikuwezekana kuthibitisha uhalali wa biashara",
    reason3: "Kategoria ya biashara hailingani na maelezo yaliyotolewa",
    reason4: "Nyaraka zinazohitajika zinakosekana",
    whatYouCanDo: "Unachoweza kufanya:",
    action1: "Kagua na sasisha wasifu wa biashara yako na maelezo sahihi",
    action2: "Hakikisha sehemu zote zinazohitajika zimejazwa kwa usahihi",
    action3: "Hakikisha maelezo ya biashara yako yanaweza kuthibitishwa",
    updateProfile: "Sasisha Wasifu wa Biashara",
    contactSupport: "Wasiliana na Msaada",
    supportText: "Ikiwa unadhani hii ilikuwa kosa au unahitaji msaada, tafadhali wasiliana na timu yetu ya msaada.",
    reapply: "Ukishasisha maelezo yako, biashara yako itawasilishwa tena kiotomatiki kwa ukaguzi.",
    thanks: "Asante kwa kuelewa.",
    team: "Timu ya AfriConnect",
  },
};

export function BusinessRejectedEmail({
  businessName,
  ownerName,
  locale = "en",
}: BusinessRejectedEmailProps) {
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
            <Section style={warningBanner}>
              <Text style={warningIcon}>!</Text>
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
              <strong>{t.whyThisHappens}</strong>
            </Text>

            <ul style={list}>
              <li style={listItem}>{t.reason1}</li>
              <li style={listItem}>{t.reason2}</li>
              <li style={listItem}>{t.reason3}</li>
              <li style={listItem}>{t.reason4}</li>
            </ul>

            <Text style={paragraph}>
              <strong>{t.whatYouCanDo}</strong>
            </Text>

            <ol style={list}>
              <li style={listItem}>{t.action1}</li>
              <li style={listItem}>{t.action2}</li>
              <li style={listItem}>{t.action3}</li>
            </ol>

            <Section style={buttonContainer}>
              <Link href={`${baseUrl}/business/profile`} style={buttonPrimary}>
                {t.updateProfile}
              </Link>
            </Section>

            <Text style={noteText}>{t.reapply}</Text>

            <Hr style={hr} />

            <Text style={paragraph}>{t.supportText}</Text>

            <Section style={buttonContainer}>
              <Link href={`mailto:support@africonnect.com`} style={buttonSecondary}>
                {t.contactSupport}
              </Link>
            </Section>

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

const warningBanner = {
  textAlign: "center" as const,
  margin: "32px 0 16px",
};

const warningIcon = {
  backgroundColor: "#f59e0b",
  borderRadius: "50%",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "32px",
  fontWeight: "bold" as const,
  height: "64px",
  lineHeight: "64px",
  margin: "0 auto 16px",
  width: "64px",
};

const heading = {
  color: "#92400e",
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
  backgroundColor: "#fef3c7",
  borderRadius: "8px",
  padding: "16px 24px",
  margin: "24px 0",
  textAlign: "center" as const,
};

const businessLabel = {
  color: "#92400e",
  fontSize: "12px",
  fontWeight: "bold" as const,
  margin: "0 0 4px 0",
  textTransform: "uppercase" as const,
};

const businessNameText = {
  color: "#78350f",
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

const noteText = {
  backgroundColor: "#f0fdf4",
  borderRadius: "8px",
  color: "#166534",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "24px 0",
  padding: "16px",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const buttonPrimary = {
  backgroundColor: "#0f172a",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "bold" as const,
  padding: "12px 32px",
  textDecoration: "none",
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

export default BusinessRejectedEmail;
