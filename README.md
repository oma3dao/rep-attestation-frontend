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

3. Set up environment variables (see [Environment Setup Guide](#environment-setup-guide) below)

4. Run the development server:
```bash
npm run dev
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
- **Multi-chain Support**: BSC, Ethereum, and ready for custom L2 integration

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
│   ├── attest/            # Attestation creation pages
│   ├── dashboard/         # User dashboard
│   └── client.ts         # ThirdWeb client configuration
├── components/            # Reusable React components
│   ├── ui/               # shadcn/ui components
│   ├── AttestationForm.tsx
│   ├── FieldRenderer.tsx
│   ├── header.tsx
│   └── providers.tsx     # ThirdWeb provider setup
├── config/                # Configuration files
│   ├── schemas.ts        # Attestation schema definitions
│   └── attestation-services.ts # BAS and other service configs
├── lib/                   # Utility functions and configurations
│   ├── blockchain.ts     # Wallet hooks and chain management
│   ├── bas.ts           # Binance Attestation Service client
│   ├── service.ts       # High-level attestation service layer
│   └── schemas.ts       # Schema processing and utilities
└── styles/               # Global styles
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

The script processes `x-oma3-*` extension fields from the JSON schemas (e.g., `x-oma3-skip-reason`, `x-oma3-subtype`, `x-oma3-default`, `x-oma3-render`, `x-oma3-witness`). For the full reference on all supported extensions, see [`schemas-json/README.md`](https://github.com/oma3dao/rep-attestation-tools-evm-solidity/blob/main/schemas-json/README.md) in the tools repository.

### Controller Witness

Schemas that declare `x-oma3-witness` at the top level trigger an automatic, non-blocking call to the Controller Witness API after a successful attestation. Currently enabled on Key Binding and Linked Identifier schemas.

The witness call tries `dns-txt` first, then falls back to `did-json`. Failures are logged but never block the user flow. The endpoint is configurable via `NEXT_PUBLIC_CONTROLLER_WITNESS_URL` (defaults to `https://api.omatrust.org/v1/controller-witness`).

For details on the `x-oma3-witness` extension, see the tools repo's [`schemas-json/README.md`](https://github.com/oma3dao/rep-attestation-tools-evm-solidity/blob/main/schemas-json/README.md). For the API reference, see `developer-docs/docs/api/controller-witness.md`.

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

---

## Additional Configuration

### Blockchain Networks

The application targets:
- **OMAchain Testnet** (chain ID 66238) - For development and testing
- **OMAchain Mainnet** (chain ID 6623) - For production use (when available)

Legacy BSC and Ethereum chain configs remain in `chains.ts` but are not actively used for attestations.

### Attestation Services

Currently integrated:
- **EAS (Ethereum Attestation Service)** - Deployed on OMAchain Testnet
- **Delegated attestations** - Server pays gas for subsidized schemas
- **Controller Witness** - Automatic post-attestation witness for key-binding and linked-identifier schemas

### Delegated Attestations (Gas Subsidy)

For subsidized schemas, the server pays gas on behalf of users via EAS delegated attestations.

#### EAS Delegate Wallet Addresses

| Environment | Address | Chain |
|-------------|---------|-------|
| Testnet | `0xe9e676a6c1160f6df7b296da0d02677294ba9423` | OMAchain Testnet |
| Mainnet | TBD (Thirdweb Server Wallet) | OMAchain Mainnet |

**Funding:** The testnet delegate wallet needs OMA tokens to pay for gas. Fund it via the OMAchain testnet faucet or transfer from another wallet.

#### Environment Variables (Server-side)

```bash
# Testnet only - private key for EAS delegate wallet
EAS_DELEGATE_PRIVATE_KEY=0x...

# Optional: max gas per transaction (default: 300000)
MAX_GAS_PER_TX=300000
```

For local development, you can also create a key file:
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
- Ensure you're on a supported network (BSC or Ethereum)

#### Transaction Failures
- Check you have sufficient gas tokens (BNB for BSC, ETH for Ethereum)
- Verify you're connected to the correct network
- Check that the attestation schema is deployed on the current network
