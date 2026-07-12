import type { NotificationProvider, NotificationChannelName } from './notification.types';

export class NotificationFactory {
  private readonly providersByName: Map<NotificationChannelName, NotificationProvider>;

  constructor(providers: NotificationProvider[]) {
    this.providersByName = new Map(
      providers.map((provider) => [provider.name, provider] as const),
    );
  }

  getProvider(channelName: NotificationChannelName): NotificationProvider {
    const provider = this.providersByName.get(channelName);

    if (!provider) {
      throw new Error(`Unsupported notification channel: ${channelName}`);
    }

    return provider;
  }

  listChannels(): NotificationChannelName[] {
    return [...this.providersByName.keys()];
  }
}
