import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { GlobalCockpitProvider } from "@/components/layout/global-cockpit-provider";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Agent Studio OS",
  description: "Production-Grade Autonomous AI Agent Platform for Business & Daily Life Automation",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Agent OS",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex bg-background text-foreground antialiased transition-colors duration-200">
        <ClerkProvider
          appearance={{
            elements: {
              formButtonPrimary: "bg-primary hover:bg-primary/90",
              card: "bg-card border-border",
            },
          }}
        >
          <ThemeProvider>
            <GlobalCockpitProvider>
              <Sidebar />
              <main className="flex-1 min-w-0 h-screen overflow-y-auto flex flex-col transition-all duration-200">
                <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5 flex-1 flex flex-col min-h-0">
                  {children}
                </div>
              </main>
              <Toaster
                position="top-right"
                toastOptions={{
                  className: "border border-border bg-card text-foreground shadow-sm rounded-xl",
                }}
              />
            </GlobalCockpitProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
