import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/shared/toast";

export const metadata: Metadata = {
  title: "HandoverAI",
  description: "AI-powered knowledge transfer and handover documentation, backed by ServiceNow.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
