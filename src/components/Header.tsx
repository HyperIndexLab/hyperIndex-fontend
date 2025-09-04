"use client";

import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import logo from "../assets/img/logo.png";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Personal from "./Personal";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useConnect as useParticleConnect } from '@particle-network/auth-core-modal';
import { AuthCoreEvent, getLatestAuthType, isSocialAuthType, particleAuth, SocialAuthType } from "@particle-network/auth-core";
import { particleWagmiWallet } from "./ParticleWallet/particleWagmiWallet";
import { switchChain } from '@wagmi/core'
import { MAINNET_CHAIN_ID, TESTNET_CHAIN_ID, wagmiConfig } from "./RainbowKitProvider";

type MenuItem = {
  path: string;
  label: string;
  icon: React.ReactNode;
  target?: string;
  rel?: string;
  children?: MenuItem[];
};

const MENU_MAP: MenuItem[] = [
  {
    path: "/",
    label: "Trade",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
        />
      </svg>
    ),
  },
  {
    path: "/explore",
    label: "Explore",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
        />
      </svg>
    ),
    children: [
      {
        path: "/explore/tokens",
        label: "Tokens",
        icon: (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ),
      },
      {
        path: "/explore/pools",
        label: "Pool",
        icon: (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        ),
      },
	  {
        path: "/user/liquidity",
        label: "My Pool",
        icon: (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
            />
          </svg>
        ),
      },
    ],
  },
  {
    path: "/news",
    label: "News",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15"
        />
      </svg>
    ),
    rel: "noopener noreferrer",
  },
  {
    path: "/activity",
    label: "Activity",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
        />
      </svg>
    ),
    children: [
      {
        path: "/activity",
        label: "Gift 🎁",
        icon: (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
            />
          </svg>
        ),
      },
    ],
  },
];

export default function Header() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [open, setOpen] = useState(false);

  const { connect } = useConnect();
  const { connectionStatus } = useParticleConnect();
  const { disconnect } = useDisconnect();
  
  // 添加网络切换相关的状态和函数
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  
  // const chainId = useChainId();
  const { isConnected, address } = useAccount();
  // 检查网络并在需要时自动切换
  useEffect(() => {
    const switchNetwork = async () => {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const chainIdInt = parseInt(chainId || '0', 16);

      const changeChaindId = process.env.BUILD_ENV === 'test' ? TESTNET_CHAIN_ID : MAINNET_CHAIN_ID;
   
      if (chainIdInt !== changeChaindId) {
        setIsWrongNetwork(true);
        try {
          await switchChain(wagmiConfig, { chainId: changeChaindId });
          setIsWrongNetwork(false);
        } catch (error) {
          console.error('切换链失败：', error);
        }
        
      } else {
        setIsWrongNetwork(false);
      }
    };

    if (isConnected && address) {
      switchNetwork();
    }
  }, [switchChain, isConnected, address]);

  useEffect(() => {
    if (connectionStatus === 'connected' && isSocialAuthType(getLatestAuthType())) {
        connect({
            connector: particleWagmiWallet({ socialType: getLatestAuthType() as SocialAuthType }),
        });
    }
    const onDisconnect = () => {
        disconnect();
    };
    particleAuth.on(AuthCoreEvent.ParticleAuthDisconnect, onDisconnect);
    return () => {
        particleAuth.off(AuthCoreEvent.ParticleAuthDisconnect, onDisconnect);
    };
  }, [connect, connectionStatus, disconnect]);

  

  return (
    <div className="w-full top-0 z-50 font-sora">
      <div className="navbar h-14 max-w-[1200px] mx-auto px-4">
        {/* Logo 部分 */}
        <div className="flex-1">
          <Link href="/" className="flex items-center">
            <Image src={logo} alt="logo" width={60} height={24} />
          </Link>
        </div>

        {/* 菜单部分 */}
        <div className="flex-none hidden lg:block">
          <ul className="menu menu-horizontal gap-1 font-sora">
            {MENU_MAP.map((item) => (
              <li key={item.path} className="relative">
                {!item.children ? (
                  <Link
                    href={item.path}
                    target={item.target}
                    rel={item.rel}
                    className={`px-3 flex items-center gap-2 transition-colors ${
                      pathname === item.path 
                        ? "text-white font-medium" 
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {item.icon}
                      {item.label}
                    </span>
                  </Link>
                ) : (
                  <div className="group">
                    <button
                      className="flex items-center gap-2 px-3 text-gray-400 hover:text-gray-200"
                    >
                      {item.icon}
                      {item.label}
                    </button>
                    
                    {/* 简化的二级菜单 */}
                    <div className="absolute left-[-8px] top-full pt-2">  {/* 增加 padding 确保鼠标移动时不会失去 hover */}
                      <div className="bg-black/90 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden w-52 hidden group-hover:block border border-gray-800">
                        {item.children.map((child) => (
                          <Link
                            key={child.path}
                            href={child.path}
                            target={child.target}
                            rel={child.rel}
                            className={`flex items-center gap-3 px-6 py-3 hover:bg-gray-800/30 transition-colors ${
                              pathname === child.path ? "text-white font-medium" : "text-gray-400"
                            }`}
                          >
                            {child.icon}
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* 钱包按钮 */}
        <div className="flex-none flex items-center gap-4 ml-4">
          <div className="lg:hidden">
            <label
              htmlFor="my-drawer"
              className="btn btn-ghost btn-sm btn-circle"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </label>
          </div>
          <div className="relative">
            <ConnectButton.Custom>
              {({ openConnectModal, account, chain }) => {
                if (!account || !chain) {
                  return (
                    <button
                      onClick={openConnectModal}
                      className="font-sora bg-[#243056] hover:bg-[#384f80] text-white rounded-full px-5 h-10 text-sm font-medium transition-colors flex items-center justify-center"
                    >
                      Connect Wallet
                    </button>
                  );
                }
                return (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setOpen(true)}
                      className="font-sora bg-[#1a1f2a] hover:bg-[#2c3340] text-white rounded-full px-5 h-10 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      {account.displayName}
                    </button>
                    {isWrongNetwork && (
                      <div className="top-full text-center">
                        <span className="text-error text-sm">Wrong Network</span>
                      </div>
                    )}
                  </div>
                );
              }}
            </ConnectButton.Custom>
          </div>
          <Personal isOpen={open} setOpen={setOpen} />
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className="drawer">
        <input
          id="my-drawer"
          type="checkbox"
          className="drawer-toggle"
          checked={isMobileMenuOpen}
          onChange={(e) => setIsMobileMenuOpen(e.target.checked)}
        />
        <div className="drawer-side z-[100]">
          <label htmlFor="my-drawer" className="drawer-overlay"></label>
          <div className="w-full max-w-[320px] min-h-screen bg-black/90 backdrop-blur-md text-gray-300 font-sora">
            {/* 关闭按钮 */}
            <div className="sticky top-0 flex justify-between items-center p-4 border-b border-gray-800">
              <span className="text-lg font-medium text-white">Menu</span>
              <button
                className="btn btn-ghost btn-circle"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* 菜单列表 */}
            <div className="p-4">
              <ul className="space-y-2">
                {MENU_MAP.map((item) => (
                  <li key={item.path}>
                    {!item.children ? (
                      <Link
                        href={item.path}
                        className={`flex items-center gap-3 p-3 text-base transition-colors ${
                          pathname === item.path
                            ? "text-white font-medium"
                            : "text-gray-400 hover:text-gray-200"
                        }`}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </Link>
                    ) : (
                      <details className="group">
                        <summary
                          className={`w-full flex items-center gap-3 p-3 text-base transition-colors cursor-pointer ${
                            pathname === item.path
                              ? "text-white font-medium"
                              : "text-gray-400 hover:text-gray-200"
                          }`}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                          <svg
                            className="w-4 h-4 ml-auto"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </summary>
                        <ul className="pl-4 mt-2 space-y-1">
                          {item.children.map((child) => (
                            <li key={child.path}>
                              <Link
                                href={child.path}
                                target={child.target}
                                rel={child.rel}
                                className={`flex items-center gap-3 p-3 text-base transition-colors ${
                                  pathname === child.path
                                    ? "text-white font-medium"
                                    : "text-gray-400 hover:text-gray-200"
                                }`}
                                onClick={() => setIsMobileMenuOpen(false)}
                              >
                                {child.icon}
                                <span>{child.label}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
