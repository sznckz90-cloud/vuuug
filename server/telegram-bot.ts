
import TelegramBot from 'node-telegram-bot-api';

const BOT_TOKEN = '7561099955:AAGZcVgDyWJ3CZ-gvFSNxicTGvJDFojNjug';
const WEBHOOK_URL = 'https://lighting-sats-app.onrender.com';

// Create bot instance
const bot = new TelegramBot(BOT_TOKEN);

// Set webhook
export async function setupTelegramBot() {
  try {
    await bot.setWebHook(`${WEBHOOK_URL}/bot${BOT_TOKEN}`);
    console.log('Telegram webhook set successfully');
  } catch (error) {
    console.error('Failed to set webhook:', error);
  }
}

// Welcome message with inline buttons
export function sendWelcomeMessage(chatId: number) {
  const welcomeMessage = `👋 **Welcome! Nice to meet you.**

⚡**Earn SATS in our app by watching Ads & completing simple tasks.**

🎬**Watch Ads → Earn SATS**
**Withdraw → Enjoy 🚀**

🤝 **Invite your friends & earn up to 10% extra from their ads!**

💰 **Highest Payouts**
**$0.0003 per ad (3x more)**

🗑️ **Other apps pay only**
**$0.0001 - $0.00015 per ad.**

👇**Click on the Get paid button**💰`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: '🫶 Subscribe to us',
          url: 'https://t.me/LightingSats'
        }
      ],
      [
        {
          text: '💬 Join community',
          url: 'https://t.me/Official_Lightingsats'
        }
      ],
      [
        {
          text: '💰 Get Paid',
          web_app: {
            url: 'https://lighting-sats-app.onrender.com'
          }
        }
      ]
    ]
  };

  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}

// Handle /start command
export function handleStartCommand(msg: any) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name;
  
  console.log(`User ${userId} (${firstName}) started the bot`);
  
  // Send welcome message with inline buttons
  sendWelcomeMessage(chatId);
}

// Process webhook updates
export function processTelegramUpdate(update: any) {
  if (update.message) {
    const message = update.message;
    
    if (message.text === '/start') {
      handleStartCommand(message);
    }
  }
}
