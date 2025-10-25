import crypto from "crypto";
import { db, pool } from "./db";
import { users } from "../shared/schema";
import { eq, and, ne } from "drizzle-orm";

export interface DeviceInfo {
  deviceId: string;
  fingerprint?: {
    userAgent?: string;
    platform?: string;
    language?: string;
    screenResolution?: string;
    timezone?: string;
  };
}

export async function validateDeviceAndDetectDuplicate(
  telegramId: string,
  deviceInfo: DeviceInfo,
  userId?: string
): Promise<{
  isValid: boolean;
  shouldBan: boolean;
  primaryAccountId?: string;
  reason?: string;
}> {
  try {
    const { deviceId, fingerprint } = deviceInfo;

    if (!deviceId) {
      return {
        isValid: false,
        shouldBan: false,
        reason: "No device ID provided"
      };
    }

    const existingUsersWithDevice = await db
      .select()
      .from(users)
      .where(eq(users.deviceId, deviceId));

    if (existingUsersWithDevice.length === 0) {
      return {
        isValid: true,
        shouldBan: false
      };
    }

    const currentUserAccount = existingUsersWithDevice.find(
      u => u.telegram_id === telegramId
    );

    if (currentUserAccount) {
      await db
        .update(users)
        .set({
          deviceFingerprint: fingerprint as any,
          lastLoginAt: new Date(),
        })
        .where(eq(users.id, currentUserAccount.id));

      return {
        isValid: true,
        shouldBan: false
      };
    }

    const primaryAccount = existingUsersWithDevice.find(
      u => u.isPrimaryAccount === true
    ) || existingUsersWithDevice[0];

    return {
      isValid: false,
      shouldBan: true,
      primaryAccountId: primaryAccount.id,
      reason: "Multiple accounts detected on the same device"
    };
  } catch (error) {
    console.error("Device validation error:", error);
    return {
      isValid: false,
      shouldBan: false,
      reason: "Device validation failed"
    };
  }
}

export async function banUserForMultipleAccounts(
  userId: string,
  reason: string
): Promise<void> {
  try {
    await db
      .update(users)
      .set({
        banned: true,
        bannedReason: reason,
        bannedAt: new Date(),
        isPrimaryAccount: false,
      })
      .where(eq(users.id, userId));

    console.log(`User ${userId} banned for: ${reason}`);
  } catch (error) {
    console.error("Error banning user:", error);
    throw error;
  }
}

export async function sendWarningToMainAccount(
  primaryAccountId: string
): Promise<void> {
  try {
    const primaryUser = await db
      .select()
      .from(users)
      .where(eq(users.id, primaryAccountId))
      .limit(1);

    if (primaryUser.length === 0 || !primaryUser[0].telegram_id) {
      console.log("Primary account not found or no Telegram ID");
      return;
    }

    const { sendUserTelegramNotification } = await import('./telegram');
    
    const warningMessage = 
      "⚠️ Warning: We've detected another account from your device that violated our multi-account policy.\n\n" +
      "If this happens again, your main account will be permanently banned without any further notice.";

    await sendUserTelegramNotification(
      primaryUser[0].telegram_id,
      warningMessage
    );

    console.log(`Warning sent to main account: ${primaryAccountId}`);
  } catch (error) {
    console.error("Error sending warning to main account:", error);
  }
}

export async function detectSelfReferral(
  userId: string,
  referrerCode: string
): Promise<{
  isSelfReferral: boolean;
  shouldBan: boolean;
  referrerId?: string;
}> {
  try {
    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (currentUser.length === 0) {
      return { isSelfReferral: false, shouldBan: false };
    }

    const referrer = await db
      .select()
      .from(users)
      .where(eq(users.referralCode, referrerCode))
      .limit(1);

    if (referrer.length === 0) {
      return { isSelfReferral: false, shouldBan: false };
    }

    const currentDeviceId = currentUser[0].deviceId;
    const referrerDeviceId = referrer[0].deviceId;

    if (!currentDeviceId || !referrerDeviceId) {
      return { isSelfReferral: false, shouldBan: false };
    }

    if (currentDeviceId === referrerDeviceId) {
      return {
        isSelfReferral: true,
        shouldBan: true,
        referrerId: referrer[0].id
      };
    }

    return { isSelfReferral: false, shouldBan: false };
  } catch (error) {
    console.error("Self-referral detection error:", error);
    return { isSelfReferral: false, shouldBan: false };
  }
}
