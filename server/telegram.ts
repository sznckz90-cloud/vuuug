// Telegram Bot API integration for sending notifications
import { storage } from './storage';

const isAdmin = (telegramId: string): boolean => {
  const adminId = process.env.TELEGRAM_ADMIN_ID;
  return adminId === telegramId;
};

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;

interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
  reply_markup?: {
    inline_keyboard: Array<Array<{
      text: string;
      url?: string;
      callback_data?: string;
    }>>;
  };
}

export async function sendTelegramMessage(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_ID) {
    console.error('Telegram bot token or admin ID not configured');
    return false;
  }

  try {
    const telegramMessage: TelegramMessage = {
      chat_id: TELEGRAM_ADMIN_ID,
      text: message,
      parse_mode: 'HTML'
    };

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(telegramMessage),
    });

    if (response.ok) {
      console.log('Telegram notification sent successfully');
      return true;
    } else {
      const errorData = await response.text();
      console.error('Failed to send Telegram notification:', errorData);
      return false;
    }
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return false;
  }
}

export function formatWithdrawalNotification(
  userId: string,
  amount: string,
  method: string,
  details: any,
  userName?: string
): string {
  const displayName = userName || `User ${userId}`;
  const methodName = method === 'usdt_polygon' ? 'Tether (Polygon POS)' : 'Litecoin (LTC)';
  
  let address = '';
  if (details.usdt_polygon) {
    address = details.usdt_polygon;
  } else if (details.litecoin) {
    address = details.litecoin;
  }

  // Calculate commission and net amount
  const withdrawalAmount = parseFloat(amount);
  const commissionAmount = method === 'usdt_polygon' ? 0.02 : 0.05; // Based on your payment methods
  const netAmount = withdrawalAmount - commissionAmount;

  return `
🔔 <b>New Withdrawal Request</b>

👤 <b>User:</b> ${displayName}
🆔 <b>Telegram ID:</b> ${userId}
💰 <b>Withdrawal Amount:</b> $${amount}
💳 <b>Commission:</b> $${commissionAmount.toFixed(2)}
🎯 <b>Send to User:</b> $${netAmount.toFixed(2)}
🏦 <b>Method:</b> ${methodName}
📍 <b>Address:</b> <code>${address}</code>

⏰ <b>Time:</b> ${new Date().toLocaleString()}

<i>⚠️ Send $${netAmount.toFixed(2)} to the address above (after commission deduction)</i>
  `.trim();
}

export function formatUserNotification(
  amount: string,
  method: string,
  status: string,
  transactionHash?: string
): string {
  const methodName = method === 'usdt_polygon' ? 'Tether (Polygon POS)' : 'Litecoin (LTC)';
  
  const statusEmoji = {
    completed: '✅',
    failed: '❌',
    processing: '⏳'
  }[status] || '⏳';

  const statusText = {
    completed: 'Completed',
    failed: 'Failed',
    processing: 'Processing'
  }[status] || 'Processing';

  let message = `
${statusEmoji} <b>Withdrawal ${statusText}</b>

💰 <b>Amount:</b> $${amount}
🏦 <b>Method:</b> ${methodName}
📊 <b>Status:</b> ${statusText}
⏰ <b>Updated:</b> ${new Date().toLocaleString()}`;

  if (status === 'completed' && transactionHash) {
    message += `\n🔗 <b>Transaction:</b> <code>${transactionHash}</code>`;
  }

  if (status === 'completed') {
    message += `\n\n🎉 <i>Your payment has been sent successfully!</i>`;
  } else if (status === 'failed') {
    message += `\n\n😞 <i>Payment failed. Please contact support.</i>`;
  } else {
    message += `\n\n⏳ <i>Your withdrawal is being processed...</i>`;
  }

  return message.trim();
}

export async function sendUserTelegramNotification(userId: string, message: string, replyMarkup?: any): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ Telegram bot token not configured');
    return false;
  }

  try {
    console.log(`📞 Sending message to Telegram API for user ${userId}...`);
    
    const telegramMessage: TelegramMessage = {
      chat_id: userId,
      text: message,
      parse_mode: 'HTML'
    };

    if (replyMarkup) {
      telegramMessage.reply_markup = replyMarkup;
    }

    console.log('📡 Request payload:', JSON.stringify(telegramMessage, null, 2));

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(telegramMessage),
    });

    console.log('📊 Telegram API response status:', response.status);

    if (response.ok) {
      const responseData = await response.json();
      console.log('✅ User notification sent successfully to', userId, responseData);
      return true;
    } else {
      const errorData = await response.text();
      console.error('❌ Failed to send user notification:', errorData);
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending user notification:', error);
    return false;
  }
}

export function formatWelcomeMessage(): { message: string; inlineKeyboard: any } {
  const message = `😏 Why waste time? Our app pays higher per Ad than anyone else!

🤝 Invite your friends & earn up to 10% extra from their ads!
⚡ Fast Earnings – 3x more than other apps 🗿

🚮Other apps Slow + $0.0001 peanuts 😴

⏳ Don't waste time, make it money…
👉 Tap below & Get Paid Now!`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "🚀 Get Paid Now",
          url: process.env.RENDER_EXTERNAL_URL || "https://your-render-app.onrender.com"
        }
      ],
      [
        {
          text: "📡 Project Vibes",
          url: "https://t.me/LightingSats"
        },
        {
          text: "😎 Help Desk",
          url: "https://t.me/szxzyz"
        }
      ]
    ]
  };

  return { message, inlineKeyboard };
}

export async function sendWelcomeMessage(userId: string): Promise<boolean> {
  const { message, inlineKeyboard } = formatWelcomeMessage();
  return await sendUserTelegramNotification(userId, message, inlineKeyboard);
}

// Handle incoming Telegram messages and commands
export async function handleTelegramMessage(update: any): Promise<boolean> {
  try {
    console.log('🔄 Processing Telegram update...');
    const message = update.message;
    if (!message || !message.text) {
      console.log('❌ No message or text found in update');
      return false;
    }

    const chatId = message.chat.id.toString();
    const text = message.text.trim();
    const user = message.from;

    console.log(`📝 Received message: "${text}" from user ${chatId}`);

    // Handle /start command
    if (text.startsWith('/start')) {
      console.log('🚀 Processing /start command...');
      // Extract referral code if present (e.g., /start REF123)
      const referralCode = text.split(' ')[1];
      
      // Create/update user in database
      const { user: dbUser, isNewUser } = await storage.upsertUser({
        id: chatId,
        email: user.username ? `${user.username}@telegram.user` : null,
        firstName: user.first_name,
        lastName: user.last_name,
        profileImageUrl: null,
        referredBy: referralCode || null,
      });

      // Always send welcome message
      console.log('📤 Sending welcome message to:', chatId);
      const messageSent = await sendWelcomeMessage(chatId);
      console.log('📧 Welcome message sent successfully:', messageSent);
      
      // Process referral if referral code was provided (only for new users)
      if (isNewUser && referralCode && referralCode !== chatId) {
        try {
          await storage.createReferral(referralCode, chatId);
        } catch (error) {
          console.log('Referral processing failed:', error);
        }
      }

      return true;
    }

    // Handle /help command
    if (text.startsWith('/help')) {
      const helpMessage = `
🤖 <b>CashWatch Bot Commands</b>

/start - Start using the app and get your referral link
/help - Show this help message
/balance - Check your current balance
/stats - View your account statistics
/admin - Access admin panel (admins only)

💰 <b>Earn money by watching ads!</b>
Open the app through the bot menu to start earning.
      `;
      
      await sendUserTelegramNotification(chatId, helpMessage);
      return true;
    }

    // Handle /balance command
    if (text.startsWith('/balance')) {
      try {
        const user = await storage.getUser(chatId);
        if (user) {
          const balanceMessage = `
💰 <b>Your Balance</b>

💵 Available: $${user.withdrawBalance}
📈 Total Earned: $${user.totalEarnings}
📺 Ads Watched: ${user.adsWatched}
📊 Daily Ads: ${user.dailyAdsWatched}
🎯 Level: ${user.level}
          `;
          await sendUserTelegramNotification(chatId, balanceMessage);
        } else {
          await sendUserTelegramNotification(chatId, "❌ User not found. Please use /start first.");
        }
      } catch (error) {
        console.error('Error fetching balance:', error);
        await sendUserTelegramNotification(chatId, "❌ Error fetching your balance. Please try again.");
      }
      return true;
    }

    // Handle /stats command
    if (text.startsWith('/stats')) {
      try {
        const user = await storage.getUser(chatId);
        if (user) {
          const statsMessage = `
📊 <b>Your Statistics</b>

👤 Name: ${user.firstName} ${user.lastName || ''}
💰 Balance: $${user.withdrawBalance}
📈 Total Earned: $${user.totalEarnings}
📺 Total Ads Watched: ${user.adsWatched}
📅 Today's Ads: ${user.dailyAdsWatched}
💸 Daily Earnings: $${user.dailyEarnings}
🎯 Level: ${user.level}
🔗 Referral Code: ${user.personalCode || user.id}

🚀 Keep watching ads to earn more!
          `;
          await sendUserTelegramNotification(chatId, statsMessage);
        } else {
          await sendUserTelegramNotification(chatId, "❌ User not found. Please use /start first.");
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
        await sendUserTelegramNotification(chatId, "❌ Error fetching your statistics. Please try again.");
      }
      return true;
    }

    // Handle /admin command (admin only)
    if (text.startsWith('/admin')) {
      if (!isAdmin(chatId)) {
        await sendUserTelegramNotification(chatId, "❌ You don't have admin permissions.");
        return true;
      }
      
      const adminMessage = `
👑 <b>Admin Panel Access</b>

🌐 Access your admin panel at:
<code>https://your-render-app.onrender.com/admin</code>

From there you can:
• View withdrawal requests
• Approve/reject withdrawals  
• Monitor user activity
• View app statistics
      `;
      
      await sendUserTelegramNotification(chatId, adminMessage);
      return true;
    }

    // Default response for unrecognized commands
    await sendUserTelegramNotification(chatId, `
🤔 I don't understand that command.

Use /help to see available commands, or /start to begin earning!
    `);
    
    return true;
  } catch (error) {
    console.error('Error handling Telegram message:', error);
    return false;
  }
}

// Set up webhook (this should be called once to register the webhook with Telegram)
export async function setupTelegramWebhook(webhookUrl: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('Telegram bot token not configured');
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message'],
      }),
    });

    if (response.ok) {
      console.log('Telegram webhook set successfully');
      return true;
    } else {
      const errorData = await response.text();
      console.error('Failed to set Telegram webhook:', errorData);
      return false;
    }
  } catch (error) {
    console.error('Error setting up Telegram webhook:', error);
    return false;
  }
}