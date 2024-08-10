// rateLimiter.ts

export class RateLimiter {
    private requests: number;
    private interval: number;
    private storage: DurableObjectStorage;

    constructor(requestsPerInterval: number, interval: number, storage: DurableObjectStorage) {
        this.requests = requestsPerInterval;
        this.interval = interval;
        this.storage = storage;
    }

    private async getLastRequestTime(key: string): Promise<number> {
        const lastRequest = await this.storage.get(`${key}:lastRequest`);
        return lastRequest ? Number(lastRequest) : 0;
    }

    private async getRequestCount(key: string): Promise<number> {
        const count = await this.storage.get(`${key}:count`);
        return count ? Number(count) : 0;
    }

    private async updateState(key: string, time: number, count: number): Promise<void> {
        await this.storage.put(`${key}:lastRequest`, time.toString());
        await this.storage.put(`${key}:count`, count.toString());
    }

    public async limit<T>(key: string, fn: (() => Promise<T>) | null): Promise<boolean> {
        try {
            const now = Date.now();
            const lastRequestTime = await this.getLastRequestTime(key);
            let requestCount = await this.getRequestCount(key);
            
            console.log(`Time: ${lastRequestTime}, Count: ${requestCount}`);
    
            if (now - lastRequestTime > this.interval) {
                requestCount = 1;
            } else {
                requestCount++;
            }
    
            await this.updateState(key, now, requestCount);
    
            if (requestCount <= this.requests) {
                if (fn) {
                    await fn();
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error in rate limiting:', error);
            return false;  // Fail closed: deny on error
        }
    }
}