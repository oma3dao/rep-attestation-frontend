import React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Header } from "@/components/header"
import { Providers } from "@/components/providers"
import { PreAlphaBanner } from "@/components/pre-alpha-banner"
import Script from "next/script"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "OMA3 Attestation Portal",
  description: "Create and manage attestations for the OMA3 App Registry",
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
      <body className={inter.className}>
        <Providers>
        <PreAlphaBanner />
        <Header />
        <main className="min-h-screen bg-gray-50">{children}</main>
        </Providers>
      </body>
    </html>
  )
}