import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agent Studio OS",
  description: "Multi-agent orchestration GUI — create, manage, and deploy AI agents from your laptop",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark h-full`} suppressHydrationWarning>
      <body className="min-h-full flex bg-background text-foreground antialiased transition-colors duration-300">
        <ThemeProvider>
          <Sidebar />
          <main className="flex-1 min-w-0 h-screen overflow-y-auto flex flex-col transition-all duration-300">
            <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex-1 flex flex-col min-h-0">
              {children}
            </div>
          </main>
          <Toaster
            position="top-right"
            toastOptions={{
              className: "border border-border glass text-foreground shadow-lg backdrop-blur-xl",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
