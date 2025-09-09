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
  
  // Combine inline keyboard and reply keyboard
  const replyMarkup = {
    ...inlineKeyboard,
    reply_markup: keyboard
  };
  
  return await sendUserTelegramNotification(userId, message, replyMarkup);
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

    // Handle /affiliates command
    if (text === '/affiliates') {
      console.log('🔗 Processing /affiliates command...');
      
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
      
      const messageSent = await sendUserTelegramNotification(chatId, affiliatesMessage);
      console.log('📧 Affiliates message sent successfully:', messageSent);
      
      return true;
    }
    
    
    // Handle /payout command
    if (text === '/payout') {
      console.log('💰 Processing /payout command...');
      
      // Check overall minimum balance (lowest across all payment systems)
      const userBalance = parseFloat(dbUser.balance || '0');
      const { PAYMENT_SYSTEMS } = await import('./storage');
      const minOverallBalance = Math.min(...PAYMENT_SYSTEMS.map(p => p.minWithdrawal));
      
      if (userBalance < minOverallBalance) {
        const insufficientMessage = `❌ There are not enough funds on your balance. The minimum amount to withdraw is $${minOverallBalance.toFixed(2)}`;
        await sendUserTelegramNotification(chatId, insufficientMessage);
        return true;
      }
      
      // Show payment system selection keyboard
      const paymentKeyboard = {
        inline_keyboard: PAYMENT_SYSTEMS.map(system => [
          { 
            text: `${system.emoji} ${system.name}`, 
            callback_data: `payout_${system.id}` 
          }
        ])
      };
      
      const payoutMessage = `Select Payment System:\n\nYour balance: $${userBalance.toFixed(2)}`;
      await sendUserTelegramNotification(chatId, payoutMessage, paymentKeyboard);
      
      return true;
    }
    
    // Handle /stats command (admin only)
    if (text === '/stats' && isAdmin(chatId)) {
      console.log('📊 Processing admin /stats command...');
      
      try {
        const stats = await storage.getAppStats();
        
        const statsMessage = `📊 Application Stats\n\n👥 Total Registered Users: ${stats.totalUsers.toLocaleString()}\n👤 Active Users Today: ${stats.activeUsersToday}\n🔗 Total Friends Invited: ${stats.totalInvites.toLocaleString()}\n\n💰 Total Earnings (All Users): $${parseFloat(stats.totalEarnings).toFixed(2)}\n💎 Total Referral Earnings: $${parseFloat(stats.totalReferralEarnings).toFixed(2)}\n🏦 Total Payouts: $${parseFloat(stats.totalPayouts).toFixed(2)}\n\n🚀 Growth (Last 24h): +${stats.newUsersLast24h} new users`;
        
        const refreshButton = {
          inline_keyboard: [[
            { text: "🔃 Refresh 🔄", callback_data: "refresh_stats" }
          ]]
        };
        
        await sendUserTelegramNotification(chatId, statsMessage, refreshButton);
      } catch (error) {
        console.error('❌ Error fetching stats:', error);
        const errorMessage = '❌ Failed to fetch application stats. Please try again.';
        await sendUserTelegramNotification(chatId, errorMessage);
      }
      
      return true;
    }
    
    // Handle /profile command
    if (text === '/profile') {
      console.log('📊 Processing /profile command...');
      
      try {
        // Get user stats from database
        // const userStats = await storage.getUserStats(dbUser.id);
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
        
        const messageSent = await sendUserTelegramNotification(chatId, profileMessage);
        console.log('📧 Profile message sent successfully:', messageSent);
        
        return true;
      } catch (error) {
        console.error('❌ Error fetching profile data:', error);
        const errorMessage = '❌ Sorry, there was an error fetching your profile data. Please try again later.';
        await sendUserTelegramNotification(chatId, errorMessage);
        return true;
      }
    }
    
    // Handle admin broadcast command
    if (text.startsWith('/broadcast ') && isAdmin(chatId)) {
      console.log('📢 Processing admin broadcast command...');
      
      const broadcastMessage = text.substring(11); // Remove '/broadcast ' prefix
      
      if (!broadcastMessage.trim()) {
        const errorMessage = '❌ Please provide a message to broadcast.\nExample: /broadcast Hello everyone!';
        await sendUserTelegramNotification(chatId, errorMessage);
        return true;
      }
      
      const confirmMessage = `📢 Are you sure you want to send this broadcast message to all users?\n\n"${broadcastMessage}"\n\nReply with "CONFIRM BROADCAST" to proceed.`;
      await sendUserTelegramNotification(chatId, confirmMessage);
      
      return true;
    }
    
    // Handle broadcast confirmation
    if (text === 'CONFIRM BROADCAST' && isAdmin(chatId)) {
      console.log('📢 Processing broadcast confirmation...');
      
      const processingMessage = '📢 Broadcasting message to all users... This may take a few minutes.';
      await sendUserTelegramNotification(chatId, processingMessage);
      
      // Note: In a real implementation, you'd want to store the pending broadcast message
      // For now, we'll send a sample message or require the admin to use the full command again
      const sampleMessage = '📢 Important announcement from Lightning Sats Bot!\n\n👋 Thank you for using our service. Keep earning!';
      await sendBroadcastMessage(sampleMessage, chatId);
      
      return true;
    }
    
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
      console.log('⌨️ Processing Account button press -> /profile');
      // Redirect to /profile command handling  
      return await handleTelegramMessage({ message: { ...update.message, text: '/profile' } });
    }
    
    if (text === '👥 Invite Friends') {
      console.log('⌨️ Processing Invite Friends button press -> /affiliates');
      // Redirect to /affiliates command handling
      return await handleTelegramMessage({ message: { ...update.message, text: '/affiliates' } });
    }
    
    if (text === '💰 Request Payout') {
      console.log('⌨️ Processing Request Payout button press -> /payout');
      // Redirect to /payout command handling
      return await handleTelegramMessage({ message: { ...update.message, text: '/payout' } });
    }
    
    if (text === '🏠 Start Earning') {
      console.log('⌨️ Processing Start Earning button press');
      // Send welcome message with web app link
      const keyboard = createBotKeyboard();
      const { message } = formatWelcomeMessage();
      const messageSent = await sendUserTelegramNotification(chatId, message, { reply_markup: keyboard });
      console.log('📧 Start Earning message sent successfully:', messageSent);
      return true;
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
        await sendUserTelegramNotification(chatId, errorMessage);
        return true;
      }
      
      // Update state with payment details
      setUserPayoutState(chatId, {
        ...payoutState,
        step: 'awaiting_confirmation',
        paymentDetails: paymentDetails
      });
      
      // Show confirmation message
      const confirmationMessage = `✅ Please Confirm Your Withdrawal\n\n${payoutState.paymentSystem.emoji} Payment System: ${payoutState.paymentSystem.name}\n💰 Amount: $${parseFloat(payoutState.amount).toFixed(2)}\n📋 Payment Details: ${paymentDetails}\n\n⚠️ Please verify all details are correct before confirming.`;
      
      const confirmationKeyboard = {
        inline_keyboard: [
          [
            { 
              text: '✅ Confirm Withdrawal', 
              callback_data: `confirm_payout_${JSON.stringify({
                paymentSystemId: payoutState.paymentSystem.id,
                paymentSystemName: payoutState.paymentSystem.name,
                amount: payoutState.amount,
                paymentDetails: paymentDetails
              })}` 
            }
          ],
          [
            { 
              text: '❌ Cancel', 
              callback_data: 'cancel_payout' 
            }
          ]
        ]
      };
      
      await sendUserTelegramNotification(chatId, confirmationMessage, confirmationKeyboard);
      return true;
    }

    // For any other message, respond with "Please use /start" and show keyboard
    console.log('❓ Unknown command or message, sending /start instruction to:', chatId);
    
    const instructionMessage = 'Please use /start to begin earning or use the buttons below:';
    const keyboard = createBotKeyboard();
    const messageSent = await sendUserTelegramNotification(chatId, instructionMessage, { reply_markup: keyboard });
    console.log('📧 Instruction message sent successfully:', messageSent);
    
    return true;
  } catch (error) {
    console.error('Error handling Telegram message:', error);
    return false;
  }
}

// Set up bot commands menu
export async function setupBotCommands(): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('Telegram bot token not configured');
    return false;
  }

  try {
    const commands = [
      { command: 'start', description: 'Start using CashWatch Bot' },
      { command: 'profile', description: 'View your account profile and earnings' },
      { command: 'affiliates', description: 'Get your referral link to invite friends' },
      { command: 'payout', description: 'Request withdrawal of your earnings' }
    ];

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commands: commands
      }),
    });

    if (response.ok) {
      console.log('Bot commands menu set successfully');
      return true;
    } else {
      const errorData = await response.text();
      console.error('Failed to set bot commands menu:', errorData);
      return false;
    }
  } catch (error) {
    console.error('Error setting up bot commands menu:', error);
    return false;
  }
}

// Create reply keyboard with command buttons
export function createBotKeyboard() {
  return {
    keyboard: [
      [
        { text: '👤 Account' },
        { text: '👥 Invite Friends' }
      ],
      [
        { text: '💰 Request Payout' },
        { text: '🏠 Start Earning' }
      ]
    ],
    resize_keyboard: true,
    persistent: true
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
      // Also set up bot commands
      await setupBotCommands();
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