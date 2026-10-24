// PayPal REST client for the sandbox.
//
// Two drivers behind one interface:
//   - live: real calls to api-m.sandbox.paypal.com
//   - mock: a deterministic in-process simulation with the same response shapes
//
// The mock driver exists so a judge can exercise the entire money path without
// credentials, and so the demo never fails because a network call timed out.
// Every mock response is stamped with `mock: true` and the UI surfaces that, so
// nobody has to guess which mode produced a screen. Configuration, not code,
// decides which driver runs.

import { randomUUID } from 'node:crypto';

const SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';

export function paypalConfigFromEnv(env = process.env) {
  const clientId = (env.PAYPAL_CLIENT_ID || '').trim();
  const clientSecret = (env.PAYPAL_CLIENT_SECRET || '').trim();
  const configured = Boolean(clientId && clientSecret);
  return {
    configured,
    mode: configured ? 'live' : 'mock',
    clientId,
    clientSecret,
    base: (env.PAYPAL_API_BASE || SANDBOX_BASE).replace(/\/+$/, ''),
    webhookId: (env.PAYPAL_WEBHOOK_ID || '').trim(),
    payoutClientId: (env.PAYPAL_PAYOUT_CLIENT_ID || '').trim() || clientId,
    payoutClientSecret: (env.PAYPAL_PAYOUT_CLIENT_SECRET || '').trim() || clientSecret,
    publicBaseUrl: (env.PUBLIC_BASE_URL || 'http://localhost:8787').replace(/\/+$/, ''),
  };
}

class TokenCache {
  constructor() {
    this.value = null;
    this.expiresAt = 0;
  }
  get() {
    return Date.now() < this.expiresAt - 30_000 ? this.value : null;
  }
  set(value, expiresInSeconds) {
    this.value = value;
    this.expiresAt = Date.now() + (Number(expiresInSeconds) || 300) * 1000;
  }
}

async function tokenFor({ clientId, clientSecret, base }, cache) {
  const cached = cache.get();
  if (cached) return cached;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const text = await response.text();
  if (!response.ok) {
    throw new PayPalError('oauth2/token failed', response.status, text);
  }
  const json = JSON.parse(text);
  cache.set(json.access_token, json.expires_in);
  return json.access_token;
}

export class PayPalError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'PayPalError';
    this.status = status;
    this.body = body;
  }
}

// ---------------------------------------------------------------------------
// Mock driver
// ---------------------------------------------------------------------------

function createMockDriver(config) {
  const state = {
    orders: new Map(),
    captures: new Map(),
    payouts: new Map(),
    transactions: [],
  };

  const feeFor = (micro) => {
    // Mirrors the sandbox commercial rate closely enough to make the
    // reconciliation screen honest: percentage plus a fixed component.
    const pct = Math.floor(micro * 0.0349);
    const fixed = 49_000; // $0.049
    return Math.min(micro, pct + fixed);
  };

  return {
    mode: 'mock',
    configured: config.configured,
    async createOrder({ amountMicro, currency = 'USD', reference, description }) {
      const id = `MOCK-ORDER-${randomUUID().slice(0, 12).toUpperCase()}`;
      const order = {
        id,
        status: 'CREATED',
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: reference,
            description,
            amount: { currency_code: currency, value: (amountMicro / 1_000_000).toFixed(2) },
          },
        ],
        links: [
          { rel: 'approve', href: `${config.publicBaseUrl}/mock/checkout/${id}`, method: 'GET' },
          { rel: 'capture', href: `${config.base}/v2/checkout/orders/${id}/capture`, method: 'POST' },
        ],
        mock: true,
        create_time: new Date().toISOString(),
      };
      state.orders.set(id, { order, amountMicro });
      return order;
    },

    /** Simulates the buyer approving the order in the PayPal window. */
    async approveOrder(orderId) {
      const entry = state.orders.get(orderId);
      if (!entry) throw new PayPalError('order not found', 404, orderId);
      entry.order.status = 'APPROVED';
      return entry.order;
    },

    async captureOrder(orderId) {
      const entry = state.orders.get(orderId);
      if (!entry) throw new PayPalError('order not found', 404, orderId);
      const captureId = `MOCK-CAPTURE-${randomUUID().slice(0, 12).toUpperCase()}`;
      const fee = feeFor(entry.amountMicro);
      const net = entry.amountMicro - fee;
      const capture = {
        id: captureId,
        status: 'COMPLETED',
        amount: {
          currency_code: 'USD',
          value: (entry.amountMicro / 1_000_000).toFixed(2),
        },
        seller_receivable_breakdown: {
          gross_amount: { currency_code: 'USD', value: (entry.amountMicro / 1_000_000).toFixed(2) },
          paypal_fee: { currency_code: 'USD', value: (fee / 1_000_000).toFixed(2) },
          net_amount: { currency_code: 'USD', value: (net / 1_000_000).toFixed(2) },
        },
        create_time: new Date().toISOString(),
        mock: true,
      };
      entry.order.status = 'COMPLETED';
      state.captures.set(captureId, { capture, amountMicro: entry.amountMicro, fee });
      state.transactions.push({
        transaction_info: {
          transaction_id: captureId,
          transaction_event_code: 'T0006',
          transaction_status: 'S',
          transaction_amount: { currency_code: 'USD', value: (entry.amountMicro / 1_000_000).toFixed(2) },
          fee_amount: { currency_code: 'USD', value: (fee / 1_000_000).toFixed(2) },
          available_balance: { currency_code: 'USD', value: (net / 1_000_000).toFixed(2) },
          transaction_initiation_date: new Date().toISOString(),
        },
      });
      return {
        id: orderId,
        status: 'COMPLETED',
        payer: { email_address: 'sb-buyer@business.example.com', payer_id: 'MOCKPAYER' },
        purchase_units: [
          {
            payments: {
              captures: [capture],
            },
          },
        ],
        mock: true,
      };
    },

    async createPayout({ items, senderBatchId, emailSubject, emailMessage }) {
      const batchId = `MOCK-BATCH-${randomUUID().slice(0, 12).toUpperCase()}`;
      const batch = {
        batch_header: {
          payout_batch_id: batchId,
          batch_status: 'SUCCESS',
          sender_batch_header: { sender_batch_id: senderBatchId, email_subject: emailSubject, email_message: emailMessage },
          time_created: new Date().toISOString(),
        },
        items: items.map((item, index) => ({
          payout_item_id: `MOCK-ITEM-${index}`,
          transaction_id: `MOCK-PAYOUT-${randomUUID().slice(0, 10).toUpperCase()}`,
          transaction_status: 'SUCCESS',
          payout_item_fee: { currency: 'USD', value: '0.00' },
          payout_item: {
            amount: { currency: item.amount.currency, value: item.amount.value },
            receiver: item.receiver,
          },
        })),
        mock: true,
      };
      state.payouts.set(batchId, batch);
      return batch;
    },

    async getPayout(batchId) {
      const batch = state.payouts.get(batchId);
      if (!batch) throw new PayPalError('payout batch not found', 404, batchId);
      return batch;
    },

    async listTransactions({ startDate, endDate }) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      return {
        transaction_details: state.transactions.filter((t) => {
          const at = new Date(t.transaction_info.transaction_initiation_date).getTime();
          return at >= start && at <= end;
        }),
        total_items: state.transactions.length,
        mock: true,
      };
    },

    /** Mock mode cannot receive a real webhook, so we synthesise the event. */
    synthesiseCaptureEvent(captureId, orderId) {
      return {
        id: `MOCK-EVENT-${randomUUID().slice(0, 10)}`,
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource_type: 'capture',
        resource: { id: captureId, status: 'COMPLETED', supplementary_data: { related_ids: { order_id: orderId } } },
        mock: true,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Live driver
// ---------------------------------------------------------------------------

function createLiveDriver(config) {
  const merchantTokens = new TokenCache();
  const payoutTokens = new TokenCache();

  async function call(path, { method = 'GET', body, usePayout = false, idempotencyKey } = {}) {
    const credentials = usePayout
      ? { clientId: config.payoutClientId, clientSecret: config.payoutClientSecret, base: config.base }
      : { clientId: config.clientId, clientSecret: config.clientSecret, base: config.base };
    const token = await tokenFor(credentials, usePayout ? payoutTokens : merchantTokens);
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) headers['PayPal-Request-Id'] = idempotencyKey;
    const response = await fetch(`${config.base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new PayPalError(`${method} ${path} failed`, response.status, text);
    return text ? JSON.parse(text) : {};
  }

  return {
    mode: 'live',
    configured: true,
    async createOrder({ amountMicro, currency = 'USD', reference, description }) {
      const value = (amountMicro / 1_000_000).toFixed(2);
      return call('/v2/checkout/orders', {
        method: 'POST',
        idempotencyKey: reference,
        body: {
          intent: 'CAPTURE',
          purchase_units: [{ reference_id: reference, description, amount: { currency_code: currency, value } }],
          application_context: {
            brand_name: 'AgentMeter',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
          },
        },
      });
    },

    /** In live mode approval happens inside PayPal's own window. */
    async approveOrder(orderId) {
      const order = await call(`/v2/checkout/orders/${orderId}`);
      return order;
    },

    async captureOrder(orderId) {
      return call(`/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        idempotencyKey: `${orderId}-capture`,
        body: {},
      });
    },

    async createPayout({ items, senderBatchId, emailSubject, emailMessage }) {
      return call('/v1/payments/payouts', {
        method: 'POST',
        usePayout: true,
        idempotencyKey: senderBatchId,
        body: {
          sender_batch_header: {
            sender_batch_id: senderBatchId,
            email_subject: emailSubject,
            email_message: emailMessage,
          },
          items,
        },
      });
    },

    async getPayout(batchId) {
      return call(`/v1/payments/payouts/${batchId}`, { usePayout: true });
    },

    async listTransactions({ startDate, endDate }) {
      const query = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        fields: 'all',
        page_size: '100',
      });
      return call(`/v1/reporting/transactions?${query}`);
    },

    synthesiseCaptureEvent() {
      throw new Error('live mode receives capture events over the webhook endpoint');
    },
  };
}

// ---------------------------------------------------------------------------

export function createPayPal(env = process.env) {
  const config = paypalConfigFromEnv(env);
  const driver = config.configured ? createLiveDriver(config) : createMockDriver(config);
  return { ...driver, config };
}

/**
 * Verify a webhook signature with PayPal. Returns true only on an explicit
 * SUCCESS. Any other outcome is a rejection, because a webhook that credits an
 * account is money, and money does not get the benefit of the doubt.
 */
export async function verifyWebhookSignature({ config, headers, rawBody }) {
  if (!config.webhookId) {
    return { verified: false, reason: 'PAYPAL_WEBHOOK_ID is not configured' };
  }
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const tokenResponse = await fetch(`${config.base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!tokenResponse.ok) return { verified: false, reason: `token request failed: ${tokenResponse.status}` };
  const { access_token: token } = await tokenResponse.json();

  const verification = await fetch(`${config.base}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: config.webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
  });
  const json = await verification.json().catch(() => ({}));
  return {
    verified: json.verification_status === 'SUCCESS',
    reason: json.verification_status || `http ${verification.status}`,
  };
}
