import { ConvexReactClient, ConvexProvider } from 'convex/react';
import { useAuth } from '@clerk/clerk-expo';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ReactNode } from 'react';

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL!;

if (!convexUrl) {
  throw new Error('Missing EXPO_PUBLIC_CONVEX_URL environment variable');
}

const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
});

interface ConvexClientProviderProps {
  children: ReactNode;
}

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

// Export the client for direct use if needed
export { convex };
