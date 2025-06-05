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

This project uses JSON schemas to generate TypeScript attestation forms. When schema definitions change, you can update them using the provided script.

### Updating Schemas

```bash
# Update schemas from a directory
npm run update-schemas /path/to/schemas/folder

# Example: Update from a local schema repository
npm run update-schemas ../attestation-schemas/schemas
```

### What the Script Does

1. **Reads** all `*.json` files from the specified directory
2. **Skips** `test-deploy.schema.json` automatically 
3. **Transforms** JSON schemas to TypeScript UI schemas
4. **Overwrites** `src/config/schemas.ts` with the new definitions
5. **Maintains** existing export structure for components

### Schema File Processing

| Input File | Schema ID | Status |
|------------|-----------|---------|
| `certification.json` | `certification` | ✅ Processed |
| `endorsement.schema.json` | `endorsement` | ✅ Processed |
| `test-deploy.schema.json` | - | ⏭️ Skipped |
| `user-review.json` | `user-review` | ✅ Processed |

### UI Metadata

The script automatically adds UI-specific metadata for known schemas:

- **Icons** and **colors** for visual consistency
- **Smart placeholders** based on field names and types
- **Type transformations** (e.g., `boolean` → `enum` with Yes/No options)
- **Validation rules** for URI, integer, and datetime fields

For unknown schemas, default metadata is generated from the JSON schema title and description.

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

---

## Additional Configuration

### Blockchain Networks

The application currently supports:
- **BSC Testnet** (default) - For development and testing
- **BSC Mainnet** - For production use
- **Ethereum Sepolia** - Ethereum testnet
- **Ethereum Mainnet** - Ethereum mainnet

### Attestation Services

Currently integrated:
- **BAS (Binance Attestation Service)** - Available on BSC networks
- **Future**: EAS (Ethereum Attestation Service) and custom attestation services

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
