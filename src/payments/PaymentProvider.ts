// Provider-agnostic payment interface. Business logic (checkout, webhooks) talks
// ONLY to this interface; each gateway is an interchangeable implementation.
// See references/payments.md.

export interface Customer {
  name?: string
  phone?: string
  email?: string
}

export interface InitiateParams {
  orderId: string
  tenantId: string
  amount: number // authoritative, server-computed; minor units / integer FCFA
  currency: string
  customer: Customer
  callbackUrl: string // tenant-scoped webhook URL
}

export interface InitiateResult {
  redirectUrl: string
  providerRef: string // idempotency key; echoed back in the webhook
}

export interface WebhookEvent {
  providerRef: string
  status: 'success' | 'failed' | 'pending'
  amount: number
}

export type PaymentStatus = 'success' | 'failed' | 'pending' | 'unknown'

export interface PaymentProvider {
  /** Stable provider key, used to build webhook URLs and select impls. */
  readonly name: string
  /** Create the transaction at the gateway; return where to send the buyer. */
  initiate(p: InitiateParams): Promise<InitiateResult>
  /** Validate signature + parse an incoming webhook into a normalized event. */
  verifyWebhook(rawBody: string, headers: Headers): WebhookEvent | null
  /** Active status check, for reconciliation when a webhook never arrives. */
  getStatus(providerRef: string): Promise<PaymentStatus>
}
