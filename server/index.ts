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
  // IMPORTANT: Register API routes BEFORE Vite middleware to prevent catch-all interference
  const server = await registerRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Setup Vite/static serving AFTER API routes are registered
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // For Replit, use port 5000. For Render, use PORT env variable (default 10000).
  // this serves both the API and the client.
  let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
  
  // Ensure port is valid
  if (isNaN(port) || port <= 0 || port >= 65536) {
    console.error(`Invalid port: ${process.env.PORT}, using default 5000`);
    port = 5000;
  }
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
        // Use the correct domain for the webhook (Replit, Render, or fallback)
        const domain = process.env.REPLIT_DOMAIN || 
                      (process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.replit.app` : null) ||
                      process.env.RENDER_EXTERNAL_URL?.replace(/^https?:\/\//, '') ||
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
