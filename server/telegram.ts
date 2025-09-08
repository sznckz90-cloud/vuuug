// Telegram Bot API integration for sending notifications
import { storage } from './storage';

const isAdmin = (telegram_id: string): boolean => {
  const adminId = process.env.TELEGRAM_ADMIN_ID;
  return adminId === telegram_id;
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
  const message = `🔥 Welcome to the Future of Ad Earnings! 🔥

😏 Forget those trash apps giving you $0.1 after a month.
Here, every ad = real cash, fast payouts.

🚀 Your time = Money. No excuses.
💸 Watch. Earn. Withdraw. Repeat.

👉 Ready to turn your screen-time into income? Let's go!`;

const inlineKeyboard = {
  inline_keyboard: [
    [
      {
        text: "🚀 Start Earning",
        web_app: { url: process.env.RENDER_EXTERNAL_URL || "https://lighting-sats-app.onrender.com" } // Telegram Mini App
      }
    ],
    [
      {
        text: "📢 Stay Updated",
        url: "https://t.me/LightingSats"
      },
      {
        text: "💬 Need Help?",
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

// Handle incoming Telegram messages - simplified to only show welcome messages
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

    // Create/update user for ANY message (not just /start)
    // This ensures users are automatically registered when they interact with the bot
    const { user: dbUser, isNewUser } = await storage.upsertTelegramUser(chatId, {
      email: user.username ? `${user.username}@telegram.user` : `${chatId}@telegram.user`,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      personalCode: user.username || chatId,
      withdrawBalance: '0',
      totalEarnings: '0',
      adsWatched: 0,
      dailyAdsWatched: 0,
      dailyEarnings: '0',
      level: 1,
      flagged: false,
      banned: false,
    });

    console.log(`📝 User upserted: ID=${dbUser.id}, TelegramID=${dbUser.telegram_id}, RefCode=${dbUser.referralCode}, IsNew=${isNewUser}`);

    // Handle /start command with referral processing
    if (text.startsWith('/start')) {
      console.log('🚀 Processing /start command...');
      // Extract referral code if present (e.g., /start REF123)
      const referralCode = text.split(' ')[1];
      
      // Process referral if referral code was provided (only for new users)
      if (isNewUser && referralCode && referralCode !== chatId) {
        console.log(`🔄 Processing referral: referralCode=${referralCode}, newUser=${chatId}, isNewUser=${isNewUser}`);
        try {
          // Find the referrer by referral_code (NOT telegram_id or user_id)
          const referrer = await storage.getUserByReferralCode(referralCode);
          
          if (referrer) {
            console.log(`👤 Found referrer: ${referrer.id} (${referrer.firstName || 'No name'}) via referral code: ${referralCode}`);
            await storage.createReferral(referrer.id, dbUser.id);
            console.log(`✅ Referral created successfully: ${referrer.id} -> ${dbUser.id}`);
          } else {
            console.log(`❌ Invalid referral code: ${referralCode} - no user found with this referral code`);
          }
        } catch (error) {
          console.error('❌ Referral processing failed:', error);
          console.error('Error details:', {
            referralCode: referralCode,
            newUserTelegramId: chatId,
            newUserDbId: dbUser.id,
            isNewUser,
            errorMessage: error instanceof Error ? error.message : String(error)
          });
        }
      } else {
        if (!isNewUser) {
          console.log(`ℹ️  Skipping referral - user ${chatId} already exists`);
        }
        if (!referralCode) {
          console.log(`ℹ️  No referral code provided in /start command`);
        }
        if (referralCode === chatId) {
          console.log(`⚠️  Self-referral attempted: ${chatId}`);
        }
      }

      // Always send welcome message
      console.log('📤 Sending welcome message to:', chatId);
      const messageSent = await sendWelcomeMessage(chatId);
      console.log('📧 Welcome message sent successfully:', messageSent);

      return true;
    }

    // For any other message, just send welcome message (no other commands supported)
    console.log('📤 Sending welcome message for any interaction to:', chatId);
    const messageSent = await sendWelcomeMessage(chatId);
    console.log('📧 Welcome message sent successfully:', messageSent);
    
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