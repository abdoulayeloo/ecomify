// PayDunya implementation — Senegalese aggregator covering Wave, Orange Money,
// Free Money + local cards. See references/regional-senegal.md. Verify exact
// endpoints/field names and signature scheme against current PayDunya docs at
// integration time — do not hardcode fee assumptions.
import type {
  PaymentProvider,
  InitiateParams,
  InitiateResult,
  WebhookEvent,
  PaymentStatus,
} from '../PaymentProvider'

export interface PayDunyaCreds {
  masterKey: string
  privateKey: string
  token: string
  mode: 'test' | 'live'
}

export class PayDunyaProvider implements PaymentProvider {
  readonly name = 'paydunya'
  constructor(private creds: PayDunyaCreds) {}

  async initiate(_p: InitiateParams): Promise<InitiateResult> {
    // TODO: POST a checkout-invoice to PayDunya with _p.amount (XOF),
    // _p.callbackUrl, and custom_data carrying { tenantId, orderId } so the
    // webhook can route back. Return { redirectUrl: invoice.response_text /
    // checkout_url, providerRef: invoice.token }.
    throw new Error('PayDunyaProvider.initiate not implemented')
  }

  verifyWebhook(_rawBody: string, _headers: Headers): WebhookEvent | null {
    // TODO: PayDunya posts form-encoded data with a hashed master key. Recompute
    // the hash from creds.masterKey and compare; reject on mismatch. On success
    // map status 'completed' -> 'success'. Return { providerRef, status, amount }.
    throw new Error('PayDunyaProvider.verifyWebhook not implemented')
  }

  async getStatus(_providerRef: string): Promise<PaymentStatus> {
    // TODO: confirm-invoice lookup by token for the reconciliation sweep.
    return 'unknown'
  }
}
