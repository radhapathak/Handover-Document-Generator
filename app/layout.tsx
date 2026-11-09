import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Handover Document Generator",
  description: "Turns ServiceNow module configuration into a knowledge-transfer document and flow diagram.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f7f7f8", color: "#1a1a1a" }}>{children}</body>
    </html>
  );
}
