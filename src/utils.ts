// Utils.ts

import { customAlphabet } from 'nanoid';
import { v4 as uuidv4 } from 'uuid';

const nanoid = customAlphabet('1234567890abcdef', 10);

export function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRandomUserAgent(): string {
    const browsers = [
      { name: 'Chrome', minVersion: 70, maxVersion: 110 },
      { name: 'Firefox', minVersion: 60, maxVersion: 100 },
      { name: 'Safari', minVersion: 12, maxVersion: 16 },
      { name: 'Edge', minVersion: 80, maxVersion: 110 }
    ];
    const os = [
      { name: 'Windows', versions: ['10.0', '6.3', '6.2', '6.1'] },
      { name: 'MacOS', versions: ['10.15', '11.0', '12.0', '13.0'] },
      { name: 'Linux', versions: [''] }
    ];
  
    const browser = browsers[Math.floor(Math.random() * browsers.length)];
    const osSystem = os[Math.floor(Math.random() * os.length)];
    const osVersion = osSystem.versions[Math.floor(Math.random() * osSystem.versions.length)];
    const browserVersion = `${getRandomInt(browser.minVersion, browser.maxVersion)}.0.${getRandomInt(1000, 9999)}.${getRandomInt(10, 99)}`;
  
    return `Mozilla/5.0 (${osSystem.name} ${osVersion}) AppleWebKit/537.36 (KHTML, like Gecko) ${browser.name}/${browserVersion} Safari/537.36`;
}
  

export function getRandomFingerprint(): any {
    const screenResolution = `${getRandomInt(1024, 2560)}x${getRandomInt(768, 1440)}`;
    return {
      screenResolution,
      colorDepth: getRandomInt(24, 32),
      availableScreenResolution: screenResolution,
      timezoneOffset: getRandomInt(-720, 720),
      sessionStorage: Math.random() > 0.5,
      localStorage: Math.random() > 0.5,
      indexedDb: Math.random() > 0.5,
      cpuClass: ['x86', 'x64', 'arm'][Math.floor(Math.random() * 3)],
      platformVersion: `${getRandomInt(5, 15)}.${getRandomInt(0, 9)}.${getRandomInt(0, 9)}`,
      doNotTrack: ['1', 'null', 'unspecified'][Math.floor(Math.random() * 3)],
      plugins: [],
      canvas: nanoid(),
      webgl: nanoid(),
      webglVendorAndRenderer: nanoid(),
      adBlock: Math.random() > 0.5,
      hasLiedLanguages: false,
      hasLiedResolution: false,
      hasLiedOs: false,
      hasLiedBrowser: false,
      touchSupport: [getRandomInt(0, 5), getRandomInt(0, 5), Math.random() > 0.5],
      fonts: [],
      audio: nanoid(),
      languages: ['en-US', 'en'],
      deviceMemory: [2, 4, 8, 16][Math.floor(Math.random() * 4)],
      hardwareConcurrency: [2, 4, 8, 16][Math.floor(Math.random() * 4)],
    };
}

export class RotationManager {
    private counter: number = 0;
    private lastRotation: number = Date.now();
    private currentUserAgent: string;
    private currentFingerprint: any;
    private successfulFingerprints: Map<string, number> = new Map();
    private blockedFingerprints: Set<string> = new Set();
  
    constructor(
      private rotationInterval: number = 10,
      private timeWindow: number = 10000,
      private storage: DurableObjectStorage
    ) {
        this.currentUserAgent = getRandomUserAgent();
        this.currentFingerprint = getRandomFingerprint();
        this.loadFingerprints().catch(error => console.error('Error loading fingerprints:', error));
    }
  
    private async loadFingerprints() {
        const successful = await this.storage.get('successfulFingerprints');
        if (successful) {
          this.successfulFingerprints = new Map(JSON.parse(successful as string));
        } else {
          this.successfulFingerprints = new Map();
        }
      
        const blocked = await this.storage.get('blockedFingerprints');
        if (blocked) {
          this.blockedFingerprints = new Set(JSON.parse(blocked as string));
        } else {
          this.blockedFingerprints = new Set();
        }
      }
  
      private async saveFingerprints() {
        await this.storage.put('successfulFingerprints', JSON.stringify(Array.from(this.successfulFingerprints.entries())));
        await this.storage.put('blockedFingerprints', JSON.stringify(Array.from(this.blockedFingerprints)));
      }
  
    shouldRotate(): boolean {
      this.counter++;
      const now = Date.now();
      if (this.counter >= this.rotationInterval || now - this.lastRotation >= this.timeWindow) {
        this.counter = 0;
        this.lastRotation = now;
        return true;
      }
      return false;
    }
  
    async rotate(wasSuccessful: boolean) {
      if (wasSuccessful) {
        const fingerprintId = JSON.stringify(this.currentFingerprint);
        this.successfulFingerprints.set(fingerprintId, (this.successfulFingerprints.get(fingerprintId) || 0) + 1);
      } else {
        this.blockedFingerprints.add(JSON.stringify(this.currentFingerprint));
      }
  
      await this.saveFingerprints();
  
      // Try to reuse a successful fingerprint
      const successfulFingerprints = Array.from(this.successfulFingerprints.entries());
      if (successfulFingerprints.length > 0 && Math.random() < 0.7) {
        const [fingerprintId] = successfulFingerprints[Math.floor(Math.random() * successfulFingerprints.length)];
        this.currentFingerprint = JSON.parse(fingerprintId);
      } else {
        do {
          this.currentFingerprint = getRandomFingerprint();
        } while (this.blockedFingerprints.has(JSON.stringify(this.currentFingerprint)));
      }
  
      this.currentUserAgent = getRandomUserAgent();
      this.rotationInterval = getRandomInt(8, 12);
      this.timeWindow = getRandomInt(9000, 11000);
    }
  
    getUserAgent(): string {
      return this.currentUserAgent;
    }
  
    getFingerprint(): any {
      return this.currentFingerprint;
    }
  }

export function getRandomDelay(): number {
  // Return a random delay between 1 and 5 seconds
  return getRandomInt(1000, 5000);
}

/**
 * Normalize a URL by removing fragments and query parameters.
 * @param url - The URL to normalize.
 * @returns The normalized URL.
 */
export function normalizeUrl(url: string): string {
    try {
        const parsedUrl = new URL(url);
        parsedUrl.hash = ''; // Remove fragment
        parsedUrl.search = ''; // Remove query parameters
        return parsedUrl.toString();
    } catch (error) {
        console.error(`Error normalizing URL: ${error}`);
        return url;
    }
}

/**
 * Extract the domain from a URL.
 * @param url - The URL to extract the domain from.
 * @returns The domain of the URL.
 */
export function getDomain(url: string): string {
    try {
        return new URL(url).hostname;
    } catch (error) {
        console.error(`Error extracting domain from URL: ${error}`);
        return '';
    }
}