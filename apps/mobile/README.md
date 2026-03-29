# AfriConnect Mobile App

A React Native mobile application for the AfriConnect B2B marketplace, built with Expo.

## Tech Stack

- **Framework**: React Native with Expo SDK 54
- **Navigation**: Expo Router (file-based routing)
- **Styling**: NativeWind (TailwindCSS for React Native)
- **Backend**: Convex (shared with web app)
- **Authentication**: Clerk
- **Push Notifications**: Expo Notifications

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (for development)
- iOS Simulator (Mac only) or Android Emulator

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Create a `.env` file in the root directory:
   ```
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
   EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
   ```

3. **Get your Clerk publishable key**:
   - Go to [Clerk Dashboard](https://clerk.com/dashboard)
   - Select your application
   - Copy the publishable key

4. **Get your Convex URL**:
   - Use the same Convex deployment as your web app
   - Find it in your Convex dashboard or `.env.local` file

## Development

```bash
# Start the development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web
npm run web
```

## Project Structure

```
africonnect-mobile/
├── app/                    # App screens (file-based routing)
│   ├── (auth)/            # Authentication screens
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (tabs)/            # Main tab navigation
│   │   ├── index.tsx      # Home/Marketplace
│   │   ├── search.tsx     # Search products
│   │   ├── products.tsx   # Seller products
│   │   ├── business.tsx   # Business profile
│   │   └── profile.tsx    # User profile
│   ├── product/
│   │   └── [id].tsx       # Product detail
│   └── business/
│       └── [id].tsx       # Business detail
├── components/            # Reusable components
├── convex/               # Convex backend (shared with web)
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and providers
│   ├── cache.ts          # Clerk token cache
│   ├── convex.tsx        # Convex provider
│   └── utils.ts          # Helper functions
└── constants/            # App constants
```

## Features

### For Buyers
- Browse marketplace products
- Search with filters (category, country, price)
- View product details with image gallery
- Browse business directory
- Contact sellers

### For Sellers
- Register business
- Add/edit/delete products
- View business verification status
- Manage product inventory

### Common
- Sign in / Sign up with email
- Role selection (buyer/seller)
- Push notifications
- Dark mode support

## Building for Production

### EAS Build (Recommended)

1. **Install EAS CLI**:
   ```bash
   npm install -g eas-cli
   ```

2. **Configure EAS**:
   ```bash
   eas build:configure
   ```

3. **Create builds**:
   ```bash
   # Development build
   npm run build:dev

   # Preview build
   npm run build:preview

   # Production build
   npm run build:prod
   ```

### Local Build

```bash
# Generate native projects
npm run prebuild

# Build iOS (Mac only)
cd ios && pod install && cd ..
npx react-native run-ios

# Build Android
npx react-native run-android
```

## Shared Backend

This app shares the Convex backend with the web application. The `convex/` directory contains:

- `schema.ts` - Database schema
- `products.ts` - Product queries/mutations
- `businesses.ts` - Business queries/mutations
- `users.ts` - User queries/mutations
- `orders.ts` - Order management
- `cart.ts` - Shopping cart

Any changes to the schema must be coordinated with the web app.

## Push Notifications

Push notifications are configured using Expo Notifications. To enable:

1. Create an Expo project in the [Expo dashboard](https://expo.dev)
2. Update `app.json` with your project ID
3. Build with EAS to get push notification support

## Troubleshooting

### Common Issues

1. **Clerk authentication not working**:
   - Ensure `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is set
   - Check that the key matches your Clerk app

2. **Convex queries returning undefined**:
   - Verify `EXPO_PUBLIC_CONVEX_URL` is correct
   - Ensure you're authenticated

3. **NativeWind styles not applying**:
   - Clear Metro cache: `npx expo start -c`
   - Restart the bundler

4. **Push notifications not received**:
   - Push notifications require a physical device
   - Use EAS Build for production push support

## Contributing

1. Create a feature branch
2. Make your changes
3. Test on iOS and Android
4. Submit a pull request

## License

Private - AfriConnect
