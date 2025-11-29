import crypto from 'crypto';

export interface ArcPayConfig {
  apiKey: string;
  privateKey: string;
  network: 'TON' | 'EVM';
  returnUrl: string;
  webhookUrl: string;
}

function getArcPayConfig(): ArcPayConfig {
  const apiKey = process.env.ARCPAY_API_KEY;
  const privateKey = process.env.ARCPAY_PRIVATE_KEY;
  const returnUrl = process.env.ARCPAY_RETURN_URL;
  const webhookUrl = process.env.ARCPAY_WEBHOOK_URL;
  
  if (!apiKey || !privateKey || !returnUrl || !webhookUrl) {
    throw new Error('Missing required ArcPay environment variables: ARCPAY_API_KEY, ARCPAY_PRIVATE_KEY, ARCPAY_RETURN_URL, ARCPAY_WEBHOOK_URL');
  }
  
  return {
    apiKey,
    privateKey,
    network: 'TON',
    returnUrl,
    webhookUrl,
  };
}

export const getARCPAY_CONFIG = getArcPayConfig;

export interface ArcPayPaymentRequest {
  orderID: string;
  amount: number;
  currency: 'TON' | 'USD';
  returnUrl: string;
  webhookUrl: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface ArcPayCheckoutResponse {
  status: 'success' | 'error';
  checkout_url?: string;
  order_id?: string;
  error?: string;
}

/**
 * Create a payment request with ArcPay API
 * This function prepares the payment request payload and returns the checkout URL
 */
export async function createArcPayCheckout(
  tonAmount: number,
  userId: string,
  userEmail?: string
): Promise<{ success: boolean; paymentUrl?: string; error?: string }> {
  try {
    if (tonAmount <= 0) {
      return { success: false, error: 'Amount must be greater than 0' };
    }

    // Generate unique order ID
    const orderId = `TON-${userId}-${Date.now()}`;

    // Get ArcPay config from environment
    const config = getArcPayConfig();
    
    // Create the payment request payload
    const paymentRequest: ArcPayPaymentRequest = {
      orderID: orderId,
      amount: tonAmount,
      currency: 'TON',
      returnUrl: config.returnUrl,
      webhookUrl: config.webhookUrl,
      description: `Top-Up ${tonAmount} TON`,
      metadata: {
        userId,
        userEmail,
        tonAmount,
        timestamp: new Date().toISOString(),
      },
    };

    console.log('📋 Creating ArcPay payment request:', {
      orderId,
      amount: tonAmount,
      currency: 'TON',
      userId,
    });

    // For production: Call actual ArcPay API
    // For now, we'll create a checkout URL structure that ArcPay expects
    const checkoutUrl = await generateArcPayCheckoutUrl(paymentRequest);

    return {
      success: true,
      paymentUrl: checkoutUrl,
    };
  } catch (error) {
    console.error('❌ Error creating ArcPay checkout:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to create payment request',
    };
  }
}

/**
 * Retry fetch with exponential backoff
 * Attempts a fetch request multiple times with increasing delays
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  delayMs = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} to call ArcPay API`);
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        const waitTime = delayMs * attempt;
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw new Error(`ArcPay service temporarily unavailable after ${maxRetries} attempts. Please try again later. ${lastError?.message || ''}`);
}

/**
 * Generate ArcPay checkout URL
 * This creates the payment link to redirect user to ArcPay gateway
 */
async function generateArcPayCheckoutUrl(
  paymentRequest: ArcPayPaymentRequest
): Promise<string> {
  // Development mode: Return mock checkout URL
  if (process.env.NODE_ENV === 'development' || process.env.REPL_ID) {
    console.log('🧪 Development mode: Generating mock ArcPay checkout URL');
    const mockCheckoutUrl = `https://checkout-test.arcpay.io?order_id=${encodeURIComponent(paymentRequest.orderID)}&amount=${paymentRequest.amount}&currency=${paymentRequest.currency}`;
    console.log('✅ Mock ArcPay checkout URL generated:', mockCheckoutUrl);
    return mockCheckoutUrl;
  }

  // Get ArcPay config from environment
  const config = getArcPayConfig();
  
  // CORRECTED ArcPay API endpoint (arcpay.online, not api.arcpay.io)
  const arcPayApiUrl = 'https://arcpay.online/api/v1/arcpay/order';

  // Prepare request payload according to ArcPay documentation
  // See: https://arcpay.online/docs/quick-start/
  // Note: ArcPay expects camelCase field names (orderId, not order_id)
  // CRITICAL: ArcPay requires "title" field in items[], NOT "name"
  const payload = {
    title: paymentRequest.description || `Top-Up ${paymentRequest.amount} TON`,
    orderId: paymentRequest.orderID,
    amount: paymentRequest.amount,
    currency: paymentRequest.currency,
    returnUrl: paymentRequest.returnUrl,
    webhookUrl: paymentRequest.webhookUrl,
    metadata: paymentRequest.metadata,
    network: config.network,
    // ArcPay requires items array with at least 1 product
    // Each item MUST have: title (required), description, quantity, price, currency
    items: [
      {
        title: `TON Token`,
        description: `Top-Up TON Balance`,
        quantity: Math.max(1, Math.floor(paymentRequest.amount * 10) / 10),
        price: paymentRequest.amount,
        currency: paymentRequest.currency
      }
    ]
  };

  // Validate items array before sending
  if (!payload.items || payload.items.length === 0) {
    throw new Error('Items array cannot be empty - ArcPay requires at least 1 item');
  }
  
  // Validate each item has required fields
  for (const item of payload.items) {
    if (!item.title || item.title.trim() === '') {
      throw new Error('Item title is required and cannot be empty');
    }
    if (!item.quantity || item.quantity <= 0) {
      throw new Error('Item quantity must be greater than 0');
    }
    if (!item.price || item.price <= 0) {
      throw new Error('Item price must be greater than 0');
    }
    if (!item.currency) {
      throw new Error('Item currency is required');
    }
  }

  try {
    console.log('🌐 Calling ArcPay API:', arcPayApiUrl);
    console.log('📦 Final payload before sending:', JSON.stringify(payload, null, 2));

    // Use retry logic for network resilience
    const response = await fetchWithRetry(
      arcPayApiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ArcKey': config.apiKey,
        },
        body: JSON.stringify(payload),
      },
      3,
      1000
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ ArcPay API error:', response.status, errorData);
      
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid ArcPay API credentials. Please check your API key.');
      } else if (response.status >= 500) {
        throw new Error('ArcPay service is currently experiencing issues. Please try again later.');
      }
      
      throw new Error(`ArcPay API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('📥 ArcPay response:', JSON.stringify(data, null, 2));

    // ArcPay returns { orderId, paymentUrl } on success
    if (data.paymentUrl) {
      console.log('✅ ArcPay checkout URL generated:', data.paymentUrl);
      return data.paymentUrl;
    } else if (data.checkout_url) {
      console.log('✅ ArcPay checkout URL generated:', data.checkout_url);
      return data.checkout_url;
    } else {
      throw new Error(data.error || 'Failed to generate checkout URL - no payment URL returned');
    }
  } catch (error) {
    console.error('❌ Error calling ArcPay API:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        throw new Error('Unable to connect to ArcPay service. Please check your internet connection and try again.');
      } else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
        throw new Error('ArcPay service request timed out. Please try again.');
      }
    }
    
    throw error;
  }
}

/**
 * Verify ArcPay webhook signature
 * This ensures the webhook is genuinely from ArcPay
 */
export function verifyArcPayWebhookSignature(
  payload: string,
  signature: string
): boolean {
  try {
    // Get ArcPay config from environment
    const config = getArcPayConfig();
    
    // Create HMAC signature using private key
    const expectedSignature = crypto
      .createHmac('sha256', config.privateKey)
      .update(payload)
      .digest('hex');

    // Compare signatures
    return expectedSignature === signature;
  } catch (error) {
    console.error('❌ Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Process ArcPay webhook payload
 * Handles payment success/failure notifications
 */
export interface ArcPayWebhookPayload {
  event: 'payment.success' | 'payment.failed' | 'payment.pending';
  order_id: string;
  amount: number;
  currency: string;
  status: 'completed' | 'failed' | 'pending';
  transaction_hash?: string;
  metadata?: {
    userId?: string;
    tonAmount?: number;
    pdzAmount?: number; // Legacy support
  };
  timestamp: string;
}

export function parseArcPayWebhook(body: string): ArcPayWebhookPayload | null {
  try {
    return JSON.parse(body);
  } catch (error) {
    console.error('❌ Error parsing webhook payload:', error);
    return null;
  }
}
