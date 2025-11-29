import crypto from "crypto";
import { db, pool } from "./db";
import { users, banLogs } from "../shared/schema";
import { eq, and, ne, or, sql } from "drizzle-orm";

export interface DeviceInfo {
  deviceId: string;
  fingerprint?: {
    userAgent?: string;
    platform?: string;
    language?: string;
    screenResolution?: string;
    timezone?: string;
  };
  ip?: string;
  userAgent?: string;
}

export interface BanLogData {
  bannedUserId: string;
  bannedUserUid?: string;
  ip?: string;
  deviceId?: string;
  userAgent?: string;
  fingerprint?: any;
  reason: string;
  banType: 'auto' | 'manual';
  bannedBy?: string;
  relatedAccountIds?: string[];
}

export async function createBanLog(data: BanLogData): Promise<void> {
  try {
    await db.insert(banLogs).values({
      bannedUserId: data.bannedUserId,
      bannedUserUid: data.bannedUserUid,
      ip: data.ip,
      deviceId: data.deviceId,
      userAgent: data.userAgent,
      fingerprint: data.fingerprint,
      reason: data.reason,
      banType: data.banType,
      bannedBy: data.bannedBy,
      relatedAccountIds: data.relatedAccountIds as any,
    });
    console.log(`📝 Ban log created for user ${data.bannedUserId}: ${data.reason}`);
  } catch (error) {
    console.error("Error creating ban log:", error);
  }
}

export async function validateDeviceAndDetectDuplicate(
  telegramId: string,
  deviceInfo: DeviceInfo,
  userId?: string
): Promise<{
  isValid: boolean;
  shouldBan: boolean;
  primaryAccountId?: string;
  duplicateAccountIds?: string[];
  reason?: string;
}> {
  try {
    const { deviceId, fingerprint, ip, userAgent } = deviceInfo;

    if (!deviceId) {
      return {
        isValid: false,
        shouldBan: false,
        reason: "No device ID provided"
      };
    }

    // Check for existing accounts with same device ID
    const existingUsersWithDevice = await db
      .select()
      .from(users)
      .where(eq(users.deviceId, deviceId));

    // Also check for accounts with same IP if provided
    let existingUsersWithIP: any[] = [];
    if (ip) {
      existingUsersWithIP = await db
        .select()
        .from(users)
        .where(eq(users.lastLoginIp, ip));
    }

    // Combine and deduplicate
    const allRelatedUsers = [...existingUsersWithDevice];
    for (const ipUser of existingUsersWithIP) {
      if (!allRelatedUsers.find(u => u.id === ipUser.id)) {
        allRelatedUsers.push(ipUser);
      }
    }

    if (allRelatedUsers.length === 0) {
      return {
        isValid: true,
        shouldBan: false
      };
    }

    const currentUserAccount = allRelatedUsers.find(
      u => u.telegram_id === telegramId
    );

    if (currentUserAccount) {
      if (currentUserAccount.banned) {
        return {
          isValid: false,
          shouldBan: true,
          reason: currentUserAccount.bannedReason || "Account is banned"
        };
      }

      // Update device info and login tracking
      await db
        .update(users)
        .set({
          deviceFingerprint: fingerprint as any,
          lastLoginAt: new Date(),
          lastLoginIp: ip || currentUserAccount.lastLoginIp,
          lastLoginUserAgent: userAgent || currentUserAccount.lastLoginUserAgent,
        })
        .where(eq(users.id, currentUserAccount.id));

      return {
        isValid: true,
        shouldBan: false
      };
    }

    // New account on existing device/IP - this is multi-account abuse
    const primaryAccount = allRelatedUsers.find(
      u => u.isPrimaryAccount === true
    ) || allRelatedUsers[0];

    const duplicateAccountIds = allRelatedUsers
      .filter(u => u.telegram_id !== telegramId && !u.banned)
      .map(u => u.id);

    return {
      isValid: false,
      shouldBan: true,
      primaryAccountId: primaryAccount.id,
      duplicateAccountIds,
      reason: "Multiple accounts detected on the same device/network - only one account per device is allowed"
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

export async function checkIPForDuplicates(
  ip: string,
  telegramId: string
): Promise<{
  hasDuplicates: boolean;
  duplicateCount: number;
  primaryAccountId?: string;
}> {
  try {
    if (!ip) {
      return { hasDuplicates: false, duplicateCount: 0 };
    }

    const usersWithSameIP = await db
      .select()
      .from(users)
      .where(and(
        eq(users.lastLoginIp, ip),
        ne(users.telegram_id, telegramId)
      ));

    if (usersWithSameIP.length === 0) {
      return { hasDuplicates: false, duplicateCount: 0 };
    }

    const primaryAccount = usersWithSameIP.find(u => u.isPrimaryAccount === true) || usersWithSameIP[0];

    return {
      hasDuplicates: true,
      duplicateCount: usersWithSameIP.length,
      primaryAccountId: primaryAccount.id
    };
  } catch (error) {
    console.error("IP duplicate check error:", error);
    return { hasDuplicates: false, duplicateCount: 0 };
  }
}

export async function banUserForMultipleAccounts(
  userId: string,
  reason: string,
  deviceInfo?: DeviceInfo,
  relatedAccountIds?: string[]
): Promise<void> {
  try {
    // Get user info for logging
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    await db
      .update(users)
      .set({
        banned: true,
        bannedReason: reason,
        bannedAt: new Date(),
        isPrimaryAccount: false,
      })
      .where(eq(users.id, userId));

    // Create ban log
    await createBanLog({
      bannedUserId: userId,
      bannedUserUid: user?.personalCode || undefined,
      ip: deviceInfo?.ip,
      deviceId: deviceInfo?.deviceId,
      userAgent: deviceInfo?.userAgent,
      fingerprint: deviceInfo?.fingerprint,
      reason,
      banType: 'auto',
      relatedAccountIds,
    });

    console.log(`✅ User ${userId} banned for: ${reason}`);
  } catch (error) {
    console.error("Error banning user:", error);
    throw error;
  }
}

export async function banMultipleUsers(
  userIds: string[],
  reason: string,
  deviceInfo?: DeviceInfo
): Promise<void> {
  try {
    if (userIds.length === 0) return;

    for (const userId of userIds) {
      await banUserForMultipleAccounts(userId, reason, deviceInfo, userIds);
    }

    console.log(`✅ Banned ${userIds.length} accounts for: ${reason}`);
  } catch (error) {
    console.error("Error banning multiple users:", error);
    throw error;
  }
}

export async function manualBanUser(
  userId: string,
  reason: string,
  bannedBy: string,
  deviceInfo?: DeviceInfo
): Promise<void> {
  try {
    // Get user info for logging
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      throw new Error("User not found");
    }

    await db
      .update(users)
      .set({
        banned: true,
        bannedReason: reason,
        bannedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Create ban log for manual ban
    await createBanLog({
      bannedUserId: userId,
      bannedUserUid: user.personalCode || undefined,
      ip: user.lastLoginIp || deviceInfo?.ip,
      deviceId: user.deviceId || deviceInfo?.deviceId,
      userAgent: user.lastLoginUserAgent || deviceInfo?.userAgent,
      fingerprint: user.deviceFingerprint || deviceInfo?.fingerprint,
      reason,
      banType: 'manual',
      bannedBy,
    });

    console.log(`✅ User ${userId} manually banned by ${bannedBy} for: ${reason}`);
  } catch (error) {
    console.error("Error manually banning user:", error);
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
  referrerCode: string,
  deviceInfo?: DeviceInfo
): Promise<{
  isSelfReferral: boolean;
  shouldBan: boolean;
  referrerId?: string;
  reason?: string;
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
    const currentIP = deviceInfo?.ip || currentUser[0].lastLoginIp;
    const referrerIP = referrer[0].lastLoginIp;

    // Check device ID match
    if (currentDeviceId && referrerDeviceId && currentDeviceId === referrerDeviceId) {
      return {
        isSelfReferral: true,
        shouldBan: true,
        referrerId: referrer[0].id,
        reason: "Self-referral detected: Same device ID as referrer"
      };
    }

    // Check IP match
    if (currentIP && referrerIP && currentIP === referrerIP) {
      return {
        isSelfReferral: true,
        shouldBan: true,
        referrerId: referrer[0].id,
        reason: "Self-referral detected: Same IP address as referrer"
      };
    }

    // Check browser fingerprint similarity
    const currentFingerprint = deviceInfo?.fingerprint || currentUser[0].deviceFingerprint;
    const referrerFingerprint = referrer[0].deviceFingerprint;

    if (currentFingerprint && referrerFingerprint) {
      const similarity = calculateFingerprintSimilarity(currentFingerprint, referrerFingerprint);
      if (similarity > 0.8) {
        return {
          isSelfReferral: true,
          shouldBan: true,
          referrerId: referrer[0].id,
          reason: `Self-referral detected: Similar browser fingerprint (${Math.round(similarity * 100)}% match)`
        };
      }
    }

    return { isSelfReferral: false, shouldBan: false };
  } catch (error) {
    console.error("Self-referral detection error:", error);
    return { isSelfReferral: false, shouldBan: false };
  }
}

function calculateFingerprintSimilarity(fp1: any, fp2: any): number {
  if (!fp1 || !fp2) return 0;
  
  const keys = ['userAgent', 'platform', 'language', 'screenResolution', 'timezone'];
  let matches = 0;
  let total = 0;

  for (const key of keys) {
    if (fp1[key] !== undefined && fp2[key] !== undefined) {
      total++;
      if (fp1[key] === fp2[key]) {
        matches++;
      }
    }
  }

  return total > 0 ? matches / total : 0;
}

export async function getBanLogs(limit: number = 50): Promise<any[]> {
  try {
    const logs = await db
      .select()
      .from(banLogs)
      .orderBy(sql`${banLogs.createdAt} DESC`)
      .limit(limit);
    
    return logs;
  } catch (error) {
    console.error("Error fetching ban logs:", error);
    return [];
  }
}
