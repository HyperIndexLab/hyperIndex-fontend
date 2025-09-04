import { useState, useEffect } from "react";
import { useReadContract, useWriteContract } from "wagmi";
import { TokenData } from "@/types/liquidity";
import { erc20Abi } from "viem";
import { ROUTER_CONTRACT_ADDRESS } from "@/constant/ABI/HyperIndexRouter";
import { useToast } from "@/components/ToastContext";
import { waitForTransactionReceipt } from "wagmi/actions";
import { wagmiConfig } from "@/components/RainbowKitProvider";


export function useTokenApproval(
  token1Data: TokenData | null,
  token2Data: TokenData | null,
  amount1: string,
  amount2: string,
  userAddress?: string,
  poolAddress?: `0x${string}`
) {

  const [needApprove, setNeedApprove] = useState({
    token1: false,
    token2: false,
  });
  const { writeContractAsync, isPending, isSuccess } = useWriteContract();
  const { toast } = useToast();

  // 检查 token1 授权
  const { data: allowance1 } = useReadContract({
    address:
      token1Data?.symbol !== "HSK"
        ? (token1Data?.address as `0x${string}`)
        : undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      userAddress && token1Data
        ? [userAddress as `0x${string}`, poolAddress || ROUTER_CONTRACT_ADDRESS]
        : undefined,
  });

  // 检查 token2 授权
  const { data: allowance2 } = useReadContract({
    address:
      token2Data?.symbol !== "HSK"
        ? (token2Data?.address as `0x${string}`)
        : undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      userAddress && token2Data
        ? [userAddress as `0x${string}`, poolAddress || ROUTER_CONTRACT_ADDRESS]
        : undefined,
  });

  // 检查是否需要授权
  useEffect(() => {
    if (!amount1 || !amount2) return;

    try {
      // 使用每个代币的实际小数位数
      const token1Decimals = Number(token1Data?.decimals || '18');
      const token2Decimals = Number(token2Data?.decimals || '18');
      
      const amount1Big = BigInt(Math.floor(parseFloat(amount1) * Math.pow(10, token1Decimals)));
      const amount2Big = BigInt(Math.floor(parseFloat(amount2) * Math.pow(10, token2Decimals)));

      setNeedApprove({
        token1:
          allowance1 !== undefined &&
          BigInt(allowance1.toString()) < amount1Big,
        token2:
          allowance2 !== undefined &&
          BigInt(allowance2.toString()) < amount2Big,
      });
    } catch (error) {
      console.error("Error checking allowance:", error);
      setNeedApprove({
        token1: false,
        token2: false,
      });
    }
  }, [token1Data, token2Data, amount1, amount2, allowance1, allowance2]);

  // 处理授权
  const handleApprove = async (isToken1: boolean) => {
    const token = isToken1 ? token1Data : token2Data;
    if (!token || token.symbol === "HSK") return;

    try {
      const maxApproval = BigInt(2) ** BigInt(256) - BigInt(1);
      const tx = await writeContractAsync({
        address: token.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [poolAddress || ROUTER_CONTRACT_ADDRESS, maxApproval],
      });

      const receipt = await waitForTransactionReceipt(wagmiConfig, {
        hash: tx,
      });

      if (receipt.status === 'success') {
        toast({
          type: 'success',
          message: 'Successfully Approved!',
          isAutoClose: true
        });
      } else {
        toast({
          type: 'error',
          message: 'Approval failed!',
          isAutoClose: true
        });
      }
    } catch (error) {
      console.error("Approval failed:", error);
      toast({
        type: 'error',
        message: 'Approval failed!',
        isAutoClose: true
      });
    }
  };

  return {
    needApprove,
    handleApprove,
    isApproving: isPending,
    isApproveSuccess: isSuccess,
  };
}
