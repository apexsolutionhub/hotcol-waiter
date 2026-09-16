import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "HotCol Waiter",
  description: "Floor ordering for HotCol Café and Restaurant waiters",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("dark h-full antialiased", manrope.variable, fraunces.variable)}
      suppressHydrationWarning
    >
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        forcedTheme="dark"
        enableSystem={false}
      >
        <body className="flex min-h-full flex-col font-sans">
          <TooltipProvider>
            {children}
            <Toaster position="top-right" richColors theme="dark" />
          </TooltipProvider>
        </body>
      </ThemeProvider>
    </html>
  );
}
