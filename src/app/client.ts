import { createThirdwebClient } from "thirdweb";

// Replace this with your client ID string
// refer to https://portal.thirdweb.com/typescript/v5/client on how to get a client ID
const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

if (!clientId) {
  // Only throw error in production runtime when client is actually needed
  // Allow build and test environments to proceed with placeholder
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    throw new Error("No client ID provided");
  }
  // Use a placeholder during build/test/development
  if (process.env.NODE_ENV !== 'test') {
    console.warn("Warning: NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set. Using placeholder for build.");
  }
}

export const client = createThirdwebClient({
  clientId: clientId || "placeholder-for-build",
}); 