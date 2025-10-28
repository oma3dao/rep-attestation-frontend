import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { useActiveAccount } from "thirdweb/react"
import { client } from "@/app/client"
import { ConnectButton as ThirdwebConnectButton } from "thirdweb/react"
import { 
  createWallet,
  inAppWallet,
  walletConnect
} from "thirdweb/wallets"
import { SUPPORTED_CHAINS } from "@/config/chains"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isConnectButton?: boolean
  connectButtonProps?: {
    label?: string
  }
}

// Extend the ThirdwebConnectButton props to include className
type ThirdwebConnectButtonProps = React.ComponentProps<typeof ThirdwebConnectButton> & {
  className?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isConnectButton = false, connectButtonProps, ...props }, ref) => {
    if (isConnectButton) {
      const { client: _, ...restProps } = props as ThirdwebConnectButtonProps
      
      // Configure wallets in priority order
      const wallets = [
        inAppWallet({
          auth: {
            options: [
              "email",
              "google", 
              "apple",
              "facebook",
              "passkey"
            ]
          }
        }),
        createWallet("io.metamask"),
        createWallet("com.coinbase.wallet"),
        walletConnect()
      ];
      
      return (
        <ThirdwebConnectButton
          appMetadata={{
            name: "OMA3 Attestation Portal",
            url: "https://attestation.oma3.org",
            description: "Create and manage attestations for the OMA3 ecosystem",
            logoUrl: "/oma3_logo.svg"
          }}
          className={className}
          autoConnect={{ timeout: 15000 }}
          wallets={wallets}
          chains={SUPPORTED_CHAINS}
          connectModal={{
            size: "wide",
            showThirdwebBranding: false,
          }}
          connectButton={{
            label: connectButtonProps?.label ?? "Connect Wallet",
          }}
          client={client}
          {...restProps}
        />
      )
    }

    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
