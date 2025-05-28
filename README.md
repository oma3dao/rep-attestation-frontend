# rep-attestation-frontend

Frontend for making attestations related to the OMA3 App Registry. Built with Next.js, TypeScript, and Reown AppKit for seamless wallet integration.

## License and Participation

- Code is licensed under [MIT](./LICENSE)
- Contributor terms are defined in [CONTRIBUTING.md](./CONTRIBUTING.md)

## Features

- **Schema-driven attestation forms** - Dynamic form generation from JSON schemas
- **Multiple attestation types** - Certification, Endorsement, Linked Identifier, User Review
- **Modern wallet integration** - Social logins, email authentication, and 500+ wallet support
- **Responsive design** - Built with Tailwind CSS and shadcn/ui components
- **Type-safe** - Full TypeScript support with proper validation

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, or pnpm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/oma3dao/rep-attestation-frontend.git
cd rep-attestation-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (see [Wallet Integration Setup](#wallet-integration-setup) below)

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Wallet Integration Setup

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# WalletConnect Project ID (required)
# Get from https://cloud.walletconnect.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# Optional: Web3Auth Client ID for additional social login features
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=your_web3auth_client_id_here
```

### Getting a WalletConnect Project ID

1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com)
2. Create a new project
3. Select "App" as the project type
4. Copy the Project ID from the project settings
5. Add it to your `.env.local` file

### Features Enabled

- **Social Login**: Google, X (Twitter), GitHub, Discord, Apple
- **Email Login**: Direct email authentication
- **Wallet Connect**: MetaMask, Coinbase Wallet, WalletConnect mobile wallets
- **Custom L2 Support**: Ready for OMA3 L2 integration

### Usage

The wallet integration provides:
- Single button that opens modal with all login options
- Unified state management via WAGMI hooks
- Automatic network switching for custom L2
- Graceful fallbacks for unsupported wallets

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── attest/            # Attestation creation pages
│   └── dashboard/         # User dashboard
├── components/            # Reusable React components
│   ├── ui/               # shadcn/ui components
│   ├── AttestationForm.tsx
│   ├── FieldRenderer.tsx
│   └── header.tsx
├── lib/                   # Utility functions and configurations
│   ├── schemas.ts        # Attestation schema definitions
│   ├── wagmi.ts          # Wallet configuration
│   └── useWallet.ts      # Wallet hooks
└── styles/               # Global styles
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

