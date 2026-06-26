import type { PaymentProvider, PaymentProviderName } from './payment.types';

export class PaymentFactory {
  private readonly providersByName: Map<PaymentProviderName, PaymentProvider>;

  constructor(providers: PaymentProvider[]) {
    this.providersByName = new Map(
      providers.map((provider) => [provider.name, provider] as const),
    );
  }

  getProvider(providerName: PaymentProviderName): PaymentProvider {
    const provider = this.providersByName.get(providerName);

    if (!provider) {
      throw new Error(`Unsupported payment provider: ${providerName}`);
    }

    return provider;
  }

  listProviders(): PaymentProviderName[] {
    return [...this.providersByName.keys()];
  }
}
