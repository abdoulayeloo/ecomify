// CinetPay implementation — broad West-Africa wallet coverage; choose for
// regional (CI, Mali, ...) expansion. See references/regional-senegal.md. Verify
// endpoints/signature against current CinetPay docs at integration time.
import type {
  PaymentProvider,
  InitiateParams,
  InitiateResult,
  WebhookEvent,
  PaymentStatus,
} from '../PaymentProvider'

export interface CinetPayCreds {
  apiKey: string
  siteId: string
  secretKey: string
  mode: 'test' | 'live'
}

export class CinetPayProvider implements PaymentProvider {
  readonly name = 'cinetpay'
  constructor(private creds: CinetPayCreds) {}

  async initiate(_p: InitiateParams): Promise<InitiateResult> {
    // TODO: POST /v2/payment with apikey/site_id, transaction_id = orderId,
    // amount, currency 'XOF', notify_url = _p.callbackUrl, and metadata carrying
    // tenantId. Return { redirectUrl: data.payment_url, providerRef: transaction_id }.
    throw new Error('CinetPayProvider.initiate not implemented')
  }

  verifyWebhook(_rawBody: string, _headers: Headers): WebhookEvent | null {
    // TODO: verify the x-token HMAC (creds.secretKey) over the posted fields;
    // reject on mismatch. Then re-check via /v2/payment/check before trusting.
    throw new Error('CinetPayProvider.verifyWebhook not implemented')
  }

  async getStatus(_providerRef: string): Promise<PaymentStatus> {
    // TODO: /v2/payment/check by transaction_id for the reconciliation sweep.
    return 'unknown'
  }
}
