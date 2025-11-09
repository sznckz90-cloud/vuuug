import { useTonConnectUI, useTonWallet as useTonWalletBase, useTonAddress } from "@tonconnect/ui-react";
import { useState, useCallback } from "react";
import { showNotification } from "@/components/AppNotification";
import { beginCell } from "@ton/core";

export function useTonWallet() {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWalletBase();
  const address = useTonAddress();
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      await tonConnectUI.openModal();
    } catch (error) {
      console.error("Failed to connect TON wallet:", error);
      showNotification("Failed to connect wallet", "error");
    } finally {
      setIsConnecting(false);
    }
  }, [tonConnectUI]);

  const disconnect = useCallback(async () => {
    try {
      await tonConnectUI.disconnect();
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
      showNotification("Failed to disconnect wallet", "error");
    }
  }, [tonConnectUI]);

  const sendTransaction = useCallback(
    async (toAddress: string, amount: string, comment: string) => {
      if (!wallet) {
        throw new Error("Wallet not connected");
      }

      try {
        const payload = comment
          ? beginCell()
              .storeUint(0, 32)
              .storeStringTail(comment)
              .endCell()
              .toBoc()
              .toString("base64")
          : undefined;

        const transaction = {
          validUntil: Math.floor(Date.now() / 1000) + 360,
          messages: [
            {
              address: toAddress,
              amount: (parseFloat(amount) * 1e9).toString(),
              payload,
            },
          ],
        };

        const result = await tonConnectUI.sendTransaction(transaction);
        return result;
      } catch (error) {
        console.error("Transaction failed:", error);
        throw error;
      }
    },
    [wallet, tonConnectUI]
  );

  return {
    wallet,
    address,
    isConnected: !!wallet,
    isConnecting,
    connect,
    disconnect,
    sendTransaction,
  };
}
