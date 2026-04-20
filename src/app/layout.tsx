import React from "react"
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
  title: "OMA3 Attestation Portal",
  description: "Create and manage attestations for the OMA3 App Registry",
  keywords: ["attestations", "OMA3", "blockchain", "certifications", "reviews", "security", "web3"],
  authors: [{ name: "OMA3" }],
  openGraph: {
    title: "OMA3 Attestation Portal",
    description: "Create and manage attestations for the OMA3 App Registry",
    type: "website",
    url: "https://reputation.omatrust.org",
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
        <Header />
        <main className="min-h-screen bg-transparent">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
