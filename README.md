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

3. Set up environment variables (see [Environment Setup Guide](#environment-setup-guide) below)

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

---

## Environment Setup Guide

This project uses separate toggles for two different concerns:

1. **Web3Auth Environment** (devnet vs mainnet) - Controls Web3Auth service billing
2. **Blockchain Networks** (testnet vs mainnet) - Controls which chains users connect to *(TODO: Not implemented yet)*

### Quick Setup

#### 1. Create `.env.local` file with these variables:

```bash
# Web3Auth Service Configuration
# ==============================

# Development Environment (devnet) - FREE TESTING
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID_DEVNET=your_devnet_client_id_here

# Production Environment (mainnet) - PAID FEATURES  
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID_MAINNET=your_mainnet_client_id_here

# Web3Auth Environment Toggle (defaults to devnet if not set)
# NEXT_PUBLIC_WEB3AUTH_ENV=devnet   # Use devnet (free)
# NEXT_PUBLIC_WEB3AUTH_ENV=mainnet  # Use mainnet (paid)

# WalletConnect Configuration
# ===========================
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here
```

#### 2. Get Your Client IDs

1. **Web3Auth Devnet (FREE)**: 
   - Go to https://dashboard.web3auth.io
   - Create a new project
   - Select **Devnet** environment
   - Copy the Client ID → use for `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID_DEVNET`

2. **Web3Auth Mainnet (PAID)**: 
   - Go to https://dashboard.web3auth.io
   - Create a new project 
   - Select **Mainnet** environment
   - Copy the Client ID → use for `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID_MAINNET`

3. **WalletConnect**:
   - Go to https://cloud.walletconnect.com
   - Create a project
   - Copy Project ID → use for `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

### Configuration Details

#### Web3Auth Environment
Controls which Web3Auth infrastructure to use:

- **devnet** (default): Free testing, full features available
- **mainnet**: Paid service, required for production

#### Blockchain Networks  
*(Currently defaults to testnet chains only)*

- **Current**: BSC Testnet, Sepolia
- **TODO**: Add toggle to switch to BSC Mainnet, Ethereum Mainnet

### Environment Switching

#### Web3Auth Service
- **Default**: Uses **devnet** (free)
- **To use mainnet**: Set `NEXT_PUBLIC_WEB3AUTH_ENV=mainnet` (requires paid plan)

#### Blockchain Networks
- **Current**: Always uses testnet chains
- **Future**: Will add `NEXT_PUBLIC_BLOCKCHAIN_ENV` toggle

### Troubleshooting

#### "Premium Plan Required" Error
- Make sure you're using **devnet**: Don't set `NEXT_PUBLIC_WEB3AUTH_ENV=mainnet`
- Check your Web3Auth project is configured for **devnet**
- Verify you're using the correct devnet client ID

#### Missing Environment Variables
The app will show clear error messages about which variables are missing.

#### Adding New Chains
Edit `src/lib/web3auth.ts` and add chains to the `ALL_CHAINS` object with the appropriate `environment` field.

#### Thirdweb

1. **Add ThirdWeb Client ID** to `.env.local`:
```bash
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_thirdweb_client_id
NEXT_PUBLIC_WALLET_PROVIDER=thirdweb
```

2. **That's it!** The header automatically shows the appropriate connect button with social login options.

### Getting Your ThirdWeb Client ID

1. Go to [thirdweb.com](https://thirdweb.com)
2. Create an account or sign in
3. Go to your dashboard  
4. Create a new project or select an existing one
5. Copy your Client ID from the project settings
6. Add it to your `.env.local` file

### Provider Switching

Switch between wallet providers by changing the environment variable:

```bash
# Use ThirdWeb (with social login)
NEXT_PUBLIC_WALLET_PROVIDER=thirdweb

# Use Web3Auth (with wallet abstraction)
NEXT_PUBLIC_WALLET_PROVIDER=web3auth
```
