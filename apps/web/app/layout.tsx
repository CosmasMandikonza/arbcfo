import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Providers } from "./providers";
import { ConditionalLayout } from "./components/conditional-layout";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "ArbCFO — Permissionless Risk Oracle on Arbitrum",
  description: "On-chain risk intelligence for autonomous agent wallets. Built with Rust/WASM on Arbitrum Stylus.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans">
        <Providers>
          <ConditionalLayout>{children}</ConditionalLayout>
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: "card text-ink",
              duration: 4000,
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
