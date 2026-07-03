# rep-attestation-frontend

Frontend for making attestations related to the OMA3 App Registry. Built with Next.js, TypeScript, and Reown AppKit for seamless wallet integration.

## License and Participation

- Code is licensed under [MIT](./LICENSE)
- Contributor terms are defined in [CONTRIBUTING.md](./CONTRIBUTING.md)

**Licensing Notice**  
This initial version (v1) is released under MIT to maximize transparency and adoption.  

OMA3 may license future versions of this reference implementation under different terms (for example, the Business Source License, BSL) if forks or incompatible implementations threaten to fragment the ecosystem or undermine the sustainability of OMA3.  

OMA3 standards (such as specifications and schemas) will always remain open and are governed by [OMA3’s IPR Policy](https://www.oma3.org/intellectual-property-rights-policy).

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

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your values (see Environment Variables below)
```

> **Deploying to Vercel?** For environment variable values, domain configuration, and Vercel project setup, see the [Deployment Guide](https://github.com/oma3dao/omatrust-docs/blob/main/operations/deployment-rep-attestation.md) (Section 5). This README covers local development workflow.

4. Run the development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Wallet Integration Setup

### Environment Variables

Create a `.env.local` file in the root directory with the following variable:

```bash
# ThirdWeb Configuration (required)
# Get from https://thirdweb.com/dashboard
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_thirdweb_client_id
```

### Getting a ThirdWeb Client ID

1. Go to [ThirdWeb Dashboard](https://thirdweb.com/dashboard)
2. Create an account or sign in
3. Create a new project or select an existing one
4. Copy your Client ID from the project settings
5. Add it to your `.env.local` file

### Features Enabled

- **Social Login**: Google, Facebook, Apple, Discord, and more
- **Email Login**: Direct email authentication with OTP
- **Wallet Connect**: MetaMask, Coinbase Wallet, WalletConnect mobile wallets
- **Built-in Chain Switching**: Automatic network switching for supported chains

### Usage

The wallet integration provides:
- Single `ConnectButton` with all login options in a modal
- ThirdWeb's unified state management hooks
- Automatic network switching for supported chains
- Graceful fallbacks for unsupported wallets

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── api/               # Server-side API routes
│   │   ├── controller-witness-proxy/  # CORS proxy for controller witness
│   │   └── eas/           # EAS delegated attestation + nonce endpoints
│   ├── attest/            # Attestation creation pages
│   ├── dashboard/         # User dashboard (subjects, keys, attestations)
│   ├── publish/           # Publish attestation pages (by type)
│   ├── account/           # Account management
│   └── client.ts          # ThirdWeb client configuration
├── components/            # Reusable React components
│   ├── ui/               # shadcn/ui base components
│   ├── dashboard/        # Dashboard-specific components
│   ├── home/             # Landing page components
│   └── ...               # Form inputs, DID inputs, auth, attestation views
├── config/                # Configuration files
│   ├── chains.ts         # Chain definitions (OMAChain mainnet/testnet/devnet)
│   ├── schemas.ts        # Attestation schema definitions (generated)
│   ├── publish-categories.ts  # Publish workflow categories
│   ├── subsidized-schemas.ts  # Schemas eligible for gas subsidy
│   └── ...               # Wallets, social platforms, home workflows
├── lib/                   # Utility functions and business logic
│   ├── server/           # Server-only code (EAS routes, delegate key)
│   ├── utils/caip10/     # CAIP-10 address parsing and validation
│   ├── blockchain.ts     # Wallet hooks and chain management
│   ├── eas.ts            # EAS attestation helpers
│   ├── omatrust-backend.ts  # Backend API client
│   ├── service-urls.ts   # Chain-prefixed service URL derivation
│   └── service.ts        # High-level attestation service layer
└── app/globals.css        # Global styles (Tailwind)
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run update-schemas` - Update schemas from JSON files

## Schema Management

This project uses JSON schemas to generate TypeScript attestation forms. Schema definitions live in the `rep-attestation-tools-evm-solidity` repository under `schemas-json/`. For the full authoring guide — OMA3 extensions (`x-oma3-*`), best practices, and example structures — see that repo's `schemas-json/README.md`.

### Updating Schemas

When schema definitions change in `rep-attestation-tools-evm-solidity`, you need to regenerate the frontend schemas:

```bash
# 1. Generate EAS objects (run from the tools repo)
cd ../rep-attestation-tools-evm-solidity
npx hardhat generate-eas-object --schema schemas-json/<schema-name>.schema.json --network omachainTestnet

# 2. Update this frontend's schemas.ts
cd ../rep-attestation-frontend
npm run update-schemas ../rep-attestation-tools-evm-solidity

# 3. Copy to app-registry-frontend (schemas.ts must stay in sync)
cp src/config/schemas.ts ../app-registry-frontend/src/config/schemas.ts
```

If you also deployed the schema on-chain, the deployment UIDs and block numbers are picked up automatically from the `generated/*.deployed.*.json` files. See the tools repo README for the full deployment workflow.

### What the Script Does

1. Reads all `*.schema.json` files from the tools repo's `schemas-json/` directory
2. Reads EAS schema strings from `generated/*.eas.json` files
3. Reads deployment UIDs and block numbers from `generated/*.deployed.*.json` files
4. Transforms JSON schemas to TypeScript UI schemas, respecting `x-oma3-*` extensions
5. Generates `src/config/schemas.ts` with field definitions, deployed UIDs, and metadata

### Key Schema Extensions

The script processes `x-oma3-*` extension fields from the JSON schemas (e.g., `x-oma3-skip-reason`, `x-oma3-subtype`, `x-oma3-default`, `x-oma3-render`). For the full reference on all supported extensions, see [`schemas-json/README.md`](https://github.com/oma3dao/rep-attestation-tools-evm-solidity/blob/main/schemas-json/README.md) in the tools repository.

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

---

## Additional Configuration

### Blockchain Networks

The application targets:
- **OMAChain Mainnet** (chain ID 6623) — Production
- **OMAChain Testnet** (chain ID 66238) — Development and testing
- **OMAChain Devnet** (chain ID 66233) — Local development

Network configuration is in [`src/config/chains.ts`](./src/config/chains.ts). The active chain is determined by the `NEXT_PUBLIC_ACTIVE_CHAIN` environment variable, not the user's wallet.

### Attestation Services

Currently integrated:
- **EAS (Ethereum Attestation Service)** — Deployed on all OMAChain networks
- **Delegated attestations** — Server pays gas for subsidized schemas via Thirdweb Server Wallet (prod/test) or raw key (dev/preview)

For delegate wallet addresses and signing configuration details, see the [Deployment Guide](https://github.com/oma3dao/omatrust-docs/blob/main/operations/deployment-rep-attestation.md) (Sections 3 and 9).

### Local Development with Delegated Attestations

For local dev, set a raw private key in `.env.local`:

```bash
# Private key for EAS delegate wallet (local dev only)
EAS_DELEGATE_PRIVATE_KEY=0x...

# Optional: max gas per transaction (default: 300000)
MAX_GAS_PER_TX=300000
```

To generate a throwaway dev key:
```bash
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))" > ~/.ssh/eas-delegate-key
chmod 600 ~/.ssh/eas-delegate-key
```

### Troubleshooting

#### "No client ID provided" Error
- Make sure you have `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` in your `.env.local` file
- Verify the client ID is correct and active in your ThirdWeb dashboard

#### Wallet Connection Issues
- Try refreshing the page
- Clear browser cache and cookies
- Ensure you're connected to OMAChain (the app auto-switches networks)

#### Transaction Failures
- Check that the delegate wallet has sufficient OMA for gas
- Verify you're connected to the correct network
- Check that the attestation schema is deployed on the active chain
