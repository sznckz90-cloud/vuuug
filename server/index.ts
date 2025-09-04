import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add webhook route BEFORE any other middleware to ensure it works
app.post('/api/telegram/webhook', async (req: any, res) => {
  try {
    console.log('📨 Direct webhook called!', JSON.stringify(req.body, null, 2));
    
    const { handleTelegramMessage } = await import('./telegram');
    const handled = await handleTelegramMessage(req.body);
    console.log('✅ Message handled:', handled);
    
    res.status(200).json({ ok: true, handled });
  } catch (error) {
    console.error('❌ Direct webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test endpoint
app.get('/api/test-direct', (req: any, res) => {
  console.log('✅ Direct test route called!');
  res.json({ status: 'Direct API route working!', timestamp: new Date().toISOString() });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Auto-setup Telegram webhook on server start
    if (process.env.TELEGRAM_BOT_TOKEN) {
      try {
        const { setupTelegramWebhook } = await import('./telegram');
        // Use the correct Replit domain for the webhook
        const domain = process.env.REPLIT_DOMAIN || 
                      (process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.replit.app` : null) ||
                      'lighting-sats-app.onrender.com'; // fallback to your production domain
        const webhookUrl = `https://${domain}/api/telegram/webhook`;
        log(`Setting up Telegram webhook: ${webhookUrl}`);
        
        const success = await setupTelegramWebhook(webhookUrl);
        if (success) {
          log('✅ Telegram webhook configured successfully');
        } else {
          log('❌ Failed to configure Telegram webhook');
        }
      } catch (error) {
        log('❌ Error setting up Telegram webhook:', String(error));
      }
    }
  });
})();
