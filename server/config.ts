// Application configuration
// Use environment variables for channel settings

export const config = {
  // Telegram channel settings - use numeric ID for more reliable verification
  // To get numeric channel ID:
  // 1. Add @userinfobot to your channel
  // 2. Forward a message from the channel to @userinfobot
  // 3. It will show the channel ID (looks like: -1001234567890)
  telegram: {
    channelId: process.env.TELEGRAM_CHANNEL_ID || '@PaidAdsNews',
    channelUrl: process.env.TELEGRAM_CHANNEL_URL || 'https://t.me/PaidAdsNews',
    channelName: process.env.TELEGRAM_CHANNEL_NAME || 'Paid Ads News',
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
  };
}
