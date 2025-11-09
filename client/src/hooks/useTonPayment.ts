import { useState, useCallback } from "react";
import { useTonWallet } from "./useTonWallet";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";

interface TonPaymentConfig {
  clicks: number;
  baseRate: number;
  adminWallet: string;
  taskData: {
    taskType: "channel" | "bot";
    title: string;
    link: string;
  };
}

export function useTonPayment() {
  const tonWallet = useTonWallet();
  const [isProcessing, setIsProcessing] = useState(false);

  const calculateTonAmount = useCallback((clicks: number, baseRate: number) => {
    return (clicks / 100) * baseRate;
  }, []);

  const executePayment = useCallback(
    async (config: TonPaymentConfig) => {
      if (!tonWallet.isConnected) {
        throw new Error("Please connect your TON wallet first");
      }

      setIsProcessing(true);

      try {
        const amount = calculateTonAmount(config.clicks, config.baseRate);
        const comment = `Task Purchase for ${config.clicks} clicks`;

        showNotification("Sending payment transaction...", "info");

        const txResult = await tonWallet.sendTransaction(
          config.adminWallet,
          amount.toString(),
          comment
        );

        console.log("✅ Transaction sent:", txResult);
        showNotification("Payment sent! Waiting for blockchain confirmation...", "info");

        await new Promise(resolve => setTimeout(resolve, 10000));

        showNotification("Verifying payment on blockchain...", "info");

        const verifyResponse = await apiRequest("POST", "/api/verifyPayment", {
          boc: txResult.boc,
          userWallet: tonWallet.address,
          clicks: config.clicks,
          taskData: config.taskData,
          amount: amount.toString(),
        });

        const verifyData = await verifyResponse.json();

        if (!verifyData.success) {
          throw new Error(verifyData.message || "Payment verification failed");
        }

        showNotification(
          `✅ ${verifyData.message || "Payment successful!"}`,
          "success"
        );

        return verifyData;
      } catch (error: any) {
        console.error("❌ TON payment error:", error);
        const errorMsg = error.message || "Payment failed. Please try again.";
        showNotification(errorMsg, "error");
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [tonWallet, calculateTonAmount]
  );

  return {
    isConnected: tonWallet.isConnected,
    address: tonWallet.address,
    isConnecting: tonWallet.isConnecting,
    isProcessing,
    connect: tonWallet.connect,
    disconnect: tonWallet.disconnect,
    calculateTonAmount,
    executePayment,
  };
}
