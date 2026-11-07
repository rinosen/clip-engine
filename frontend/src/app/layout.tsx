import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "AutoClipper.ai - Local-First AI Video Clipping Studio",
  description: "Turn 16:9 videos and YouTube URLs into viral 9:16 vertical shorts with local GPU acceleration and active speaker auto-layout.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090a0f] text-gray-100 flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}

