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

interface AdminNewBusinessEmailProps {
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  category: string;
  country: string;
  city?: string;
}

export function AdminNewBusinessEmail({
  businessName,
  ownerName,
  ownerEmail,
  category,
  country,
  city,
}: AdminNewBusinessEmailProps) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://africonnect.africa.com";

  return (
    <Html>
      <Head />
      <Preview>New Business Registration: {businessName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={logo}>AfriConnect Admin</Heading>
          </Section>

          <Section style={content}>
            <Section style={alertBanner}>
              <Text style={alertIcon}>🏢</Text>
              <Heading style={heading}>New Business Registration</Heading>
            </Section>

            <Text style={paragraph}>
              A new business has registered on AfriConnect and is awaiting your review.
            </Text>

            <Section style={detailsBox}>
              <Text style={detailsHeading}>Business Details</Text>
              <table style={detailsTable}>
                <tbody>
                  <tr>
                    <td style={detailLabel}>Business Name:</td>
                    <td style={detailValue}>{businessName}</td>
                  </tr>
                  <tr>
                    <td style={detailLabel}>Category:</td>
                    <td style={detailValue}>{category}</td>
                  </tr>
                  <tr>
                    <td style={detailLabel}>Location:</td>
                    <td style={detailValue}>
                      {city ? `${city}, ${country}` : country}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Section style={detailsBox}>
              <Text style={detailsHeading}>Owner Information</Text>
              <table style={detailsTable}>
                <tbody>
                  <tr>
                    <td style={detailLabel}>Name:</td>
                    <td style={detailValue}>{ownerName || "Not provided"}</td>
                  </tr>
                  <tr>
                    <td style={detailLabel}>Email:</td>
                    <td style={detailValue}>
                      <Link href={`mailto:${ownerEmail}`} style={emailLink}>
                        {ownerEmail}
                      </Link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Text style={paragraph}>
              Please review this business registration and take appropriate action.
            </Text>

            <Section style={buttonContainer}>
              <Link href={`${baseUrl}/admin/businesses`} style={button}>
                Review Business
              </Link>
            </Section>

            <Hr style={hr} />

            <Text style={footerNote}>
              This is an automated notification from the AfriConnect platform.
              You are receiving this because you are registered as an administrator.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              AfriConnect Admin Notifications
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
  backgroundColor: "#7c3aed",
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

const alertBanner = {
  textAlign: "center" as const,
  margin: "32px 0 16px",
};

const alertIcon = {
  fontSize: "48px",
  margin: "0 0 16px 0",
};

const heading = {
  color: "#0f172a",
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
  width: "35%",
};

const detailValue = {
  color: "#0f172a",
  fontSize: "14px",
  fontWeight: "500" as const,
  padding: "8px 0",
  verticalAlign: "top" as const,
};

const emailLink = {
  color: "#7c3aed",
  textDecoration: "none",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#7c3aed",
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

const footerNote = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "16px 0",
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

export default AdminNewBusinessEmail;
