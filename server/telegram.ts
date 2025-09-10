// Telegram Bot API integration for sending notifications
import { storage, PAYMENT_SYSTEMS } from './storage';

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

// Simple in-memory state management for payout flow
const userPayoutStates = new Map();

interface PayoutState {
  step: 'awaiting_details' | 'awaiting_confirmation';
  paymentSystem: any;
  amount: string;
  paymentDetails?: string;
}

function setUserPayoutState(chatId: string, state: PayoutState) {
  userPayoutStates.set(chatId, state);
}

function getUserPayoutState(chatId: string): PayoutState | null {
  return userPayoutStates.get(chatId) || null;
}

function clearUserPayoutState(chatId: string) {
  userPayoutStates.delete(chatId);
}

// Simple in-memory state management for promotion creation flow
const userPromotionStates = new Map();

interface PromotionState {
  step: 'awaiting_channel_url' | 'awaiting_bot_url';
  type: 'channel' | 'bot';
  adCost: string;
  rewardAmount: string;
  totalSlots: number;
  url?: string;
}

// Simple in-memory state management for claim flow
const userClaimStates = new Map();

interface ClaimState {
  promotionId: string;
  promotionType: 'channel' | 'bot';
  sponsorUrl: string;
  rewardAmount: string;
  step: 'awaiting_verification' | 'awaiting_forwarded_message';
}

function setUserPromotionState(chatId: string, state: PromotionState) {
  userPromotionStates.set(chatId, state);
}

function getUserPromotionState(chatId: string): PromotionState | null {
  return userPromotionStates.get(chatId) || null;
}

function clearUserPromotionState(chatId: string) {
  userPromotionStates.delete(chatId);
}

function setUserClaimState(chatId: string, state: ClaimState) {
  userClaimStates.set(chatId, state);
}

function getUserClaimState(chatId: string): ClaimState | null {
  return userClaimStates.get(chatId) || null;
}

function clearUserClaimState(chatId: string) {
  userClaimStates.delete(chatId);
}

// Verify channel membership via bot admin status
async function verifyChannelMembership(userId: string, channelUrl: string): Promise<boolean> {
  try {
    // Extract channel username from URL
    const channelUsername = channelUrl.replace('https://t.me/', '').replace('@', '');
    
    // Check if user is a member of the channel
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: `@${channelUsername}`,
        user_id: userId
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.ok) {
        const memberStatus = result.result.status;
        // User is considered a member if they are member, administrator, or creator
        return ['member', 'administrator', 'creator'].includes(memberStatus);
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Error verifying channel membership:', error);
    return false;
  }
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

// Process claim reward after successful verification
async function processClaimReward(chatId: string, claimState: ClaimState, dbUser: any): Promise<void> {
  try {
    // Create promotion claim record
    await storage.createPromotionClaim({
      promotionId: claimState.promotionId,
      userId: dbUser.id,
      rewardAmount: claimState.rewardAmount
    });
    
    // Increment claimed count in promotions
    await storage.incrementPromotionClaimedCount(claimState.promotionId);
    
    // Update user balance
    await storage.addEarningsBalance(dbUser.id, claimState.rewardAmount);
    
    // Get updated balance
    const updatedUser = await storage.getUser(dbUser.id);
    const newBalance = parseFloat(updatedUser?.balance || '0');
    
    // Clear claim state
    clearUserClaimState(chatId);
    
    // Send success message
    const successMessage = `🎉 Task Completed!
✅ You earned $${claimState.rewardAmount} 💎
New balance: ${newBalance.toFixed(4)}`;
    
    const keyboard = createBotKeyboard();
    await sendUserTelegramNotification(chatId, successMessage, keyboard);
    
  } catch (error) {
    console.error('❌ Error processing claim reward:', error);
    clearUserClaimState(chatId);
    
    const errorMessage = '❌ Error processing reward. Please try again.';
    const keyboard = createBotKeyboard();
    await sendUserTelegramNotification(chatId, errorMessage, keyboard);
  }
}

// Post promotion to Telegram channel and return message_id
export async function postPromotionToChannel(promotion: any): Promise<string | null> {
  if (!TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHANNEL_ID) {
    console.error('Missing Telegram bot token or channel ID for posting promotion');
    return null;
  }
  
  try {
    const channelMessage = `🌍 World's Biggest Free Crypto Drop! 🌍
💎 $${promotion.reward_per_user} Crypto → ${promotion.limit} Winners 🔥
🤯 Imagine… ${promotion.limit} people flexing FREE crypto – why not YOU?
✨ Sponsored by 👉 ${promotion.url}
🚀 Claim in 1 tap – before it's over!
👉 Grab Your Free Crypto Now 👈`;

    // Generate claim link for the promotion with task parameter
    const botUsername = process.env.BOT_USERNAME || "lightningsatsbot";
    const claimLink = `https://t.me/${botUsername}?start=task_${promotion.id}`;
    
    const keyboard = {
      inline_keyboard: [[
        { 
          text: '👉 Grab Your Free Crypto Now 👈', 
          url: claimLink 
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
      
      // Handle payment system selection
      if (data && data.startsWith('payout_')) {
        const paymentSystemId = data.replace('payout_', '');
        
        try {
          // Get user from database  
          const dbUser = await storage.getUser(chatId);
          if (!dbUser) {
            console.error('❌ User not found for payout callback');
            return true;
          }
          
          // Import payment systems
          const { PAYMENT_SYSTEMS } = await import('./storage');
          const selectedSystem = PAYMENT_SYSTEMS.find(system => system.id === paymentSystemId);
          
          if (!selectedSystem) {
            console.error('❌ Invalid payment system selected:', paymentSystemId);
            return true;
          }
          
          const userBalance = parseFloat(dbUser.balance || '0');
          
          // Check if balance meets minimum for selected payment system
          if (userBalance < selectedSystem.minWithdrawal) {
            const insufficientMessage = `Your balance is not enough for ${selectedSystem.name}. Minimum withdrawal is $${selectedSystem.minWithdrawal.toFixed(2)}.`;
            
            // Answer callback query first
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                callback_query_id: callbackQuery.id,
                text: insufficientMessage,
                show_alert: true
              })
            });
            return true;
          }
          
          // Set user state for payout flow
          setUserPayoutState(chatId, {
            step: 'awaiting_details',
            paymentSystem: selectedSystem,
            amount: userBalance.toString()
          });
          
          // Ask for payment details based on system
          let detailsMessage = '';
          let instructionText = '';
          
          switch (selectedSystem.id) {
            case 'telegram_stars':
              detailsMessage = `💫 Telegram Stars Payout\n\nAmount: $${userBalance.toFixed(2)}\nMinimum: $${selectedSystem.minWithdrawal.toFixed(2)}\n\n📝 Please enter your Telegram username (without @):`;
              instructionText = 'Please provide your Telegram username';
              break;
            case 'tether_polygon':
              detailsMessage = `🔶 Tether (Polygon) Payout\n\nAmount: $${userBalance.toFixed(2)}\nMinimum: $${selectedSystem.minWithdrawal.toFixed(2)}\n\n📝 Please enter your Polygon wallet address:`;
              instructionText = 'Please provide your Polygon wallet address';
              break;
            case 'ton_coin':
              detailsMessage = `💎 TON Coin Payout\n\nAmount: $${userBalance.toFixed(2)}\nMinimum: $${selectedSystem.minWithdrawal.toFixed(2)}\n\n📝 Please enter your TON wallet address:`;
              instructionText = 'Please provide your TON wallet address';
              break;
            case 'litecoin':
              detailsMessage = `🪙 Litecoin Payout\n\nAmount: $${userBalance.toFixed(2)}\nMinimum: $${selectedSystem.minWithdrawal.toFixed(2)}\n\n📝 Please enter your Litecoin wallet address:`;
              instructionText = 'Please provide your Litecoin wallet address';
              break;
            default:
              detailsMessage = `Payment details required for ${selectedSystem.name}`;
              instructionText = 'Please provide your payment details';
          }
          
          // Answer callback query
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              callback_query_id: callbackQuery.id,
              text: instructionText
            })
          });
          
          // Edit original message to ask for payment details
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: callbackQuery.message.message_id,
              text: detailsMessage
            })
          });
          
        } catch (error) {
          console.error('❌ Error processing payout callback:', error);
          
          // Answer callback query with error
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              callback_query_id: callbackQuery.id,
              text: 'Failed to process payout request. Please try again.',
              show_alert: true
            })
          });
        }
      }
      
      // Handle payout confirmation
      if (data && data.startsWith('confirm_payout_')) {
        const confirmationData = JSON.parse(data.replace('confirm_payout_', ''));
        
        try {
          const dbUser = await storage.getUser(chatId);
          if (!dbUser) {
            console.error('❌ User not found for payout confirmation');
            return true;
          }
          
          // Process the payout with collected details
          const payoutResult = await storage.createPayoutRequest(
            dbUser.id, 
            confirmationData.amount, 
            confirmationData.paymentSystemId,
            confirmationData.paymentDetails
          );
          
          if (payoutResult.success) {
            const successMessage = `✅ Payout Request Confirmed\n\nYour ${confirmationData.paymentSystemName} withdrawal request has been submitted successfully and will be processed within 1 hour.\n\n📧 You'll receive a notification once processed.`;
            
            // Answer callback query
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callback_query_id: callbackQuery.id })
            });
            
            // Edit message with success
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: callbackQuery.message.message_id,
                text: successMessage
              })
            });
            
            // Clear user state
            clearUserPayoutState(chatId);
            
            // Send admin notification with payment details
            const userName = dbUser.firstName || dbUser.username || 'User';
            const adminMessage = `💰 New Payout Request\n\n👤 User: ${userName}\n🆔 Telegram ID: ${dbUser.telegram_id}\n💰 Amount: $${parseFloat(confirmationData.amount).toFixed(2)}\n💳 Payment System: ${confirmationData.paymentSystemName}\n📋 Payment Details: ${confirmationData.paymentDetails}\n⏰ Time: ${new Date().toLocaleString()}`;
            
            if (TELEGRAM_ADMIN_ID) {
              await sendUserTelegramNotification(TELEGRAM_ADMIN_ID, adminMessage);
            }
          } else {
            // Answer callback query with error
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                callback_query_id: callbackQuery.id,
                text: payoutResult.message,
                show_alert: true
              })
            });
            
            // Clear user state on error
            clearUserPayoutState(chatId);
          }
        } catch (error) {
          console.error('❌ Error confirming payout:', error);
          
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              callback_query_id: callbackQuery.id,
              text: 'Failed to confirm payout. Please try again.',
              show_alert: true
            })
          });
          
          clearUserPayoutState(chatId);
        }
      }
      
      // Handle payout cancellation
      if (data === 'cancel_payout') {
        clearUserPayoutState(chatId);
        
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            callback_query_id: callbackQuery.id,
            text: 'Payout request cancelled'
          })
        });
        
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: callbackQuery.message.message_id,
            text: '❌ Payout request cancelled. You can request a new withdrawal anytime by using /payout or the 💰 Request Payout button.'
          })
        });
        
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

    // Handle payment system selection
    for (const system of PAYMENT_SYSTEMS) {
      if (text === `${system.emoji} ${system.name}`) {
        console.log(`💳 Processing payment system selection: ${system.name}`);
        
        const userBalance = parseFloat(dbUser.withdrawBalance || '0');
        
        if (userBalance < system.minWithdrawal) {
          const minMessage = `❌ Minimum withdrawal for ${system.name} is $${system.minWithdrawal.toFixed(2)}.\n\nYour balance: $${userBalance.toFixed(2)}`;
          const keyboard = createBotKeyboard();
          await sendUserTelegramNotification(chatId, minMessage, keyboard);
          return true;
        }
        
        // Set payout state
        setUserPayoutState(chatId, {
          step: 'awaiting_details',
          paymentSystem: system,
          amount: userBalance.toFixed(2)
        });
        
        const detailsMessage = `📋 Enter your ${system.name} details:\n\nAmount: $${userBalance.toFixed(2)}`;
        const keyboard = {
          keyboard: [['🔙 Back to Menu']],
          resize_keyboard: true,
          one_time_keyboard: false
        };
        await sendUserTelegramNotification(chatId, detailsMessage, keyboard);
        return true;
      }
    }

    
    
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
            
            // Set state for channel verification
            setUserClaimState(chatId, {
              promotionId: promotionId,
              promotionType: 'channel',
              sponsorUrl: promotion.url,
              rewardAmount: promotion.rewardPerUser || '0.00025',
              step: 'awaiting_verification'
            });
          } else if (promotion.type === 'bot') {
            taskMessage = `🤖 Bot Task
⚡ Complete Your Task via Bot & Earn!
💥 Easy, instant rewards – just a few taps!`;
            inlineButton.text = 'Start bot';
            
            // Set state for bot verification
            setUserClaimState(chatId, {
              promotionId: promotionId,
              promotionType: 'bot',
              sponsorUrl: promotion.url,
              rewardAmount: promotion.rewardPerUser || '0.00025',
              step: 'awaiting_forwarded_message'
            });
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
        const joinDate = dbUser.createdAt ? new Date(dbUser.createdAt).toLocaleDateString('en-GB', {
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
    
    if (text === '🏦 Cashout') {
      console.log('⌨️ Processing Cashout button press');
      
      // Get current user balance
      const currentBalance = parseFloat(dbUser.balance || '0');
      const userBalance = parseFloat(dbUser.withdrawBalance || '0');
      
      if (userBalance <= 0) {
        const noBalanceMessage = `💰 Your current balance is $${userBalance.toFixed(2)}.\n\n🚀 Complete tasks or refer friends to earn money!`;
        const keyboard = createBotKeyboard();
        await sendUserTelegramNotification(chatId, noBalanceMessage, keyboard);
        return true;
      }
      
      const paymentKeyboard = {
        keyboard: [
          ['💳 USDT'],
          ['💎 TON'],
          ['⬅️ Back']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      };
      
      const payoutMessage = `Select Payment System:\n\nYour balance: $${userBalance.toFixed(2)}`;
      await sendUserTelegramNotification(chatId, payoutMessage, paymentKeyboard);
      
      return true;
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
🔸 **Cashout** - Withdraw your earnings
🔸 **Affiliates** - Get your referral link to invite friends
🔸 **Promotion** - Create ad campaigns to promote your channels/bots
🔸 **Add funds** - Add balance to create promotions

💰 **How to Earn:**
• Complete tasks in the app
• Refer friends with your link
• Create promotions for others to complete

🚀 Start by visiting the web app and completing available tasks!`;
      
      const keyboard = createBotKeyboard();
      await sendUserTelegramNotification(chatId, howToMessage, keyboard);
      return true;
    }
    
    if (text === '💵 Add funds') {
      console.log('⌨️ Processing Add funds button press');
      
      // Get user's current main balance
      const userBalance = await storage.getUserBalance(dbUser.id);
      const mainBalance = parseFloat(userBalance?.mainBalance || '0');
      
      const addFundsMessage = `💵 Add Funds

To add funds to your main balance for creating promotions, please contact our support team.

📧 Support: @CashWatchSupport
💰 Minimum deposit: $1.00
⚡ Funds are added within 24 hours

Your current main balance: $${mainBalance.toFixed(2)}`;
      
      const keyboard = createBotKeyboard();
      await sendUserTelegramNotification(chatId, addFundsMessage, keyboard);
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
      
      const channelMessage = `📈 Promotion
→ 📝 Creation of an ad campaign
Type: Telegram: subscribe to the channel / join the chat
Add @lightningsatsbot → Instant Verify ⚡
💰 Ad Cost: $0.01
📝 Enter the URL:`;
      
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
            '⬅️ Back',
            '❌ Cancel'
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
      
      const botMessage = `📈 Promotion
→ 📝 Creation of an ad campaign
Type: Telegram: launch the bot
💰 Ad Cost: $0.01
📝 Enter the URL:`;
      
      // Set user state to awaiting bot URL
      setUserPromotionState(chatId, {
        step: 'awaiting_bot_url',
        type: 'bot',
        adCost: '0.01',
        rewardAmount: '0.00025',
        totalSlots: 1000
      });
      
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
      const claimState = getUserClaimState(chatId);
      
      if (promotionState) {
        clearUserPromotionState(chatId);
        
        const keyboard = createBotKeyboard();
        const cancelMessage = '❌ Promotion creation cancelled.';
        await sendUserTelegramNotification(chatId, cancelMessage, keyboard);
        return true;
      }
      
      if (claimState) {
        clearUserClaimState(chatId);
        
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
      
      // Default back to main menu if not in any state
      const keyboard = createBotKeyboard();
      const backMessage = 'Back to main menu.';
      await sendUserTelegramNotification(chatId, backMessage, keyboard);
      return true;
    }

    // Handle Done button for claim verification
    if (text === '✅ Done') {
      console.log('⌨️ Processing Done button for claim verification');
      
      const claimState = getUserClaimState(chatId);
      if (claimState) {
        try {
          let verificationResult = false;
          
          if (claimState.promotionType === 'channel') {
            // Verify channel membership
            verificationResult = await verifyChannelMembership(chatId, claimState.sponsorUrl);
          } else if (claimState.promotionType === 'bot') {
            // For bot verification, ask for forwarded message
            const botMessage = `🤖 Bot Verification Required

Please forward a message from the bot "${claimState.sponsorUrl}" to verify you started it.

Forward any message from that bot and I'll verify it automatically.`;
            
            setUserClaimState(chatId, {
              ...claimState,
              step: 'awaiting_forwarded_message'
            });
            
            const keyboard = {
              keyboard: [
                ['❌ Cancel']
              ],
              resize_keyboard: true,
              one_time_keyboard: true
            };
            
            await sendUserTelegramNotification(chatId, botMessage, keyboard);
            return true;
          }
          
          if (verificationResult) {
            // Verification successful, reward user
            await processClaimReward(chatId, claimState, dbUser);
          } else {
            const failedMessage = claimState.promotionType === 'channel' 
              ? '❌ Channel membership verification failed. Please join the channel first.'
              : '❌ Bot verification failed. Please start the bot first.';
            
            const keyboard = {
              keyboard: [
                [
                  '✅ Done',
                  '❌ Cancel'
                ]
              ],
              resize_keyboard: true,
              one_time_keyboard: true
            };
            
            await sendUserTelegramNotification(chatId, failedMessage, keyboard);
          }
          
        } catch (error) {
          console.error('❌ Error processing claim verification:', error);
          clearUserClaimState(chatId);
          
          const errorMessage = '❌ Verification error. Please try again.';
          const keyboard = createBotKeyboard();
          await sendUserTelegramNotification(chatId, errorMessage, keyboard);
        }
        
        return true;
      }
    }

    // Handle forwarded message verification for bot tasks
    const claimState = getUserClaimState(chatId);
    if (claimState && claimState.step === 'awaiting_forwarded_message') {
      if (message.forward_from && message.forward_from.is_bot) {
        const forwardedBotUsername = message.forward_from.username;
        
        // Extract bot username from sponsor URL
        const sponsorBotUsername = extractBotUsernameFromUrl(claimState.sponsorUrl);
        
        if (forwardedBotUsername && sponsorBotUsername && forwardedBotUsername.toLowerCase() === sponsorBotUsername.toLowerCase()) {
          // Bot verification successful
          await processClaimReward(chatId, claimState, dbUser);
          return true;
        } else {
          const errorMessage = `❌ The forwarded message is not from the expected bot "${sponsorBotUsername}". Please forward a message from the correct bot.`;
          
          const keyboard = {
            keyboard: [
              [{ text: '❌ Cancel' }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
          };
          
          await sendUserTelegramNotification(chatId, errorMessage, keyboard);
          return true;
        }
      } else {
        const instructionMessage = `❌ Please forward a message from the bot, not a regular message.

To forward a message:
1. Go to the bot "${claimState.sponsorUrl}"
2. Send any message to the bot (like /start)
3. Tap and hold the bot's response
4. Select "Forward"
5. Forward it to me`;
        
        const keyboard = {
          keyboard: [
            [{ text: '❌ Cancel' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        };
        
        await sendUserTelegramNotification(chatId, instructionMessage, keyboard);
        return true;
      }
    }

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
                '⬅️ Back',
                { text: '❌ Cancel' }
              ]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
          };
          await sendUserTelegramNotification(chatId, errorMessage, keyboard);
          return true;
        }
      } else if (promotionState.step === 'awaiting_bot_url') {
        // Validate bot link
        if (!url.includes('bot')) {
          const errorMessage = '❌ Please enter a valid bot link (should contain "bot")';
          const keyboard = {
            keyboard: [
              [
                '⬅️ Back',
                { text: '❌ Cancel' }
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
      const currentMainBalance = parseFloat(userBalance?.mainBalance || '0');
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
          totalSlots: promotionState.totalSlots,
          isActive: true
        });
        
        // Deduct the ad cost from user's balance
        await storage.deductMainBalance(dbUser.id, promotionState.adCost);
        
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

    // Handle payment detail collection
    const payoutState = getUserPayoutState(chatId);
    if (payoutState && payoutState.step === 'awaiting_details') {
      console.log('💳 Processing payment details from user:', chatId);
      
      const paymentDetails = text.trim();
      
      // Validate payment details based on system
      let isValid = false;
      let errorMessage = '';
      
      switch (payoutState.paymentSystem.id) {
        case 'telegram_stars':
          // Validate Telegram username (should not start with @)
          if (paymentDetails && !paymentDetails.startsWith('@') && paymentDetails.length > 0) {
            isValid = true;
          } else {
            errorMessage = '❌ Please enter a valid Telegram username without the @ symbol.';
          }
          break;
        case 'tether_polygon':
          // Basic wallet address validation (starts with 0x and is 42 characters)
          if (paymentDetails.startsWith('0x') && paymentDetails.length === 42) {
            isValid = true;
          } else {
            errorMessage = '❌ Please enter a valid Polygon wallet address (starts with 0x and is 42 characters long).';
          }
          break;
        case 'ton_coin':
          // Basic TON address validation (starts with EQ or UQ and has proper length)
          if ((paymentDetails.startsWith('EQ') || paymentDetails.startsWith('UQ')) && paymentDetails.length === 48) {
            isValid = true;
          } else {
            errorMessage = '❌ Please enter a valid TON wallet address (starts with EQ or UQ and is 48 characters long).';
          }
          break;
        case 'litecoin':
          // Basic Litecoin address validation (starts with L or M and proper length)
          if ((paymentDetails.startsWith('L') || paymentDetails.startsWith('M')) && paymentDetails.length >= 26 && paymentDetails.length <= 35) {
            isValid = true;
          } else {
            errorMessage = '❌ Please enter a valid Litecoin address (starts with L or M and is 26-35 characters long).';
          }
          break;
        default:
          isValid = paymentDetails.length > 0;
      }
      
      if (!isValid) {
        const keyboard = createBotKeyboard();
        await sendUserTelegramNotification(chatId, errorMessage, keyboard);
        return true;
      }
      
      // Update state with payment details
      setUserPayoutState(chatId, {
        ...payoutState,
        step: 'awaiting_confirmation',
        paymentDetails: paymentDetails
      });
      
      // Show confirmation message with keyboard buttons
      const confirmationMessage = `✅ Please Confirm Your Withdrawal\n\n${payoutState.paymentSystem.emoji} Payment System: ${payoutState.paymentSystem.name}\n💰 Amount: $${parseFloat(payoutState.amount).toFixed(2)}\n📋 Payment Details: ${paymentDetails}\n\n⚠️ Please verify all details are correct before confirming.\n\nType "CONFIRM" to proceed or "CANCEL" to cancel.`;
      
      // Update state with payment details
      setUserPayoutState(chatId, {
        ...payoutState,
        step: 'awaiting_confirmation',
        paymentDetails: paymentDetails
      });
      
      const confirmationKeyboard = {
        keyboard: [
          [
            '✅ CONFIRM',
            '❌ CANCEL'
          ],
          [
            '🔙 Back to Menu'
          ]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      };
      
      await sendUserTelegramNotification(chatId, confirmationMessage, confirmationKeyboard);
      return true;
    }

    // Handle confirmation buttons
    if (text === '✅ CONFIRM') {
      const payoutState = getUserPayoutState(chatId);
      if (payoutState && payoutState.step === 'awaiting_confirmation' && payoutState.paymentDetails) {
        console.log('✅ Processing payout confirmation');
        
        try {
          const payoutResult = await storage.createPayoutRequest(
            dbUser.id, 
            payoutState.amount, 
            payoutState.paymentSystem.id,
            payoutState.paymentDetails
          );
          
          if (payoutResult.success) {
            const successMessage = `✅ Payout Request Confirmed\n\nYour ${payoutState.paymentSystem.name} withdrawal request has been submitted successfully and is pending admin approval.\n\n📧 You'll receive a notification once processed.`;
            
            clearUserPayoutState(chatId);
            
            const keyboard = createBotKeyboard();
            await sendUserTelegramNotification(chatId, successMessage, keyboard);
            
            // Send admin notification with inline buttons
            const userName = dbUser.firstName || dbUser.username || 'User';
            const adminMessage = `💵 Withdraw request from user ${userName} (ID: ${dbUser.telegram_id})\nAmount: $${parseFloat(payoutState.amount).toFixed(2)}\nPayment System: ${payoutState.paymentSystem.name}\nPayment Details: ${payoutState.paymentDetails}\nTime: ${new Date().toLocaleString()}`;
            
            const adminKeyboard = {
              inline_keyboard: [
                [
                  { text: "✅ Paid", callback_data: `withdraw_paid_${payoutResult.withdrawalId}` },
                  { text: "❌ Reject", callback_data: `withdraw_reject_${payoutResult.withdrawalId}` }
                ]
              ]
            };
            
            if (TELEGRAM_ADMIN_ID) {
              await sendUserTelegramNotification(TELEGRAM_ADMIN_ID, adminMessage, adminKeyboard);
            }
          } else {
            const errorMessage = `❌ ${payoutResult.message}`;
            const keyboard = createBotKeyboard();
            await sendUserTelegramNotification(chatId, errorMessage, keyboard);
            clearUserPayoutState(chatId);
          }
        } catch (error) {
          console.error('❌ Error processing payout:', error);
          const errorMessage = '❌ Error processing your payout. Please try again later.';
          const keyboard = createBotKeyboard();
          await sendUserTelegramNotification(chatId, errorMessage, keyboard);
          clearUserPayoutState(chatId);
        }
        return true;
      }
    }
    
    if (text === '❌ CANCEL') {
      console.log('❌ Processing payout cancellation');
      clearUserPayoutState(chatId);
      clearUserPromotionState(chatId);
      
      const cancelMessage = '❌ Operation cancelled.';
      const keyboard = createBotKeyboard();
      await sendUserTelegramNotification(chatId, cancelMessage, keyboard);
      return true;
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
          requestsList += `⏰ Requested: ${new Date(withdrawal.createdAt).toLocaleString()}\n`;
          requestsList += `📝 ID: ${withdrawal.id}\n\n`;
        }
        
        // Send admin notification with inline buttons for each withdrawal
        for (const withdrawal of pendingWithdrawals) {
          const user = await storage.getUser(withdrawal.userId);
          const userName = user ? (user.firstName || user.username || 'Unknown User') : 'Unknown User';
          const details = withdrawal.details as any;
          
          const adminMessage = `💵 Withdraw request from user ${userName} (ID: ${user?.telegram_id || 'N/A'})\nAmount: $${parseFloat(withdrawal.amount).toFixed(2)}\nPayment System: ${withdrawal.method}\nPayment Details: ${details?.paymentDetails || 'N/A'}\nTime: ${new Date(withdrawal.createdAt).toLocaleString()}`;
          
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
      clearUserPayoutState(chatId);
      clearUserPromotionState(chatId);
      clearUserClaimState(chatId);
      
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

    // Handle USDT payment method
    if (text === '💳 USDT') {
      console.log('⌨️ Processing USDT payment method');
      
      const usdtMessage = `💳 USDT Withdrawal

Please enter your USDT wallet address (TRC20/Polygon):`;
      
      const usdtKeyboard = {
        keyboard: [
          ['❌ Cancel'],
          ['⬅️ Back']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      };
      
      // Set user state for USDT withdrawal
      setUserPayoutState(chatId, {
        step: 'awaiting_details',
        paymentSystem: { id: 'usdt', name: 'USDT', emoji: '💳', minWithdrawal: 0.01 },
        amount: dbUser.balance || '0'
      });
      
      await sendUserTelegramNotification(chatId, usdtMessage, usdtKeyboard);
      return true;
    }

    // Handle TON payment method
    if (text === '💎 TON') {
      console.log('⌨️ Processing TON payment method');
      
      const tonMessage = `💎 TON Withdrawal

Please enter your TON wallet address:`;
      
      const tonKeyboard = {
        keyboard: [
          ['❌ Cancel'],
          ['⬅️ Back']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      };
      
      // Set user state for TON withdrawal
      setUserPayoutState(chatId, {
        step: 'awaiting_details',
        paymentSystem: { id: 'ton', name: 'TON', emoji: '💎', minWithdrawal: 0.35 },
        amount: dbUser.balance || '0'
      });
      
      await sendUserTelegramNotification(chatId, tonMessage, tonKeyboard);
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
        '🏦 Cashout'
      ],
      [
        '👥 Affiliates',
        '📈 Promotion'
      ],
      [
        '⁉️ How-to',
        '💵 Add funds'
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