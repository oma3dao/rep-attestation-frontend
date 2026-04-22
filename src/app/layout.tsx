import React, { Suspense } from "react"
import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { Header } from "@/components/header"
import { Providers } from "@/components/providers"
import { PreAlphaBanner } from "@/components/pre-alpha-banner"
import Script from "next/script"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
})

export const metadata: Metadata = {
  title: "OMATrust Portal",
  description: "Publish trust data on services or manage trust for your own with OMATrust.",
  keywords: ["OMATrust", "trust data", "reviews", "certifications", "security", "service trust", "web3"],
  authors: [{ name: "OMA3" }],
  openGraph: {
    title: "OMATrust Portal",
    description: "Publish trust data on services or manage trust for your own with OMATrust.",
    type: "website",
    url: "https://app.omatrust.org",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=RY5MAa"
          strategy="afterInteractive"
        />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <Providers>
        <PreAlphaBanner />
        <Suspense fallback={null}>
          <Header />
        </Suspense>
        <main className="min-h-screen bg-transparent">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
