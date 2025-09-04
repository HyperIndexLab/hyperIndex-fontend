"use client";

import { Sora } from "next/font/google";
import "./globals.css";
import { Provider } from 'react-redux';
import { AuthCoreContextProvider } from '@particle-network/auth-core-modal';
import { Theme } from 'react-daisyui';
import RainbowKitWrapper from '../components/RainbowKitProvider';
import store from '../store';
import Header from '../components/Header';
import 'react-toastify/dist/ReactToastify.css';
import ParticlesBackground from '../components/ParticlesBackground';
import { Suspense } from "react";
import ChatAgent from '@/components/ChatAgent';
import { ToastProvider } from "@/components/ToastContext";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Provider store={store}>
      <html lang="en" data-theme="dark">
        <head>
          <title>Hyper Index</title>
          <meta name="description" content="Hyper Index: The premier decentralized exchange (DEX) on HashKey Chain offering seamless trading, liquidity provision, and DeFi services. Experience low fees, high security, and advanced trading tools for the HashKey ecosystem." />
        </head>
        <body className={`${sora.className} antialiased min-h-screen`}>
          <Theme dataTheme="dark">
            <ToastProvider>
              <AuthCoreContextProvider
                options={{
                  projectId: '34c6b829-5b89-44e8-90a9-6d982787b9c9',
                  clientKey: 'c6Z44Ml4TQeNhctvwYgdSv6DBzfjf6t6CB0JDscR',
                  appId: 'ded98dfe-71f9-4af7-846d-5d8c714d63b0',
                  customStyle: {
                    zIndex: 2147483650,
                  },
                }}
              >
                <RainbowKitWrapper>
                  <Suspense>
                    <div className="fixed inset-0 z-0">
                      <ParticlesBackground />
                    </div>
                    
                    <div className="relative z-10 min-h-screen flex flex-col">
                      <Header />
                      <main className="flex-1">
                        {children}
                      </main>
                    </div>
                  </Suspense>
                </RainbowKitWrapper>
              </AuthCoreContextProvider>
            </ToastProvider>
          </Theme>
          <ChatAgent />
        </body>
      </html>
    </Provider>
  );
}
