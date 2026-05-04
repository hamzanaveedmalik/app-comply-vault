import "~/styles/globals.css";

import { type Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Toaster } from "~/components/ui/sonner";

export const metadata: Metadata = {
  title: "Comply Vault",
  description: "Exam-ready client interaction records in <10 minutes",
  icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }],
};

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${dmSans.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
