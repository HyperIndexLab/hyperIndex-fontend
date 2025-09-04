"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { getActivityStatus, claimActivity, IStatus } from "@/request/activity";
import Link from "next/link";
import { getEtherscanLink } from "@/utils";
import { useChainId } from "wagmi";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  GiftIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";

export default function ActiveTaskModal() {
  const [showPopup, setShowPopup] = useState(false);
  const [status, setStatus] = useState<IStatus | null>(null);
  const { address } = useAccount();
  const [isClaiming, setIsClaiming] = useState(false);
  const chainId = useChainId();

  useEffect(() => {
    if (!address) return;
    getActivityStatus(address).then((res) => {
      setStatus(res);
    });
  }, [address]);

  const handleClaim = () => {
    if (!address) return;
    setIsClaiming(true);
    claimActivity(address).then((res) => {
      setStatus(res.data);
      setIsClaiming(false);
      if (res.data.is_claim_success) {
        setShowPopup(true);
      }
    });
  };

  const handleGotoBridge = (url: string) => {
    window.open(url, "_blank");
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* 顶部横幅 */}
      <div className="bg-gradient-to-r from-primary/20 to-secondary/20 backdrop-blur-xl rounded-xl p-8 mb-6">
        <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Bridge & Earn Campaign 🎉
        </h2>
        <p className="text-base-content/70">
          Join our cross-chain journey and earn HSK tokens as rewards!
        </p>
      </div>

      {!address ? (
        <div className="card bg-base-200 shadow-lg">
          <div className="card-body">
            <div className="alert alert-warning shadow-lg">
              <ExclamationTriangleIcon className="w-6 h-6" />
              <div>
                <h3 className="font-bold">Wallet Required</h3>
                <div className="text-sm">
                  Please connect your wallet to participate in the campaign
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Task 1: Bridge */}
          <div className="card bg-base-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="card-body">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ArrowsRightLeftIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="card-title">Cross-Chain Bridge</h3>
                  <p className="text-sm text-base-content/60">
                    Bridge your assets to HashKey Chain
                  </p>
                </div>
                {status?.is_bridge && (
                  <div className="ml-auto">
                    <div className="badge badge-success gap-2 p-3">
                      <CheckCircleIcon className="w-4 h-4" />
                      Completed
                    </div>
                  </div>
                )}
              </div>

              {!status?.is_bridge && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() =>
                      handleGotoBridge(
                        "https://www.orbiter.finance/en?src_chain=42161&tgt_chain=177&src_token=ETH"
                      )
                    }
                    className="btn btn-primary flex-1 gap-2"
                  >
                    Use Orbiter Bridge
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleGotoBridge("https://owlto.finance/")}
                    className="btn btn-secondary flex-1 gap-2"
                  >
                    Use Owlto Bridge
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Task 2: Claim */}
          <div
            className={`card ${
              status?.is_bridge ? "bg-base-200" : "bg-base-200/50"
            } shadow-lg transition-all duration-300`}
          >
            <div className="card-body">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <GiftIcon className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h3 className="card-title">Claim Rewards</h3>
                  <p className="text-sm text-base-content/60">
                    Get your HSK token rewards
                  </p>
                </div>
                {status?.is_claim_success && (
                  <div className="ml-auto">
                    <div className="badge badge-success gap-2 p-3">
                      <CheckCircleIcon className="w-4 h-4" />
                      Claimed
                    </div>
                  </div>
                )}
              </div>

              {!status?.is_claim_success && (
                <button
                  className={`btn ${
                    status?.is_bridge ? "btn-secondary" : "btn-disabled"
                  } w-full sm:w-auto`}
                  disabled={isClaiming || !status?.is_bridge}
                  onClick={handleClaim}
                >
                  {isClaiming ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Claiming Rewards...
                    </>
                  ) : (
                    "Claim Rewards"
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Transaction Result */}
          {showPopup && status?.txHash && (
            <div className="alert bg-success/10 text-success-content shadow-lg">
              <CheckCircleIcon className="w-6 h-6" />
              <div>
                <div className="font-bold">Transaction Successful!</div>
                <div className="text-sm">
                  Hash: {status.txHash.slice(0, 8)}...{status.txHash.slice(-6)}
                  <Link
                    className="link link-primary ml-2"
                    target="_blank"
                    href={getEtherscanLink(
                      chainId,
                      status.txHash,
                      "transaction"
                    )}
                  >
                    View on Explorer
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
