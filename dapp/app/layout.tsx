import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./contexts/AuthContext";
import PageHeader from "./components/PageHeader";
import TaglineBanner from "./components/TaglineBanner";
import PageFooter from "./components/PageFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clarity Chain",
  description: "Anti-Corruption Donation Tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen !bg-gray-950 flex flex-col`} 
          suppressHydrationWarning
        >
          <main className="bg-gray-950 text-white">
            <PageHeader />
            <TaglineBanner />
            { children }
          </main>
          <PageFooter />
        </body>
      </html>
    </AuthProvider>
  );
}
