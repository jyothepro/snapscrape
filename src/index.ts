import puppeteer from '@cloudflare/puppeteer';
import { normalizeUrl, 
    getDomain, 
    RotationManager, 
    getRandomDelay, 
    getRandomUserAgent, 
    getRandomFingerprint } from './utils';
import { RateLimiter } from './rateLimiter';
import { Tweet } from 'react-tweet/api';
import { html } from './response';
import { } from './utils';

const KEEP_BROWSER_ALIVE_IN_SECONDS = 60;
const TEN_SECONDS = 10000;



export default {
	async fetch(request: Request, env: Env) {
		const id = env.BROWSER.idFromName('browser');
		const obj = env.BROWSER.get(id);
		try {
			const resp = await obj.fetch(request.url, { headers: request.headers });
			return resp;
		} catch (error) {
			console.error('Error in Durable Object:', error);
			return new Response('Internal Server Error', { status: 500 });
		}
		
	},
};

export class Browser {
    private state: DurableObjectState;
    private env: Env;
    private keptAliveInSeconds: number;
    private storage: DurableObjectStorage;
    private browser: puppeteer.Browser | undefined;
    private request: Request | undefined;
    private llmFilter: boolean;
    private token: string = '';
    private rateLimiter: RateLimiter;
    private rotationManager: RotationManager;
    private ip: string;

    constructor(state: DurableObjectState, env: Env) {
        this.state = state;
        this.env = env;
        this.keptAliveInSeconds = 0;
        this.storage = this.state.storage;
        this.request = undefined;
        this.llmFilter = false;
        console.log('storage: ');
        console.log(this.storage);
        this.rateLimiter = new RateLimiter(5, TEN_SECONDS, this.storage); // 5 requests per 10 seconds
        this.rotationManager = new RotationManager(10, 10000, this.storage);
        this.ip = '';
    }

    async fetch(request: Request): Promise<Response> {
        const targetUrl = new URL(request.url).searchParams.get('url');
		const enableDetailedResponse = new URL(request.url).searchParams.get('enableDetailedResponse') === 'true';
        const crawlSubpages = new URL(request.url).searchParams.get('crawlSubpages') === 'true';
        const applyLLM = new URL(request.url).searchParams.get('applyLLM') === 'true';
        const contentType = request.headers.get('Accept') === 'application/json' ? 'json' : 'text';

        if (!targetUrl) {
			return this.buildHelpResponse();
		}

        this.ip = request.headers.get('cf-connecting-ip') || 'unknown';
        const allowed = await this.rateLimiter.limit(this.ip, null);
        if (!allowed) {
            return new Response('Rate limit exceeded', { status: 429 });
        }

		if (!this.isValidUrl(targetUrl)) {
			return new Response('Invalid URL provided, should be a full URL starting with http:// or https://', { status: 400 });
		}

		if (!(await this.ensureBrowser())) {
			return new Response('Could not start browser instance', { status: 500 });
		}

        let result: string | Array<{url: string, content: string}>;
        let wasSuccessful = false;
        try {
            if (crawlSubpages) {
              result = await this.crawlAndExtract(targetUrl, enableDetailedResponse, this.env, applyLLM);
            } else {
              result = await this.extractSinglePage(targetUrl, enableDetailedResponse, this.env, applyLLM);
            }
            wasSuccessful = true;
        } catch (error) {
            console.error(`Error during extraction: ${error}`);
            result = `Error: ${error instanceof Error ? error.message : String(error)}`;
        } finally {
            await this.rotationManager.rotate(wasSuccessful);
        }

        if (contentType === 'json') {
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
        } else {
            return new Response(typeof result === 'string' ? result : JSON.stringify(result), {
              status: 200,
              headers: { 'Content-Type': 'text/plain' }
            });
        }
    }

    private async addLLMFilter(content: string): Promise<string> {
        const prompt = `
You are an AI assistant that converts webpage content to markdown while filtering out unnecessary information. Please follow these guidelines:
Remove any inappropriate content, ads, or irrelevant information
If unsure about including something, err on the side of keeping it
Answer in English. Include all points in markdown in sufficient detail to be useful.
Aim for clean, readable markdown.
Return the markdown and nothing else.
Input: ${content}
Output:
\`\`\`markdown\n
`;
      
        const aiResult = await this.env.AI.run('@cf/meta/llama-2-7b-chat-fp16', {
          messages: [{ role: 'user', content: prompt }],
        }) as { response: string };
        return aiResult.response;;
    }
      

    private async handleTwitterUrl(url: string, env: Env): Promise<string> {
        const tweetId = url.split('/').pop();
        if (!tweetId) {
            return 'Invalid Twitter URL';
        }
    
        const apiUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&features=tfw_timeline_list%3A%3Btfw_follower_count_sunset%3Atrue%3Btfw_tweet_edit_backend%3Aon%3Btfw_refsrc_session%3Aon%3Btfw_fosnr_soft_interventions_enabled%3Aon%3Btfw_show_birdwatch_pivots_enabled%3Aon%3Btfw_show_business_verified_badge%3Aon%3Btfw_duplicate_scribes_to_settings%3Aon%3Btfw_use_profile_image_shape_enabled%3Aon%3Btfw_show_blue_verified_badge%3Aon%3Btfw_legacy_timeline_sunset%3Atrue%3Btfw_show_gov_verified_badge%3Aon%3Btfw_show_business_affiliate_badge%3Aon%3Btfw_tweet_edit_frontend%3Aon&token=4c2mmul6mnh`;
    
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'max-age=0',
                'TE': 'Trailers',
            },
        });
    
        if (!response.ok) {
            return 'Failed to fetch tweet';
        }
    
        const tweetData: any = await response.json();
        if (!this.isTweet(tweetData)) {
            return 'Tweet not found';
        }

        const tweet: Tweet = tweetData;
        const tweetMd = `
            Tweet from @${tweet.user?.name ?? tweet.user?.screen_name ?? 'Unknown'}

            ${tweet.text}
            Images: ${tweet.photos ? tweet.photos.map((photo: any) => photo.url).join(', ') : 'none'}
            Time: ${tweet.created_at}, Likes: ${tweet.favorite_count}, Retweets: ${tweet.conversation_count}

            raw: ${JSON.stringify(tweet, null, 2)}
        `;
    
        return tweetMd;
    }

    private async crawlAndExtract(
        baseUrl: string,
        enableDetailedResponse: boolean,
        env: Env,
        applyLLM: boolean,
        maxPages: number = 5,
        maxDepth: number = 3
    ): Promise<Array<{url: string, content: string}>> {
        const results: Array<{url: string, content: string}> = [];
        const visited = new Set<string>();
        const toVisit: Array<{ url: string; depth: number }> = [{ url: baseUrl, depth: 0 }];
        console.log("crawlAndExtract - 1.0");
        try {
            while (toVisit.length > 0 && results.length < maxPages) {
                const { url, depth } = toVisit.shift()!;
                const normalizedUrl = normalizeUrl(url);
                if (visited.has(normalizedUrl) || depth > maxDepth) continue;
                visited.add(normalizedUrl);
                console.log("crawlAndExtract - 2.0");
                await this.rateLimiter.limit(this.ip, async () => {
                    console.log("crawlAndExtract - 3.0");
                    if (this.rotationManager.shouldRotate()) {
                        this.rotationManager.rotate();
                    }
                    console.log("crawlAndExtract - 4.0");
                    // Apply random delay
                    await new Promise(resolve => setTimeout(resolve, getRandomDelay()));

                    const content = await this.extractSinglePage(normalizedUrl, enableDetailedResponse, env, applyLLM);
                    results.push({ url: normalizedUrl, content });
                    console.log("crawlAndExtract - 5.0");
                    if (results.length < maxPages) {
                        const newUrls = await this.extractLinks(normalizedUrl);
                        const baseUrlDomain = getDomain(baseUrl);
                        toVisit.push(...newUrls
                            .map(u => ({ url: normalizeUrl(u), depth: depth + 1 }))
                            .filter(({ url }) => !visited.has(url) && getDomain(url) === baseUrlDomain));
                    }
                });
            }
        } catch (error) {
            console.error(`Error during crawling: ${error}`);
        }
    
        return results;
    }

    private async extractLinks(url: string): Promise<string[]> {
        const page = await this.browser!.newPage();
        try {
            await page.goto(url, { waitUntil: 'networkidle0' });
            const links = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a'))
                    .map((a: any) => (a as any).href)
                    .filter((href: string) => href.startsWith('http'));
            });
            return links;
        } finally {
            await page.close();
        }
    }

    private async applyFingerprint(page: puppeteer.Page): Promise<void> {
        const fingerprint = this.rotationManager.getFingerprint();
        await page.evaluateOnNewDocument((fp) => {
          // This function runs in the browser context
          function applyBrowserFingerprint(fingerprint: any) {
            // @ts-ignore
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fingerprint.hardwareConcurrency });
            // @ts-ignore
            Object.defineProperty(navigator, 'deviceMemory', { get: () => fingerprint.deviceMemory });
            // @ts-ignore
            Object.defineProperty(navigator, 'platform', { get: () => fingerprint.platformVersion });
            // @ts-ignore
            Object.defineProperty(screen, 'width', { get: () => parseInt(fingerprint.screenResolution.split('x')[0]) });
            // @ts-ignore
            Object.defineProperty(screen, 'height', { get: () => parseInt(fingerprint.screenResolution.split('x')[1]) });
            // @ts-ignore
            Object.defineProperty(navigator, 'plugins', { get: () => [] });
            // @ts-ignore
            Object.defineProperty(navigator, 'languages', { get: () => fingerprint.languages });
            // @ts-ignore
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            // @ts-ignore
            declare var HTMLCanvasElement: any;
            // Canvas fingerprinting
            const originalGetContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(contextType) {
              const context = originalGetContext.apply(this, arguments);
              if (contextType === '2d') {
                const originalFillText = context.fillText;
                context.fillText = function() {
                  const text = arguments[0];
                  arguments[0] = text.split('').map(char => char + String.fromCharCode(0xE0000)).join('');
                  return originalFillText.apply(this, arguments);
                }
              }
              return context;
            };
      
            // WebGL fingerprinting
            const getParameterProxyHandler = {
              apply: function(target, thisArg, argumentsList) {
                const param = argumentsList[0];
                if (param === 37445) {
                  return fingerprint.webgl;
                }
                if (param === 37446) {
                  return fingerprint.webglVendorAndRenderer;
                }
                return target.apply(thisArg, argumentsList);
              }
            };
            const getParameterProxy = new Proxy(WebGLRenderingContext.prototype.getParameter, getParameterProxyHandler);
            WebGLRenderingContext.prototype.getParameter = getParameterProxy;
          }
      
          // Call the function with the fingerprint
          applyBrowserFingerprint(fp);
        }, fingerprint);
    }

    private async extractSinglePage(url: string, enableDetailedResponse: boolean, env: Env, applyLLM: boolean): Promise<string> {
        if (url.includes('twitter.com') || url.includes('x.com')) {
            return this.handleTwitterUrl(url, env);
        }
        
        const page = await this.browser!.newPage();
        try {
            await page.setUserAgent(this.rotationManager.getUserAgent());
            await this.applyFingerprint(page);
            
            await page.goto(url, { waitUntil: 'networkidle0' });
            return await this.extractContent(page, enableDetailedResponse, applyLLM, url);
        } finally {
          await page.close();
        }
    }

    private async extractContent(page: puppeteer.Page, enableDetailedResponse: boolean, applyLLM: boolean, url: string): Promise<string> {
        const maxRetries = 3;
        let retries = 0;
        
        while (retries < maxRetries) {
            try {
                let content: string;
                if (enableDetailedResponse) {
                    content = await page.content();
                } else {
                    content = await page.evaluate(() => {
                        const article = document.querySelector('article');
                        return article ? article.innerText : document.body.innerText;
                    });
                }
                
                content = await this.fetchAndProcessPage(url, enableDetailedResponse);
    
                if (applyLLM) {
                    content = await this.addLLMFilter(content);
                }
                
                return content;
            } catch (e) {
                if (e instanceof Error && e.message.includes("Execution context was destroyed")) {
                    console.log(`Retry ${retries + 1}/${maxRetries} due to destroyed context`);
                    retries++;
                    if (retries >= maxRetries) {
                        throw e;
                    }
                    // Wait a bit before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    // Reload the page
                    await page.reload({ waitUntil: 'networkidle0' });
                } else {
                    throw e;
                }
            }
        }
        throw new Error("Max retries reached");
    }
      

    private async ensureBrowser(): Promise<boolean> {
        let retries = 3;
        while (retries > 0) {
            if (!this.browser || !this.browser.isConnected()) {
                try {
                    this.browser = await puppeteer.launch(this.env.MYBROWSER);
                    return true;
                } catch (e) {
                    console.error(`Browser DO: Could not start browser instance. Error: ${e}`);
                    retries--;
                    if (retries === 0) {
                        return false;
                    }

                    const sessions = await puppeteer.sessions(this.env.MYBROWSER);
                    for (const session of sessions) {
                        const b = await puppeteer.connect(this.env.MYBROWSER, session.sessionId);
                        await b.close();
                    }

                    console.log(`Retrying to start browser instance. Retries left: ${retries}`);
                }
            } else {
                return true;
            }
        }
        return false;
    }

    private isTweet(obj: any): obj is Tweet {
        // Add checks here to ensure the object has the expected properties of a Tweet
        return (
            typeof obj === 'object' &&
            obj !== null &&
            typeof obj.id_str === 'string' &&
            typeof obj.text === 'string'
            // Add more checks as needed
        );
    }

    private async fetchAndProcessPage(url: string, enableDetailedResponse: boolean): Promise<string> {
        const page = await this.browser!.newPage();
		await page.goto(url, { waitUntil: 'networkidle0' });
		const md = await page.evaluate((enableDetailedResponse) => {
			function extractArticleMarkdown() {
				const readabilityScript = document.createElement('script');
				readabilityScript.src = 'https://unpkg.com/@mozilla/readability/Readability.js';
				document.head.appendChild(readabilityScript);

				const turndownScript = document.createElement('script');
				turndownScript.src = 'https://unpkg.com/turndown/dist/turndown.js';
				document.head.appendChild(turndownScript);

				let md = 'no content';

				// Wait for the libraries to load
				md = Promise.all([
					new Promise((resolve) => (readabilityScript.onload = resolve)),
					new Promise((resolve) => (turndownScript.onload = resolve)),
				]).then(() => {
					// Readability instance with the current document
					const reader = new Readability(document.cloneNode(true), {
						charThreshold: 0,
						keepClasses: true,
						nbTopCandidates: 500,
					});

					// Parse the article content
					const article = reader.parse();

					// Turndown instance to convert HTML to Markdown
					const turndownService = new TurndownService();

					let documentWithoutScripts = document.cloneNode(true);
					documentWithoutScripts.querySelectorAll('script').forEach((browserItem: any) => browserItem.remove());
					documentWithoutScripts.querySelectorAll('style').forEach((browserItem: any) => browserItem.remove());
					documentWithoutScripts.querySelectorAll('iframe').forEach((browserItem: any) => browserItem.remove());
					documentWithoutScripts.querySelectorAll('noscript').forEach((browserItem: any) => browserItem.remove());

					// article content to Markdown
					const markdown = turndownService.turndown(enableDetailedResponse ? documentWithoutScripts : article.content);

					return markdown;
				}) as unknown as string;

				return md;
			}
			return extractArticleMarkdown();
		}, enableDetailedResponse);
		await page.close();
		return md;
    }
    
    buildHelpResponse() {
		return new Response(html, {
			headers: { 'content-type': 'text/html;charset=UTF-8' },
		});
	}

    private async extractArticleMarkdown(enableDetailedResponse: boolean): Promise<string> {
        const readabilityScript = document.createElement('script');
        readabilityScript.src = 'https://unpkg.com/@mozilla/readability/Readability.js';
        document.head.appendChild(readabilityScript);
    
        const turndownScript = document.createElement('script');
        turndownScript.src = 'https://unpkg.com/turndown/dist/turndown.js';
        document.head.appendChild(turndownScript);
    
        await Promise.all([
            new Promise((resolve) => (readabilityScript.onload = resolve)),
            new Promise((resolve) => (turndownScript.onload = resolve)),
        ]);
    
        const reader = new Readability(document.cloneNode(true), {
            charThreshold: 0,
            keepClasses: true,
            nbTopCandidates: 500,
        });
    
        const article = reader.parse();
        const turndownService = new TurndownService();
    
        let documentWithoutScripts = document.cloneNode(true) as any;
        ['script', 'style', 'iframe', 'noscript'].forEach(tag => {
            documentWithoutScripts.querySelectorAll(tag).forEach(el => el.remove());
        });
    
        return turndownService.turndown(enableDetailedResponse ? documentWithoutScripts.body.innerHTML : article.content);
    }

    private isValidUrl(url: string): boolean {
        return /^(http|https):\/\/[^ "]+$/.test(url);
    }
}