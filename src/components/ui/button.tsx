import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { client } from "@/app/client"
import { ConnectButton as ThirdwebConnectButton } from "thirdweb/react"
import { defineChain } from "thirdweb/chains"
import { DEFAULT_CHAIN } from "@/config/chains"
import { managedWallet, nativeWallets, allWallets } from "@/config/wallets"

import { cn } from "@/lib/utils"

// The active chain — scopes Thirdweb RPC and balance display to this chain
const activeThirdwebChain = defineChain({
  id: DEFAULT_CHAIN.id,
  rpc: DEFAULT_CHAIN.rpc,
  name: DEFAULT_CHAIN.name,
  nativeCurrency: DEFAULT_CHAIN.nativeCurrency,
  blockExplorers: DEFAULT_CHAIN.blockExplorers,
})

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
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
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4",
        lg: "h-11 px-8",
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
  connectMode?: "all" | "managed" | "native"
  connectOnConnect?: (wallet: unknown) => void
  connectHideDisconnect?: boolean
  connectButtonProps?: {
    label?: string
  }
}

// Extend the ThirdwebConnectButton props to include className
type ThirdwebConnectButtonProps = React.ComponentProps<typeof ThirdwebConnectButton> & {
  className?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isConnectButton = false, connectMode = "all", connectOnConnect, connectHideDisconnect = false, connectButtonProps, ...props }, ref) => {
    if (isConnectButton) {
      const { client: _, ...restProps } = props as ThirdwebConnectButtonProps
      
      const wallets =
        connectMode === "managed"
          ? [managedWallet]
          : connectMode === "native"
            ? nativeWallets
            : allWallets
      
      return (
        <ThirdwebConnectButton
          appMetadata={{
            name: "OMATrust Portal",
            url: "https://app.omatrust.org",
            description: "Publish trust data and manage service trust with OMATrust",
            logoUrl: "/oma3_logo.svg"
          }}
          className={className}
          autoConnect={false}
          wallets={wallets}
          chains={[activeThirdwebChain]}
          connectModal={{
            size: "wide",
            showThirdwebBranding: false,
          }}
          detailsModal={{
            hideDisconnect: connectHideDisconnect,
          }}
          connectButton={{
            label: connectButtonProps?.label ?? "Connect Wallet",
          }}
          onConnect={connectOnConnect as ((wallet: any) => void) | undefined}
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
