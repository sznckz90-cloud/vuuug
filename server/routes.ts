import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEarningSchema, insertWithdrawalSchema, withdrawals } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { sendTelegramMessage, formatWithdrawalNotification, sendUserTelegramNotification, formatUserNotification, sendWelcomeMessage, handleTelegramMessage, setupTelegramWebhook } from "./telegram";

// Check if user is admin
const isAdmin = (telegramId: string): boolean => {
  const adminId = process.env.TELEGRAM_ADMIN_ID;
  return adminId === telegramId;
};

// Admin authentication middleware
const authenticateAdmin = async (req: any, res: any, next: any) => {
  try {
    const telegramData = req.headers['x-telegram-data'] || req.query.tgData;
    
    if (!telegramData) {
      return res.status(401).json({ message: "Admin access denied" });
    }

    const urlParams = new URLSearchParams(telegramData);
    const userString = urlParams.get('user');
    
    if (!userString) {
      return res.status(401).json({ message: "Invalid Telegram data" });
    }

    const telegramUser = JSON.parse(userString);
    
    if (!isAdmin(telegramUser.id.toString())) {
      return res.status(403).json({ message: "Admin access required" });
    }

    req.user = { telegramUser };
    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(401).json({ message: "Authentication failed" });
  }
};

// Telegram Web App authentication middleware
const authenticateTelegram = async (req: any, res: any, next: any) => {
  try {
    // Get Telegram Web App data from headers or query params
    const telegramData = req.headers['x-telegram-data'] || req.query.tgData;
    
    if (!telegramData) {
      // For development, create a mock user
      const mockUser = {
        id: '12345',
        first_name: 'Demo',
        last_name: 'User',
        username: 'demo_user'
      };
      
      // Ensure user exists in database
      const { user: upsertedUser, isNewUser } = await storage.upsertUser({
        id: mockUser.id,
        email: `${mockUser.username}@telegram.user`,
        firstName: mockUser.first_name,
        lastName: mockUser.last_name,
        profileImageUrl: null,
      });
      
      // Send welcome message to new users
      if (isNewUser) {
        await sendWelcomeMessage(mockUser.id.toString());
      }
      
      req.user = { telegramUser: mockUser };
      return next();
    }

    // Parse Telegram Web App data
    const urlParams = new URLSearchParams(telegramData);
    const userString = urlParams.get('user');
    
    if (!userString) {
      return res.status(401).json({ message: "Invalid Telegram data" });
    }

    const telegramUser = JSON.parse(userString);
    
    // Ensure user exists in database
    const { user: upsertedUser, isNewUser } = await storage.upsertUser({
      id: telegramUser.id.toString(),
      email: telegramUser.username ? `${telegramUser.username}@telegram.user` : null,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      profileImageUrl: telegramUser.photo_url || null,
    });
    
    // Send welcome message to new users
    if (isNewUser) {
      await sendWelcomeMessage(telegramUser.id.toString());
    }

    req.user = { telegramUser };
    next();
  } catch (error) {
    console.error("Telegram auth error:", error);
    res.status(401).json({ message: "Authentication failed" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  console.log('🔧 Registering API routes...');
  
  // Simple test route to verify routing works
  app.get('/api/test', (req: any, res) => {
    console.log('✅ Test route called!');
    res.json({ status: 'API routes working!', timestamp: new Date().toISOString() });
  });
  
  // Telegram Bot Webhook endpoint - MUST be first to avoid Vite catch-all interference
  app.post('/api/telegram/webhook', async (req: any, res) => {
    try {
      const update = req.body;
      console.log('📨 Received Telegram update:', JSON.stringify(update, null, 2));
      
      // Verify the request is from Telegram (optional but recommended)
      // You can add signature verification here if needed
      
      const handled = await handleTelegramMessage(update);
      console.log('✅ Message handled:', handled);
      
      if (handled) {
        res.status(200).json({ ok: true });
      } else {
        res.status(200).json({ ok: true, message: 'No action taken' });
      }
    } catch (error) {
      console.error('❌ Telegram webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Auth routes
  app.get('/api/auth/user', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Ad watching endpoint
  app.post('/api/ads/watch', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const { adType } = req.body;
      
      // Add earning for watched ad
      const earning = await storage.addEarning({
        userId,
        amount: "0.00021",
        type: 'ad_watch',
        description: 'Watched advertisement',
        metadata: { adType: adType || 'rewarded' },
      });
      
      // Increment ads watched count
      await storage.incrementAdsWatched(userId);
      
      res.json({ 
        success: true, 
        earning,
        message: 'Ad reward added successfully' 
      });
    } catch (error) {
      console.error("Error processing ad watch:", error);
      res.status(500).json({ message: "Failed to process ad reward" });
    }
  });

  // Streak claim endpoint
  app.post('/api/streak/claim', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      
      const result = await storage.updateUserStreak(userId);
      
      res.json({ 
        success: true,
        newStreak: result.newStreak,
        rewardEarned: result.rewardEarned,
        message: 'Streak updated successfully' 
      });
    } catch (error) {
      console.error("Error processing streak:", error);
      res.status(500).json({ message: "Failed to process streak" });
    }
  });

  // User stats endpoint
  app.get('/api/user/stats', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  // Earnings history endpoint
  app.get('/api/earnings', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const limit = parseInt(req.query.limit as string) || 20;
      const earnings = await storage.getUserEarnings(userId, limit);
      res.json(earnings);
    } catch (error) {
      console.error("Error fetching earnings:", error);
      res.status(500).json({ message: "Failed to fetch earnings" });
    }
  });

  // Withdrawal request endpoint
  app.post('/api/withdrawals', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const withdrawalData = insertWithdrawalSchema.parse({
        ...req.body,
        userId,
      });
      
      // Check if user has sufficient balance
      const user = await storage.getUser(userId);
      if (!user || parseFloat(user.balance || "0") < parseFloat(withdrawalData.amount)) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      
      const withdrawal = await storage.createWithdrawal(withdrawalData);
      
      // Send Telegram notification to admin
      const userName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.lastName || `User ${userId}`;
      
      const notificationMessage = formatWithdrawalNotification(
        userId,
        withdrawalData.amount,
        withdrawalData.method,
        withdrawalData.details,
        userName
      );
      
      // Send notification (don't wait for it to complete)
      if (notificationMessage) {
        sendTelegramMessage(notificationMessage).catch(error => {
          console.error('Failed to send withdrawal notification:', error);
        });
      }
      
      res.json({ 
        success: true, 
        withdrawal,
        message: 'Withdrawal request created successfully' 
      });
    } catch (error) {
      console.error("Error creating withdrawal:", error);
      res.status(500).json({ message: "Failed to create withdrawal request" });
    }
  });

  // Get user withdrawals
  app.get('/api/withdrawals', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const withdrawals = await storage.getUserWithdrawals(userId);
      res.json(withdrawals);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  // Referral endpoints
  app.get('/api/referrals', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const referrals = await storage.getUserReferrals(userId);
      res.json(referrals);
    } catch (error) {
      console.error("Error fetching referrals:", error);
      res.status(500).json({ message: "Failed to fetch referrals" });
    }
  });

  // Generate referral code
  app.post('/api/referrals/generate', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const code = await storage.generateReferralCode(userId);
      res.json({ code });
    } catch (error) {
      console.error("Error generating referral code:", error);
      res.status(500).json({ message: "Failed to generate referral code" });
    }
  });

  // Process referral signup
  app.post('/api/referrals/process', authenticateTelegram, async (req: any, res) => {
    try {
      const userId = req.user.telegramUser.id.toString();
      const { referralCode } = req.body;
      
      if (!referralCode) {
        return res.status(400).json({ message: "Referral code required" });
      }
      
      // Find referrer by code
      const referrer = await storage.getUser(referralCode);
      if (!referrer) {
        return res.status(404).json({ message: "Invalid referral code" });
      }
      
      // Create referral relationship
      const referral = await storage.createReferral(referrer.id, userId);
      
      res.json({ 
        success: true, 
        referral,
        message: 'Referral processed successfully' 
      });
    } catch (error) {
      console.error("Error processing referral:", error);
      res.status(500).json({ message: "Failed to process referral" });
    }
  });

  // Admin routes
  app.get('/api/admin/withdrawals', authenticateAdmin, async (req: any, res) => {
    try {
      const withdrawals = await storage.getAllPendingWithdrawals();
      
      // Get user details for each withdrawal
      const withdrawalsWithUsers = await Promise.all(
        withdrawals.map(async (withdrawal) => {
          const user = await storage.getUser(withdrawal.userId);
          return {
            ...withdrawal,
            user: user ? {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email
            } : null
          };
        })
      );
      
      res.json(withdrawalsWithUsers);
    } catch (error) {
      console.error("Error fetching admin withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  app.post('/api/admin/withdrawals/:id/update', authenticateAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status, transactionHash, adminNotes } = req.body;
      
      if (!['pending', 'processing', 'completed', 'failed'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Get withdrawal and user info before updating
      const withdrawal = await db.select().from(withdrawals).where(eq(withdrawals.id, id)).limit(1);
      if (!withdrawal[0]) {
        return res.status(404).json({ message: "Withdrawal not found" });
      }
      
      const user = await storage.getUser(withdrawal[0].userId);
      
      // Update withdrawal status
      const updatedWithdrawal = await storage.updateWithdrawalStatus(
        id, 
        status, 
        transactionHash, 
        adminNotes
      );
      
      // Send notification to user if status changed to completed or failed
      if ((status === 'completed' || status === 'failed') && user) {
        const userNotification = formatUserNotification(
          withdrawal[0].amount,
          withdrawal[0].method,
          status,
          transactionHash
        );
        
        sendUserTelegramNotification(withdrawal[0].userId, userNotification).catch(error => {
          console.error('Failed to send user notification:', error);
        });
      }
      
      res.json({ 
        success: true, 
        withdrawal: updatedWithdrawal,
        message: 'Withdrawal status updated successfully' 
      });
    } catch (error) {
      console.error("Error updating withdrawal:", error);
      res.status(500).json({ message: "Failed to update withdrawal" });
    }
  });

  // Simple admin interface
  app.get('/admin', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>CashWatch Admin</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .withdrawal { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
            .pending { border-left: 4px solid #ffa500; }
            .completed { border-left: 4px solid #4CAF50; }
            .failed { border-left: 4px solid #f44336; }
            .processing { border-left: 4px solid #2196F3; }
            button { padding: 5px 10px; margin: 2px; cursor: pointer; }
            input { margin: 5px; padding: 5px; }
            .actions { margin-top: 10px; }
        </style>
    </head>
    <body>
        <h1>CashWatch Admin - Withdrawal Management</h1>
        <div id="withdrawals"></div>
        
        <script>
            const API_BASE = '/api/admin';
            
            async function loadWithdrawals() {
                try {
                    const response = await fetch(API_BASE + '/withdrawals');
                    const withdrawals = await response.json();
                    
                    const container = document.getElementById('withdrawals');
                    container.innerHTML = withdrawals.map(w => \`
                        <div class="withdrawal \${w.status}">
                            <h3>Withdrawal #\${w.id.substring(0, 8)}</h3>
                            <p><strong>User:</strong> \${w.user?.firstName || ''} \${w.user?.lastName || ''} (ID: \${w.userId})</p>
                            <p><strong>Amount:</strong> $\${w.amount}</p>
                            <p><strong>Method:</strong> \${w.method === 'usdt_polygon' ? 'Tether (Polygon POS)' : 'Litecoin (LTC)'}</p>
                            <p><strong>Address:</strong> \${JSON.stringify(w.details)}</p>
                            <p><strong>Status:</strong> \${w.status}</p>
                            <p><strong>Created:</strong> \${new Date(w.createdAt).toLocaleString()}</p>
                            \${w.transactionHash ? \`<p><strong>TX Hash:</strong> \${w.transactionHash}</p>\` : ''}
                            \${w.adminNotes ? \`<p><strong>Notes:</strong> \${w.adminNotes}</p>\` : ''}
                            
                            <div class="actions">
                                <select id="status-\${w.id}">
                                    <option value="pending" \${w.status === 'pending' ? 'selected' : ''}>Pending</option>
                                    <option value="processing" \${w.status === 'processing' ? 'selected' : ''}>Processing</option>
                                    <option value="completed" \${w.status === 'completed' ? 'selected' : ''}>Completed</option>
                                    <option value="failed" \${w.status === 'failed' ? 'selected' : ''}>Failed</option>
                                </select>
                                <input type="text" id="txhash-\${w.id}" placeholder="Transaction Hash" value="\${w.transactionHash || ''}">
                                <input type="text" id="notes-\${w.id}" placeholder="Admin Notes" value="\${w.adminNotes || ''}">
                                <button onclick="updateWithdrawal('\${w.id}')">Update</button>
                            </div>
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Failed to load withdrawals:', error);
                }
            }
            
            async function updateWithdrawal(id) {
                const status = document.getElementById(\`status-\${id}\`).value;
                const transactionHash = document.getElementById(\`txhash-\${id}\`).value;
                const adminNotes = document.getElementById(\`notes-\${id}\`).value;
                
                try {
                    const response = await fetch(\`\${API_BASE}/withdrawals/\${id}/update\`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status, transactionHash, adminNotes })
                    });
                    
                    if (response.ok) {
                        alert('Withdrawal updated successfully!');
                        loadWithdrawals();
                    } else {
                        alert('Failed to update withdrawal');
                    }
                } catch (error) {
                    console.error('Update failed:', error);
                    alert('Update failed');
                }
            }
            
            // Load withdrawals on page load
            loadWithdrawals();
            
            // Refresh every 30 seconds
            setInterval(loadWithdrawals, 30000);
        </script>
    </body>
    </html>
    `);
  });


  // Setup webhook endpoint (call this once to register with Telegram)
  app.post('/api/telegram/setup-webhook', async (req: any, res) => {
    try {
      const { webhookUrl } = req.body;
      
      if (!webhookUrl) {
        return res.status(400).json({ message: 'Webhook URL is required' });
      }
      
      const success = await setupTelegramWebhook(webhookUrl);
      
      if (success) {
        res.json({ success: true, message: 'Webhook set up successfully' });
      } else {
        res.status(500).json({ success: false, message: 'Failed to set up webhook' });
      }
    } catch (error) {
      console.error('Setup webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Auto-setup webhook endpoint (automatically determines URL)
  app.get('/api/telegram/auto-setup', async (req: any, res) => {
    try {
      // Get the current domain from the request
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;
      
      console.log('Setting up Telegram webhook:', webhookUrl);
      
      const success = await setupTelegramWebhook(webhookUrl);
      
      if (success) {
        res.json({ 
          success: true, 
          message: 'Webhook set up successfully',
          webhookUrl 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Failed to set up webhook',
          webhookUrl 
        });
      }
    } catch (error) {
      console.error('Auto-setup webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Test endpoint to check bot functionality
  app.get('/api/telegram/test/:chatId', async (req: any, res) => {
    try {
      const { chatId } = req.params;
      console.log('🧪 Testing bot with chat ID:', chatId);
      
      const { sendWelcomeMessage } = await import('./telegram');
      const success = await sendWelcomeMessage(chatId);
      
      res.json({ 
        success, 
        message: success ? 'Test message sent!' : 'Failed to send test message',
        chatId 
      });
    } catch (error) {
      console.error('Test endpoint error:', error);
      res.status(500).json({ error: 'Test failed', details: error });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
