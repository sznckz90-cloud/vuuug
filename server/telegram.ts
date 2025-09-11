// Telegram Bot API integration for sending notifications
import TelegramBot from 'node-telegram-bot-api';
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


// Simple in-memory state management for promotion creation flow
const userPromotionStates = new Map();

interface PromotionState {
  step: 'awaiting_channel_url' | 'awaiting_bot_url' | 'awaiting_forwarded_message';
  type: 'channel' | 'bot';
  adCost: string;
  rewardAmount: string;
  totalSlots: number;
  url?: string;
  forwardedBotUsername?: string;
}

// Claim states removed - all task claiming happens in the App only

function setUserPromotionState(chatId: string, state: PromotionState) {
  userPromotionStates.set(chatId, state);
}

function getUserPromotionState(chatId: string): PromotionState | null {
  return userPromotionStates.get(chatId) || null;
}

function clearUserPromotionState(chatId: string) {
  userPromotionStates.delete(chatId);
}

// All claim state functions removed

export async function verifyChannelMembership(userId: number, channelUsername: string, botToken: string) {
    const bot = new TelegramBot(botToken);
    const member = await bot.getChatMember(channelUsername, userId);
    return member.status !== 'left';
}

// Extract bot username from URL
function extractBotUsernameFromUrl(url: string): string | null {
  try {
    // Handle various URL formats:
    // https://t.me/botname
    // https://t.me/botname?start=xxx
    // @botname
    
    let username = url;
    
    // Remove https://t.me/ prefix if present
    if (username.startsWith('https://t.me/')) {
      username = username.replace('https://t.me/', '');
    }
    
    // Remove @ prefix if present
    if (username.startsWith('@')) {
      username = username.substring(1);
    }
    
    // Remove query parameters (everything after ?)
    if (username.includes('?')) {
      username = username.split('?')[0];
    }
    
    return username || null;
  } catch (error) {
    console.error('❌ Error extracting bot username from URL:', error);
    return null;
  }
}

// All claim reward processing moved to the App only

// Send task completion notification to user
export async function sendTaskCompletionNotification(userId: string, rewardAmount: string): Promise<boolean> {
  try {
    const user = await storage.getUser(userId);
    if (!user || !user.telegram_id) {
      console.log('❌ User not found or no telegram_id for task completion notification');
      return false;
    }

    const notificationMessage = `🎉 Task Completed! ✅ You earned $${parseFloat(rewardAmount).toFixed(2)} 💎`;

    const success = await sendUserTelegramNotification(user.telegram_id, notificationMessage);
    console.log(`✅ Task completion notification sent to user ${userId}:`, success);
    return success;
  } catch (error) {
    console.error('❌ Error sending task completion notification:', error);
    return false;
  }
}

// Post promotion to Telegram channel and return message_id
export async function postPromotionToChannel(promotion: any): Promise<string | null> {
  if (!TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHANNEL_ID) {
    console.error('Missing Telegram bot token or channel ID for posting promotion');
    return null;
  }
  
  try {
    const channelMessage = `⭐World's Biggest Free Crypto Drop!⭐
💎 $${promotion.reward_per_user} Crypto → ${promotion.limit} Winners 🔥
🚀 Claim in 1 tap – before it's over!`;

    // Generate web app link to task section
    const botUsername = process.env.BOT_USERNAME || "lightningsatsbot";
    const webAppUrl = `https://t.me/${botUsername}?startapp=tasks`;
    
    const keyboard = {
      inline_keyboard: [[
        { 
          text: '👉 Open in App 👈', 
          url: webAppUrl 
        }
      ]]
    };

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHANNEL_ID,
        text: channelMessage,
        parse_mode: 'HTML',
        reply_markup: keyboard
      })
    });

    if (response.ok) {
      const result = await response.json();
      const messageId = result.result.message_id.toString();
      console.log('✅ Promotion posted to channel successfully:', messageId);
      
      // Update promotion with channel message ID for tracking
      if (messageId) {
        await storage.updatePromotionMessageId(promotion.id, messageId);
      }
      
      return messageId;
    } else {
      const errorData = await response.text();
      console.error('❌ Failed to post promotion to channel:', errorData);
      return null;
    }
  } catch (error) {
    console.error('❌ Error posting promotion to channel:', error);
    return null;
  }
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
      // Handle ReplyKeyboardMarkup properly
      if (replyMarkup.keyboard) {
        // This is a reply keyboard - format correctly
        telegramMessage.reply_markup = {
          keyboard: replyMarkup.keyboard,
          resize_keyboard: replyMarkup.resize_keyboard || true,
          one_time_keyboard: replyMarkup.one_time_keyboard || false
        } as any;
      } else {
        // This is an inline keyboard or other markup
        telegramMessage.reply_markup = replyMarkup;
      }
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
  const message = `Welcome to Lightning Sats Bot! You are authenticated ✅

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
  const keyboard = createBotKeyboard();
  
  // Send welcome message with inline keyboard first
  const welcomeSent = await sendUserTelegramNotification(userId, message, inlineKeyboard);
  
  // Then send the reply keyboard in a separate message
  const keyboardMessage = 'Please use the buttons below:';
  const keyboardSent = await sendUserTelegramNotification(userId, keyboardMessage, keyboard);
  
  return welcomeSent && keyboardSent;
}

// Admin broadcast functionality
export async function sendBroadcastMessage(message: string, adminTelegramId: string): Promise<{ success: number; failed: number }> {
  if (!isAdmin(adminTelegramId)) {
    console.error('❌ Unauthorized attempt to send broadcast message');
    return { success: 0, failed: 0 };
  }

  try {
    // Get all users from database
    const allUsers = await storage.getAllUsers();
    console.log(`📢 Broadcasting message to ${allUsers.length} users...`);
    
    let successCount = 0;
    let failedCount = 0;
    
    // Send message to each user (in batches to avoid rate limiting)
    for (const user of allUsers) {
      if (user.telegram_id) {
        try {
          const sent = await sendUserTelegramNotification(user.telegram_id, message);
          if (sent) {
            successCount++;
          } else {
            failedCount++;
          }
          // Small delay to avoid hitting Telegram rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`❌ Failed to send broadcast to user ${user.telegram_id}:`, error);
          failedCount++;
        }
      } else {
        failedCount++;
      }
    }
    
    console.log(`✅ Broadcast completed: ${successCount} successful, ${failedCount} failed`);
    
    // Send summary to admin
    const summaryMessage = `📢 Broadcast Summary:\n\n✅ Successfully sent: ${successCount}\n❌ Failed: ${failedCount}\n📊 Total users: ${allUsers.length}`;
    await sendUserTelegramNotification(adminTelegramId, summaryMessage);
    
    return { success: successCount, failed: failedCount };
  } catch (error) {
    console.error('❌ Error sending broadcast message:', error);
    return { success: 0, failed: 0 };
  }
}

// Handle incoming Telegram messages - simplified to only show welcome messages
export async function handleTelegramMessage(update: any): Promise<boolean> {
  try {
    console.log('🔄 Processing Telegram update...');
    
    // Handle callback queries (button presses)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.from.id.toString();
      const data = callbackQuery.data;
      
      if (data === 'refresh_stats' && isAdmin(chatId)) {
        try {
          const stats = await storage.getAppStats();
          
          const statsMessage = `📊 Application Stats\n\n👥 Total Registered Users: ${stats.totalUsers.toLocaleString()}\n👤 Active Users Today: ${stats.activeUsersToday}\n🔗 Total Friends Invited: ${stats.totalInvites.toLocaleString()}\n\n💰 Total Earnings (All Users): $${parseFloat(stats.totalEarnings).toFixed(2)}\n💎 Total Referral Earnings: $${parseFloat(stats.totalReferralEarnings).toFixed(2)}\n🏦 Total Payouts: $${parseFloat(stats.totalPayouts).toFixed(2)}\n\n🚀 Growth (Last 24h): +${stats.newUsersLast24h} new users`;
          
          const refreshButton = {
            inline_keyboard: [[
              { text: "🔃 Refresh 🔄", callback_data: "refresh_stats" }
            ]]
          };
          
          // Answer callback query and edit message
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackQuery.id })
          });
          
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: callbackQuery.message.message_id,
              text: statsMessage,
              parse_mode: 'HTML',
              reply_markup: refreshButton
            })
          });
        } catch (error) {
          console.error('❌ Error refreshing stats:', error);
        }
      }
      
      // Handle admin withdrawal approval
      if (data && data.startsWith('withdraw_paid_')) {
        const withdrawalId = data.replace('withdraw_paid_', '');
        
        if (!isAdmin(chatId)) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              callback_query_id: callbackQuery.id,
              text: 'Unauthorized access',
              show_alert: true
            })
          });
          return true;
        }
        
        try {
          const result = await storage.approveWithdrawal(withdrawalId, `Approved by admin ${chatId}`);
          
          if (result.success && result.withdrawal) {
            // Get user to send notification
            const user = await storage.getUser(result.withdrawal.userId);
            if (user && user.telegram_id) {
              const userMessage = `✅ Withdrawal Approved!\n\nYour withdrawal of $${parseFloat(result.withdrawal.amount).toFixed(2)} via ${result.withdrawal.method} has been approved and processed.\n\n💰 Amount has been deducted from your balance.`;
              await sendUserTelegramNotification(user.telegram_id, userMessage);
            }
            
            // Update admin message
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: callbackQuery.message.message_id,
                text: `✅ APPROVED\n\n${callbackQuery.message.text}\n\nStatus: Paid and processed by admin\nTime: ${new Date().toLocaleString()}`
              })
            });
            
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                callback_query_id: callbackQuery.id,
                text: 'Withdrawal approved successfully'
              })
            });
          } else {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                callback_query_id: callbackQuery.id,
                text: result.message,
                show_alert: true
              })
            });
          }
        } catch (error) {
          console.error('Error approving withdrawal:', error);
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              callback_query_id: callbackQuery.id,
              text: 'Error processing approval',
              show_alert: true
            })
          });
        }
        return true;
      }
      
      // Handle admin withdrawal rejection
      if (data && data.startsWith('withdraw_reject_')) {
        const withdrawalId = data.replace('withdraw_reject_', '');
        
        if (!isAdmin(chatId)) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              callback_query_id: callbackQuery.id,
              text: 'Unauthorized access',
              show_alert: true
            })
          });
          return true;
        }
        
        try {
          const result = await storage.rejectWithdrawal(withdrawalId, `Rejected by admin ${chatId}`);
          
          if (result.success && result.withdrawal) {
            // Get user to send notification
            const user = await storage.getUser(result.withdrawal.userId);
            if (user && user.telegram_id) {
              const userMessage = `❌ Withdrawal Rejected\n\nYour withdrawal request of $${parseFloat(result.withdrawal.amount).toFixed(2)} via ${result.withdrawal.method} has been rejected by the admin.\n\n💰 Your balance remains unchanged.`;
              await sendUserTelegramNotification(user.telegram_id, userMessage);
            }
            
            // Update admin message
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: callbackQuery.message.message_id,
                text: `❌ REJECTED\n\n${callbackQuery.message.text}\n\nStatus: Rejected by admin\nTime: ${new Date().toLocaleString()}`
              })
            });
            
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                callback_query_id: callbackQuery.id,
                text: 'Withdrawal rejected'
              })
            });
          } else {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                callback_query_id: callbackQuery.id,
                text: result.message,
                show_alert: true
              })
            });
          }
        } catch (error) {
          console.error('Error rejecting withdrawal:', error);
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              callback_query_id: callbackQuery.id,
              text: 'Error processing rejection',
              show_alert: true
            })
          });
        }
        return true;
      }
      
      return true;
    }
    
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
      referralCode: '', // This will be overridden by crypto generation in upsertTelegramUser
    });

    console.log(`📝 User upserted: ID=${dbUser.id}, TelegramID=${dbUser.telegram_id}, RefCode=${dbUser.referralCode}, IsNew=${isNewUser}`);


    
    
    // Handle /start command with referral processing and promotion claims
    if (text.startsWith('/start')) {
      console.log('🚀 Processing /start command...');
      // Extract parameter if present (e.g., /start REF123 or /start claim_promotionId)
      const parameter = text.split(' ')[1];
      
      // Handle promotion task claim
      if (parameter && parameter.startsWith('task_')) {
        const promotionId = parameter.replace('task_', '');
        console.log('🎁 Processing promotion task claim for:', promotionId);
        
        try {
          // Get the promotion details
          const promotion = await storage.getPromotion(promotionId);
          if (!promotion) {
            const errorMessage = '❌ This promotion no longer exists.';
            const keyboard = createBotKeyboard();
            await sendUserTelegramNotification(chatId, errorMessage, keyboard);
            return true;
          }
          
          // Check if promotion limit reached
          if ((promotion.claimedCount || 0) >= (promotion.limit || 1000)) {
            const limitMessage = '❌ This task is fully claimed, better luck next time.';
            const keyboard = createBotKeyboard();
            await sendUserTelegramNotification(chatId, limitMessage, keyboard);
            return true;
          }
          
          // Check if user already claimed this task
          const hasClaimed = await storage.hasUserClaimedPromotion(promotionId, dbUser.id);
          if (hasClaimed) {
            const alreadyClaimedMessage = '❌ You already claimed this task.';
            const keyboard = createBotKeyboard();
            await sendUserTelegramNotification(chatId, alreadyClaimedMessage, keyboard);
            return true;
          }
          
          // Send task instructions based on promotion type
          let taskMessage = '';
          let inlineButton = { text: '', url: promotion.url };
          
          if (promotion.type === 'channel') {
            taskMessage = `📢 Channel Task
🚀 Join the Channel & Complete Your Task!
💎 Fast, simple, and rewarding – don't miss out!`;
            inlineButton.text = 'Join the channel';
            
            // All task claiming now happens in the App only
          } else if (promotion.type === 'bot') {
            taskMessage = `🤖 Bot Task
⚡ Complete Your Task via Bot & Earn!
💥 Easy, instant rewards – just a few taps!`;
            inlineButton.text = 'Start bot';
            
            // All task claiming now happens in the App only
          }
          
          const inlineKeyboard = {
            inline_keyboard: [[inlineButton]]
          };
          
          const replyKeyboard = {
            keyboard: [
              [
                { text: '✅ Done' },
                { text: '❌ Cancel' }
              ]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
          };
          
          // Send message with inline button
          await sendUserTelegramNotification(chatId, taskMessage, inlineKeyboard);
          
          // Send follow-up message with reply keyboard
          const followUpMessage = 'Click "✅ Done" when you have completed the task, or "❌ Cancel" to exit.';
          await sendUserTelegramNotification(chatId, followUpMessage, replyKeyboard);
          return true;
          
        } catch (error) {
          console.error('❌ Error processing promotion task claim:', error);
          const errorMessage = '❌ Error processing your claim. Please try again.';
          const keyboard = createBotKeyboard();
          await sendUserTelegramNotification(chatId, errorMessage, keyboard);
          return true;
        }
      }
      
      // Extract referral code if present (e.g., /start REF123)
      const referralCode = parameter;
      
      // Process referral if referral code was provided (only for new users)
      if (isNewUser && referralCode && referralCode !== chatId) {
        console.log(`🔄 Processing referral: referralCode=${referralCode}, newUser=${chatId}, isNewUser=${isNewUser}`);
        try {
          // Find the referrer by referral_code (NOT telegram_id or user_id)
          const referrer = await storage.getUserByReferralCode(referralCode);
          
          if (referrer) {
            console.log(`👤 Found referrer: ${referrer.id} (${referrer.firstName || 'No name'}) via referral code: ${referralCode}`);
            console.log(`🔍 Referrer details: ID=${referrer.id}, TelegramID=${referrer.telegram_id}, RefCode=${referrer.referralCode}`);
            console.log(`🔍 New user details: ID=${dbUser.id}, TelegramID=${dbUser.telegram_id}, RefCode=${dbUser.referralCode}`);
            
            // Verify both users have valid IDs before creating referral
            if (!referrer.id || !dbUser.id) {
              console.error(`❌ Invalid user IDs: referrer.id=${referrer.id}, dbUser.id=${dbUser.id}`);
              throw new Error('Invalid user IDs for referral creation');
            }
            
            // Prevent self-referral by comparing user IDs
            if (referrer.id === dbUser.id) {
              console.log(`⚠️  Self-referral prevented: referrer.id=${referrer.id} === dbUser.id=${dbUser.id}`);
            } else {
              console.log(`💾 Creating referral relationship: ${referrer.id} -> ${dbUser.id}`);
              const createdReferral = await storage.createReferral(referrer.id, dbUser.id);
              console.log(`✅ Referral created successfully in database:`, {
                referralId: createdReferral.id,
                referrerId: createdReferral.referrerId,
                refereeId: createdReferral.refereeId,
                status: createdReferral.status,
                rewardAmount: createdReferral.rewardAmount
              });
              
              // Verify the referral was saved by querying it back
              const verifyReferral = await storage.getReferralByUsers(referrer.id, dbUser.id);
              if (verifyReferral) {
                console.log(`✅ Referral verification successful - found in database`);
              } else {
                console.error(`❌ Referral verification failed - not found in database after creation`);
              }
              
              // Send notification to referrer about successful referral
              try {
                const referrerName = referrer.firstName || referrer.username || 'User';
                const newUserName = dbUser.firstName || dbUser.username || 'User';
                await sendUserTelegramNotification(
                  referrer.telegram_id || '',
                  `🎉 Great news! ${newUserName} joined using your referral link. You'll earn $0.01 when they watch 10 ads!`
                );
                console.log(`📧 Referral notification sent to referrer: ${referrer.telegram_id}`);
              } catch (notificationError) {
                console.error('❌ Failed to send referral notification:', notificationError);
              }
            }
          } else {
            console.log(`❌ Invalid referral code: ${referralCode} - no user found with this referral code`);
            // Let's also check what referral codes exist in the database
            console.log(`🔍 Debugging: Let's check existing referral codes...`);
            try {
              const allUsers = await storage.getAllUsers(); // We'll need to implement this
              console.log(`📋 Total users in database: ${allUsers.length}`);
              allUsers.forEach(user => {
                console.log(`  - User ${user.id}: RefCode="${user.referralCode}", TelegramID=${user.telegram_id}`);
              });
            } catch (debugError) {
              console.error('❌ Failed to fetch users for debugging:', debugError);
            }
          }
        } catch (error) {
          console.error('❌ Referral processing failed:', error);
          console.error('Error details:', {
            referralCode: referralCode,
            newUserTelegramId: chatId,
            newUserDbId: dbUser.id,
            newUserRefCode: dbUser.referralCode,
            isNewUser,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined
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

      // Always send welcome message with referral code
      console.log('📤 Sending welcome message to:', chatId);
      
      // Ensure referral code exists for this user
      let finalUser = dbUser;
      if (!dbUser.referralCode) {
        console.log('🔄 Generating missing referral code for user:', dbUser.id);
        try {
          await storage.generateReferralCode(dbUser.id);
          // Fetch updated user with referral code
          finalUser = await storage.getUser(dbUser.id) || dbUser;
        } catch (error) {
          console.error('❌ Failed to generate referral code:', error);
        }
      }
      
      const messageSent = await sendWelcomeMessage(chatId);
      console.log('📧 Welcome message sent successfully:', messageSent);

      return true;
    }

    // Handle keyboard button presses
    if (text === '👤 Account') {
      console.log('⌨️ Processing Account button press');
      
      try {
        // Get user stats from database
        const referralStats = await storage.getUserReferrals(dbUser.id);
        
        // Calculate referral earnings
        const referralEarnings = await storage.getUserReferralEarnings(dbUser.id);
        
        // Format username
        const username = dbUser.username ? `@${dbUser.username}` : dbUser.firstName || 'User';
        
        // Format join date
        const joinDate = dbUser.createdAt ? new Date(dbUser.createdAt.toString()).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) : 'Unknown';
        
        const profileMessage = `📊 Your Earnings Dashboard

👤 Username: ${username}
🆔 User ID: ${dbUser.telegram_id}

👥 Total Friends Invited: ${referralStats?.length || 0}
💰 Total Earnings: $${parseFloat(dbUser.totalEarned || '0').toFixed(2)}
💎 Current Balance: $${parseFloat(dbUser.balance || '0').toFixed(2)}
🎁 Earnings from Referrals: $${parseFloat(referralEarnings || '0').toFixed(2)}
📅 Joined On: ${joinDate}

🚀 Keep sharing your invite link daily and multiply your earnings!`;
        
        const keyboard = createBotKeyboard();
        const messageSent = await sendUserTelegramNotification(chatId, profileMessage, keyboard);
        console.log('📧 Profile message sent successfully:', messageSent);
        
        return true;
      } catch (error) {
        console.error('❌ Error fetching profile data:', error);
        const errorMessage = '❌ Sorry, there was an error fetching your profile data. Please try again later.';
        const keyboard = createBotKeyboard();
        await sendUserTelegramNotification(chatId, errorMessage, keyboard);
        return true;
      }
    }
    
    
    if (text === '👥 Affiliates') {
      console.log('⌨️ Processing Affiliates button press');
      
      // Ensure referral code exists for this user
      let finalUser = dbUser;
      if (!dbUser.referralCode) {
        console.log('🔄 Generating missing referral code for user:', dbUser.id);
        try {
          await storage.generateReferralCode(dbUser.id);
          finalUser = await storage.getUser(dbUser.id) || dbUser;
        } catch (error) {
          console.error('❌ Failed to generate referral code:', error);
        }
      }
      
      // Generate referral link
      const botUsername = process.env.BOT_USERNAME || "LightningSatsbot";
      const referralLink = `https://t.me/${botUsername}?start=${finalUser.referralCode}`;
      
      const affiliatesMessage = `🔗 Your Personal Invite Link:
${referralLink}

💵 Get $0.01 for every friend who joins!
🚀 Share now and start building your earnings instantly.`;
      
      const keyboard = createBotKeyboard();
      const messageSent = await sendUserTelegramNotification(chatId, affiliatesMessage, keyboard);
      console.log('📧 Affiliates message sent successfully:', messageSent);
      
      return true;
    }
    
    if (text === '📈 Promotion') {
      console.log('⌨️ Processing Promotion button press');
      
      const promotionMessage = `📈 Promotion
→ 📝 Creation of an ad campaign

Choose promotion type:`;
      
      const promotionKeyboard = {
        keyboard: [
          [
            '📢 Channel',
            '🤖 Bot'
          ],
          [
            '⬅️ Back'
          ]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      };
      
      await sendUserTelegramNotification(chatId, promotionMessage, promotionKeyboard);
      return true;
    }
    
    if (text === '⁉️ How-to') {
      console.log('⌨️ Processing How-to button press');
      
      const howToMessage = `⁉️ How to Use CashWatch Bot

🔸 **Account** - View your profile and earnings
🔸 **Affiliates** - Get your referral link to invite friends
🔸 **Promotion** - Create ad campaigns to promote your channels/bots

💰 **How to Earn:**
• Complete tasks in the app
• Refer friends with your link
• Create promotions for others to complete

🚀 Start by visiting the web app and completing available tasks!`;
      
      const keyboard = createBotKeyboard();
      await sendUserTelegramNotification(chatId, howToMessage, keyboard);
      return true;
    }
    
    
    if (text === '🏠 Start Earning') {
      console.log('⌨️ Processing Start Earning button press');
      // Send welcome message with web app link
      const keyboard = createBotKeyboard();
      const { message } = formatWelcomeMessage();
      const messageSent = await sendUserTelegramNotification(chatId, message, keyboard);
      console.log('📧 Start Earning message sent successfully:', messageSent);
      return true;
    }
    
    if (text === '🔙 Back to Menu') {
      console.log('⌨️ Processing Back to Menu button press');
      // Clear any promotion state and return to main menu
      clearUserPromotionState(chatId);
      
      const welcomeMessage = 'Welcome back to the main menu!';
      const keyboard = createBotKeyboard();
      await sendUserTelegramNotification(chatId, welcomeMessage, keyboard);
      return true;
    }
    
    if (text === '📢 Channel') {
      console.log('⌨️ Processing Channel promotion type');
      
      const channelMessage = `📈 Create Ad Campaign Telegram — Subscribe / Join
⚠️ Make the bot admin in your channel for easy join & verification.
💰 Ad Cost: $0.01 (1000 users)
📝 Channel URL:`;
      
      // Set user state to awaiting channel URL
      setUserPromotionState(chatId, {
        step: 'awaiting_channel_url',
        type: 'channel',
        adCost: '0.01',
        rewardAmount: '0.00025',
        totalSlots: 1000
      });
      
      const keyboard = {
        keyboard: [
          [
            '⬅️ Back'
          ]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      };
      
      await sendUserTelegramNotification(chatId, channelMessage, keyboard);
      return true;
    }
    
    if (text === '🤖 Bot') {
      console.log('⌨️ Processing Bot promotion type');
      
      const botMessage = `📈 Create Ad Campaign Telegram: launch the bot
🔎 FORWARD a message from the bot`;
      
      // Set user state to awaiting forwarded message
      setUserPromotionState(chatId, {
        step: 'awaiting_forwarded_message',
        type: 'bot',
        adCost: '0.01',
        rewardAmount: '0.00025',
        totalSlots: 1000
      });
      
      const keyboard = {
        keyboard: [
          [
            '⬅️ Back'
          ]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      };
      
      await sendUserTelegramNotification(chatId, botMessage, keyboard);
      return true;
    }
    
    // Handle Back button in promotion flow
    if (text === '⬅️ Back') {
      console.log('⌨️ Processing Back button');
      
      // Check if user is in promotion state
      const promotionState = getUserPromotionState(chatId);
      if (promotionState) {
        clearUserPromotionState(chatId);
        
        // Go back to promotion menu
        const promotionMessage = `📈 Promotion
→ 📝 Creation of an ad campaign`;
        
        const promotionKeyboard = {
          keyboard: [
            [
              '📢 Channel',
              '🤖 Bot'
            ],
            [
              '⬅️ Back'
            ]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        };
        
        await sendUserTelegramNotification(chatId, promotionMessage, promotionKeyboard);
        return true;
      }
      
      // Default back to main menu
      const keyboard = createBotKeyboard();
      const backMessage = 'Back to main menu.';
      await sendUserTelegramNotification(chatId, backMessage, keyboard);
      return true;
    }
    
    // Handle Cancel button in promotion flow
    if (text === '❌ Cancel') {
      console.log('⌨️ Processing Cancel button');
      
      const promotionState = getUserPromotionState(chatId);
      
      if (promotionState) {
        clearUserPromotionState(chatId);
        
        const keyboard = createBotKeyboard();
        const cancelMessage = '❌ Promotion creation cancelled.';
        await sendUserTelegramNotification(chatId, cancelMessage, keyboard);
        return true;
      }
      
      // Default back to main menu if not in any state
      const keyboard = createBotKeyboard();
      const backMessage = 'Back to main menu.';
      await sendUserTelegramNotification(chatId, backMessage, keyboard);
      return true;
    }

    // ✅ Done button removed - all task claiming happens in the App only

    // Handle forwarded message for bot promotion creation
    if (update.message && update.message.forward_from) {
      const promotionState = getUserPromotionState(chatId);
      if (promotionState && promotionState.step === 'awaiting_forwarded_message' && promotionState.type === 'bot') {
        console.log('📨 Processing forwarded message for bot promotion');
        
        // Extract bot username from forwarded message
        const forwardedFrom = update.message.forward_from;
        if (forwardedFrom.is_bot && forwardedFrom.username) {
          const botUsername = forwardedFrom.username;
          
          // Update state with forwarded bot username and ask for bot link
          setUserPromotionState(chatId, {
            ...promotionState,
            step: 'awaiting_bot_url',
            forwardedBotUsername: botUsername
          });
          
          const botLinkMessage = `🔗 Send the bot LINK
ℹ️ It can be your referral link or any bot link
⚠️ Must start with https://t.me/${botUsername}`;
          
          const keyboard = {
            keyboard: [
              [
                '⬅️ Back'
              ]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
          };
          
          await sendUserTelegramNotification(chatId, botLinkMessage, keyboard);
          return true;
        } else {
          const errorMessage = '❌ Please forward a message from a bot, not a regular user.';
          
          const keyboard = {
            keyboard: [
              [
                '⬅️ Back'
              ]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
          };
          
          await sendUserTelegramNotification(chatId, errorMessage, keyboard);
          return true;
        }
      }
    }

    // All claim verification removed - tasks can only be completed in the App

    // Handle promotion URL collection
    const promotionState = getUserPromotionState(chatId);
    if (promotionState && (promotionState.step === 'awaiting_channel_url' || promotionState.step === 'awaiting_bot_url')) {
      console.log('📝 Processing promotion URL from user:', chatId);
      
      const url = text.trim();
      
      // URL validation based on promotion type
      if (promotionState.step === 'awaiting_channel_url') {
        // Validate channel link
        if (!url.startsWith('https://t.me/')) {
          const errorMessage = '❌ Please enter a valid channel link (should start with https://t.me/)';
          const keyboard = {
            keyboard: [
              [
                '⬅️ Back'
              ]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
          };
          await sendUserTelegramNotification(chatId, errorMessage, keyboard);
          return true;
        }
      } else if (promotionState.step === 'awaiting_bot_url') {
        // Validate bot link - must start with https://t.me/ and match forwarded bot username
        const expectedBotUsername = promotionState.forwardedBotUsername;
        if (!expectedBotUsername) {
          const errorMessage = '❌ Bot username not found. Please restart the bot promotion process.';
          const keyboard = {
            keyboard: [
              [
                '⬅️ Back',
                '❌ Cancel'
              ]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
          };
          await sendUserTelegramNotification(chatId, errorMessage, keyboard);
          return true;
        }
        
        if (!url.startsWith(`https://t.me/${expectedBotUsername}`)) {
          const errorMessage = `❌ Please enter a valid bot link that starts with https://t.me/${expectedBotUsername}`;
          const keyboard = {
            keyboard: [
              [
                '⬅️ Back',
                '❌ Cancel'
              ]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
          };
          await sendUserTelegramNotification(chatId, errorMessage, keyboard);
          return true;
        }
      }
      
      // Check user's main balance (for promotion costs)
      // Note: Admins have unlimited balance
      const isAdmin = dbUser.telegram_id === process.env.TELEGRAM_ADMIN_ID;
      const userBalance = await storage.getUserBalance(dbUser.id);
      const currentMainBalance = parseFloat(userBalance?.balance || '0');
      const adCost = parseFloat(promotionState.adCost);
      
      if (!isAdmin && currentMainBalance < adCost) {
        clearUserPromotionState(chatId);
        
        const insufficientBalanceMessage = `❌ You don't have enough balance to advertise. ⭐ Use /deposit to add more balance.`;
        
        const keyboard = createBotKeyboard();
        await sendUserTelegramNotification(chatId, insufficientBalanceMessage, keyboard);
        return true;
      }
      
      // Create the promotion
      try {
        // Server-side validation for channel promotion costs
        if (promotionState.type === 'channel') {
          if (promotionState.adCost !== '0.01' || promotionState.totalSlots !== 1000) {
            const errorMessage = '❌ Channel promotion must cost exactly $0.01 for 1000 users.';
            const keyboard = createBotKeyboard();
            await sendUserTelegramNotification(chatId, errorMessage, keyboard);
            clearUserPromotionState(chatId);
            return true;
          }
        }
        
        const title = promotionState.type === 'channel' 
          ? 'Telegram: subscribe to the channel / join the chat'
          : 'Telegram: launch the bot';
        
        const promotion = await storage.createPromotion({
          ownerId: dbUser.id,
          type: promotionState.type,
          title: title,
          description: `${title} (${url})`,
          url: url,
          rewardPerUser: promotionState.rewardAmount,
          cost: promotionState.adCost,
          limit: promotionState.totalSlots,
          status: 'active'
        });
        
        // Deduct the ad cost from user's balance
        await storage.deductBalance(dbUser.id, promotionState.adCost);
        
        // Post to channel automatically
        await postPromotionToChannel(promotion);
        
        // Clear state
        clearUserPromotionState(chatId);
        
        const successMessage = `📈 Ad campaign ${title} (${url}) successfully created.`;
        
        const keyboard = createBotKeyboard();
        await sendUserTelegramNotification(chatId, successMessage, keyboard);
        return true;
        
      } catch (error) {
        console.error('❌ Error creating promotion:', error);
        clearUserPromotionState(chatId);
        
        const errorMessage = '❌ Failed to create promotion. Please try again.';
        const keyboard = createBotKeyboard();
        await sendUserTelegramNotification(chatId, errorMessage, keyboard);
        return true;
      }
    }



    // Admin command to list pending withdrawal requests
    if (text === '/payouts' || text === '/withdrawals') {
      if (!isAdmin(chatId)) {
        return true; // Ignore command for non-admins
      }
      
      console.log('💰 Processing admin payouts list command');
      
      try {
        const pendingWithdrawals = await storage.getAllPendingWithdrawals();
        
        if (pendingWithdrawals.length === 0) {
          const noRequestsMessage = '📋 No pending withdrawal requests found.';
          await sendUserTelegramNotification(chatId, noRequestsMessage);
          return true;
        }
        
        let requestsList = '💵 Pending Withdrawal Requests:\n\n';
        
        for (const withdrawal of pendingWithdrawals) {
          const user = await storage.getUser(withdrawal.userId);
          const userName = user ? (user.firstName || user.username || 'Unknown User') : 'Unknown User';
          const details = withdrawal.details as any;
          
          requestsList += `👤 User: ${userName} (ID: ${user?.telegram_id || 'N/A'})\n`;
          requestsList += `💰 Amount: $${parseFloat(withdrawal.amount).toFixed(2)}\n`;
          requestsList += `💳 Method: ${withdrawal.method}\n`;
          requestsList += `📋 Details: ${details?.paymentDetails || 'N/A'}\n`;
          requestsList += `⏰ Requested: ${withdrawal.createdAt ? new Date(withdrawal.createdAt.toString()).toLocaleString() : 'Unknown'}\n`;
          requestsList += `📝 ID: ${withdrawal.id}\n\n`;
        }
        
        // Send admin notification with inline buttons for each withdrawal
        for (const withdrawal of pendingWithdrawals) {
          const user = await storage.getUser(withdrawal.userId);
          const userName = user ? (user.firstName || user.username || 'Unknown User') : 'Unknown User';
          const details = withdrawal.details as any;
          
          const adminMessage = `💵 Withdraw request from user ${userName} (ID: ${user?.telegram_id || 'N/A'})\nAmount: $${parseFloat(withdrawal.amount).toFixed(2)}\nPayment System: ${withdrawal.method}\nPayment Details: ${details?.paymentDetails || 'N/A'}\nTime: ${withdrawal.createdAt ? new Date(withdrawal.createdAt.toString()).toLocaleString() : 'Unknown'}`;
          
          const adminKeyboard = {
            inline_keyboard: [
              [
                { text: "✅ Paid", callback_data: `withdraw_paid_${withdrawal.id}` },
                { text: "❌ Reject", callback_data: `withdraw_reject_${withdrawal.id}` }
              ]
            ]
          };
          
          await sendUserTelegramNotification(chatId, adminMessage, adminKeyboard);
        }
        
        return true;
      } catch (error) {
        console.error('❌ Error fetching pending withdrawals:', error);
        const errorMessage = '❌ Error fetching withdrawal requests.';
        await sendUserTelegramNotification(chatId, errorMessage);
        return true;
      }
    }

    // Handle Back button navigation
    if (text === '⬅️ Back' || text === '🔙 Back to Menu') {
      console.log('⌨️ Processing Back button press');
      
      // Clear any active states
      clearUserPromotionState(chatId);
      
      const backMessage = 'Back to main menu:';
      const keyboard = createBotKeyboard();
      await sendUserTelegramNotification(chatId, backMessage, keyboard);
      return true;
    }

    // Handle Channel promotion type selection
    if (text === '📢 Channel') {
      console.log('⌨️ Processing Channel promotion type');
      
      setUserPromotionState(chatId, {
        step: 'awaiting_channel_url',
        type: 'channel',
        adCost: '0.01',
        rewardAmount: '0.00025',
        totalSlots: 1000
      });
      
      const channelMessage = `📢 Channel Promotion

Please enter your channel URL (e.g., https://t.me/yourchannel):`;
      
      const channelKeyboard = {
        keyboard: [
          ['❌ Cancel'],
          ['⬅️ Back']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      };
      
      await sendUserTelegramNotification(chatId, channelMessage, channelKeyboard);
      return true;
    }

    // Handle Bot promotion type selection  
    if (text === '🤖 Bot') {
      console.log('⌨️ Processing Bot promotion type');
      
      setUserPromotionState(chatId, {
        step: 'awaiting_bot_url',
        type: 'bot',
        adCost: '0.01',
        rewardAmount: '0.00025',
        totalSlots: 1000
      });
      
      const botMessage = `🤖 Bot Promotion

Please enter your bot URL (e.g., https://t.me/yourbot):`;
      
      const botKeyboard = {
        keyboard: [
          ['❌ Cancel'],
          ['⬅️ Back']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      };
      
      await sendUserTelegramNotification(chatId, botMessage, botKeyboard);
      return true;
    }



    // For any other message, show the main keyboard
    console.log('❓ Unknown message, showing main menu to:', chatId);
    
    const instructionMessage = 'Please use the buttons below:';
    const keyboard = createBotKeyboard();
    const messageSent = await sendUserTelegramNotification(chatId, instructionMessage, keyboard);
    console.log('📧 Main menu message sent successfully:', messageSent);
    
    return true;
  } catch (error) {
    console.error('Error handling Telegram message:', error);
    return false;
  }
}

// No slash commands - using keyboard buttons only

// Create reply keyboard with command buttons
export function createBotKeyboard() {
  return {
    keyboard: [
      [
        '👤 Account',
        '👥 Affiliates'
      ],
      [
        '📈 Promotion',
        '⁉️ How-to'
      ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false  // This makes the keyboard persistent
  };
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
        allowed_updates: ['message', 'callback_query'],
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