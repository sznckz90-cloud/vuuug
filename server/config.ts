// Application configuration
// Use environment variables for channel settings

export const config = {
  // Telegram channel settings - use numeric ID for more reliable verification
  // To get numeric channel ID:
  // 1. Add @userinfobot to your channel
  // 2. Forward a message from the channel to @userinfobot
  // 3. It will show the channel ID (looks like: -1001234567890)
  telegram: {
    // Channel settings (environment variables required)
    channelId: process.env.TELEGRAM_CHANNEL_ID || '-1002480439556',
    channelUrl: process.env.TELEGRAM_CHANNEL_URL || 'https://t.me/PaidAdsNews',
    channelName: process.env.TELEGRAM_CHANNEL_NAME || 'Paid Adz Community',
    // Group settings (environment variables required)
    groupId: process.env.TELEGRAM_GROUP_ID || '-1002769424144',
    groupUrl: process.env.TELEGRAM_GROUP_URL || 'https://t.me/PaidAdsCommunity',
    groupName: process.env.TELEGRAM_GROUP_NAME || 'Paid Adz Chat',
  },
  
  // Bot configuration
  bot: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    adminId: process.env.TELEGRAM_ADMIN_ID || '',
  },
};

// Helper function to get channel config for API responses
export function getChannelConfig() {
  return {
    channelId: config.telegram.channelId,
    channelUrl: config.telegram.channelUrl,
    channelName: config.telegram.channelName,
    groupId: config.telegram.groupId,
    groupUrl: config.telegram.groupUrl,
    groupName: config.telegram.groupName,
  };
}
