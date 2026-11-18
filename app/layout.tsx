import type { Metadata } from "next";
import { Archivo, Azeret_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-archivo",
  display: "swap",
});

const azeret = Azeret_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-azeret",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "QZORO",
  title: {
    default: "QZORO — XAUUSD chart review & risk discipline",
    template: "%s — QZORO",
  },
  description:
    "QZORO turns a gold chart screenshot into an objective trade plan, the correct position size, and daily limits that keep the account alive.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${archivo.variable} ${azeret.variable}`}>
      <body>{children}</body>
    </html>
  );
}
