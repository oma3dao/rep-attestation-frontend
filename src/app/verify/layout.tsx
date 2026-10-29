import type { Metadata } from "next"

const title = "OMATrust Verification"
const description =
  "Search trust data on identifiers such as URLs, wallet addresses, signing keys, and files."

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    url: "/verify",
    images: [
      {
        url: "/oma3-logo.png",
        width: 158,
        height: 42,
        alt: "OMA3",
      },
    ],
  },
  twitter: {
    card: "summary",
    title,
    description,
    images: ["/oma3-logo.png"],
  },
}

export default function VerifyLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
