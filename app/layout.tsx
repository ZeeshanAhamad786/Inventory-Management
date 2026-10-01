import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DatabaseProvider } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aeroswift Parts Control",
  description: "Workshop jobs, GRN receiving and parts stock control",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        <DatabaseProvider>
          {children}
          <Toaster />
        </DatabaseProvider>
      </body>
    </html>
  );
}
