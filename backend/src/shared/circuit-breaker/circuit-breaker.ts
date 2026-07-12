export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export type CircuitBreakerOptions = {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenSuccessThreshold: number;
};

export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private openedAt = 0;

  constructor(private readonly options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.ensureCallAllowed();

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  getStatus(): CircuitBreakerState {
    this.refreshState();
    return this.state;
  }

  private ensureCallAllowed(): void {
    this.refreshState();

    if (this.state === 'open') {
      throw new Error('Circuit breaker is open');
    }
  }

  private recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount += 1;

      if (this.successCount >= this.options.halfOpenSuccessThreshold) {
        this.reset();
      }

      return;
    }

    this.reset();
  }

  private recordFailure(): void {
    this.failureCount += 1;

    if (this.state === 'half-open' || this.failureCount >= this.options.failureThreshold) {
      this.trip();
    }
  }

  private refreshState(): void {
    if (this.state !== 'open') {
      return;
    }

    if (Date.now() - this.openedAt >= this.options.resetTimeoutMs) {
      this.state = 'half-open';
      this.successCount = 0;
    }
  }

  private trip(): void {
    this.state = 'open';
    this.openedAt = Date.now();
    this.successCount = 0;
  }

  private reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.openedAt = 0;
  }
}
