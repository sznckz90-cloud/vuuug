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
  return await sendUserTelegramNotification(userId, message, inlineKeyboard);
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
    
    // Handle /wallet command
    if (text.startsWith('/wallet')) {
      console.log('💳 Processing /wallet command...');
      
      const args = text.split(' ');
      
      if (args.length === 1) {
        // Show current wallet or prompt to set one
        if (dbUser.walletAddress) {
          const walletMessage = `💳 Your current wallet address:\n\n${dbUser.walletAddress}\n\nTo change your wallet, send: /wallet [new_address]`;
          await sendUserTelegramNotification(chatId, walletMessage);
        } else {
          const promptMessage = '💳 You haven\'t set a wallet address yet.\n\nTo set your wallet, send: /wallet [your_wallet_address]';
          await sendUserTelegramNotification(chatId, promptMessage);
        }
        return true;
      }
      
      // Set new wallet address
      const walletAddress = args.slice(1).join(' ').trim();
      
      if (!walletAddress) {
        const errorMessage = '❌ Please provide a valid wallet address.\n\nExample: /wallet 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
        await sendUserTelegramNotification(chatId, errorMessage);
        return true;
      }
      
      try {
        await storage.setUserWallet(dbUser.id, walletAddress);
        const successMessage = '✅ Your wallet has been set successfully. You can now request a payout.';
        await sendUserTelegramNotification(chatId, successMessage);
      } catch (error) {
        console.error('❌ Error setting wallet:', error);
        const errorMessage = '❌ Failed to set wallet address. Please try again.';
        await sendUserTelegramNotification(chatId, errorMessage);
      }
      
      return true;
    }
    
    // Handle /payout command
    if (text === '/payout') {
      console.log('💰 Processing /payout command...');
      
      // Check minimum balance
      const userBalance = parseFloat(dbUser.balance || '0');
      
      if (userBalance < 0.5) {
        const insufficientMessage = '❌ There are not enough funds on your balance. The minimum amount to withdraw is $0.5';
        await sendUserTelegramNotification(chatId, insufficientMessage);
        return true;
      }
      
      // Check if wallet is set
      if (!dbUser.walletAddress) {
        const noWalletMessage = '❌ Please set your wallet first using /wallet';
        await sendUserTelegramNotification(chatId, noWalletMessage);
        return true;
      }
      
      try {
        // Create payout request
        const payoutResult = await storage.createPayoutRequest(dbUser.id, userBalance.toString());
        
        if (payoutResult.success) {
          // Send success message to user
          const successMessage = '✅ The payout request has been successfully created and will be processed within an hour';
          await sendUserTelegramNotification(chatId, successMessage);
          
          // Send notification to admin
          const userName = dbUser.firstName || dbUser.username || 'User';
          const adminMessage = `💰 New Payout Request\n\n👤 User: ${userName}\n🆔 Telegram ID: ${dbUser.telegram_id}\n💰 Amount: $${userBalance.toFixed(2)}\n💳 Wallet: ${dbUser.walletAddress}\n⏰ Time: ${new Date().toLocaleString()}`;
          
          if (TELEGRAM_ADMIN_ID) {
            await sendUserTelegramNotification(TELEGRAM_ADMIN_ID, adminMessage);
          }
        } else {
          await sendUserTelegramNotification(chatId, payoutResult.message);
        }
      } catch (error) {
        console.error('❌ Error processing payout:', error);
        const errorMessage = '❌ Failed to process payout request. Please try again.';
        await sendUserTelegramNotification(chatId, errorMessage);
      }
      
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

    // For any other message, respond with "Please use /start"
    console.log('❓ Unknown command or message, sending /start instruction to:', chatId);
    
    const instructionMessage = 'Please use /start';
    const messageSent = await sendUserTelegramNotification(chatId, instructionMessage);
    console.log('📧 Instruction message sent successfully:', messageSent);
    
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