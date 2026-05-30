/**
 * EcollectClient: main entry point for the ecollect SDK.
 */

import type { EcollectConfig } from './config.js';
import { resolvedConfig } from './config.js';
import { InvalidConfigException } from './errors/index.js';
import { HttpClient } from './utils/http.js';
import { SessionModule } from './modules/session.js';
import { PaymentsModule } from './modules/payments.js';
import { TokensModule } from './modules/tokens.js';
import { WebhooksModule } from './modules/webhooks.js';
import { ReconciliationModule } from './modules/reconciliation.js';
import { CustomersModule } from './modules/customers.js';
import { PaymentSystemsModule } from './modules/paymentSystems.js';
import { PaymentLinksModule } from './modules/paymentLinks.js';

export class EcollectClient {
  public readonly session: SessionModule;
  public readonly payments: PaymentsModule;
  public readonly tokens: TokensModule;
  public readonly webhooks: WebhooksModule;
  public readonly reconciliation: ReconciliationModule;
  public readonly customers: CustomersModule;
  public readonly paymentSystems: PaymentSystemsModule;
  public readonly paymentLinks: PaymentLinksModule;

  private readonly resolvedCfg: Required<EcollectConfig>;

  constructor(config: EcollectConfig) {
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new InvalidConfigException('apiKey is required');
    }
    if (!config.etyCode || config.etyCode <= 0) {
      throw new InvalidConfigException('etyCode must be a positive integer');
    }
    if (config.environment !== 'test' && config.environment !== 'prod') {
      throw new InvalidConfigException('environment must be "test" or "prod"');
    }

    this.resolvedCfg = resolvedConfig(config);

    const http = new HttpClient({
      maxRetries: this.resolvedCfg.maxRetries,
      initialBackoffMs: this.resolvedCfg.initialBackoffMs,
      logLevel: this.resolvedCfg.logLevel,
    });

    this.session = new SessionModule(this.resolvedCfg, http);
    this.payments = new PaymentsModule(this.resolvedCfg, http, this.session);
    this.tokens = new TokensModule(this.resolvedCfg, http, this.session);
    this.webhooks = new WebhooksModule(this.resolvedCfg, http, this.session);
    this.reconciliation = new ReconciliationModule(this.resolvedCfg, http, this.session);
    this.customers = new CustomersModule(this.resolvedCfg, http, this.session);
    this.paymentSystems = new PaymentSystemsModule(this.resolvedCfg, http, this.session);
    this.paymentLinks = new PaymentLinksModule(this.payments);
  }
}
