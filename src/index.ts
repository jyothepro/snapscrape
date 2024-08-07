import puppeteer from '@cloudflare/puppeteer';
import { Tweet } from 'react-tweet/api';
import { html } from './response';

const KEEP_BROWSER_ALIVE_IN_SECONDS = 60;
const TEN_SECONDS = 10000;



export default {
	async fetch(request: Request, env: Env) {
		const ip = request.headers.get('cf-connecting-ip');
		// if (!(env.BACKEND_SECURITY_TOKEN === request.headers.get('Authorization')?.replace('Bearer ', ''))) {
		// 	const { success } = await env.RATELIMITER.limit({ key: ip });

		// 	if (!success || request.url.includes('poemanalysis')) {
		// 		return new Response('Rate limit exceeded', { status: 429 });
		// 	}
		// }

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

    constructor(state: DurableObjectState, env: Env) {
        this.state = state;
        this.env = env;
        this.keptAliveInSeconds = 0;
        this.storage = this.state.storage;
        this.request = undefined;
        this.llmFilter = false;
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

		if (!this.isValidUrl(targetUrl)) {
			return new Response('Invalid URL provided, should be a full URL starting with http:// or https://', { status: 400 });
		}

		if (!(await this.ensureBrowser())) {
			return new Response('Could not start browser instance', { status: 500 });
		}

        let result: string | Array<{url: string, content: string}>;
        if (crawlSubpages) {
            result = await this.crawlAndExtract(targetUrl, enableDetailedResponse, this.env, applyLLM);
        } else {
            result = await this.extractSinglePage(targetUrl, enableDetailedResponse, this.env, applyLLM);
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
    
        const tweet = await response.json();
        if (!tweet || typeof tweet !== 'object' || !tweet.text) {
            return 'Tweet not found';
        }
    
        const tweetMd = `
            Tweet from @${tweet.user?.name ?? tweet.user?.screen_name ?? 'Unknown'}

            ${tweet.text}
            Images: ${tweet.photos ? tweet.photos.map((photo) => photo.url).join(', ') : 'none'}
            Time: ${tweet.created_at}, Likes: ${tweet.favorite_count}, Retweets: ${tweet.conversation_count}

            raw: ${JSON.stringify(tweet, null, 2)}
        `;
    
        return tweetMd;
    }

    private async crawlAndExtract(baseUrl: string, enableDetailedResponse: boolean, env: Env, applyLLM:boolean,  maxPages: number = 5): Promise<Array<{url: string, content: string}>> {
        const results: Array<{url: string, content: string}> = [];
        const visited = new Set<string>();
        const toVisit = [baseUrl];
      
        while (toVisit.length > 0 && results.length < maxPages) {
          const url = toVisit.shift()!;
          if (visited.has(url)) continue;
          visited.add(url);
      
          const content = await this.extractSinglePage(url, enableDetailedResponse, env, applyLLM);
          results.push({ url, content });
      
          if (results.length < maxPages) {
            const newUrls = await this.extractLinks(url);
            toVisit.push(...newUrls.filter(u => !visited.has(u)));
          }
        }
      
        return results;
    }

    private async extractSinglePage(url: string, enableDetailedResponse: boolean, env: Env, applyLLM: boolean): Promise<string> {
        if (url.includes('twitter.com') || url.includes('x.com')) {
            return this.handleTwitterUrl(url, env);
        }
        
        const page = await this.browser!.newPage();
        try {
          await page.goto(url, { waitUntil: 'networkidle0' });
          return await this.extractContent(page, enableDetailedResponse, applyLLM, url);
        } finally {
          await page.close();
        }
    }

	private async extractContent(page: puppeteer.Page, enableDetailedResponse: boolean, applyLLM: boolean, url:string): Promise<string> {
        let content: string;
        if (enableDetailedResponse) {
          content = await page.content();
        } else {
          // Extract main content (you might want to implement a more sophisticated extraction method)
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

    private extractArticleMarkdown(enableDetailedResponse: boolean): Promise<string> {
        const readabilityScript = document.createElement('script');
        readabilityScript.src = 'https://unpkg.com/@mozilla/readability/Readability.js';
        document.head.appendChild(readabilityScript);

        const turndownScript = document.createElement('script');
        turndownScript.src = 'https://unpkg.com/turndown/dist/turndown.js';
        document.head.appendChild(turndownScript);

        return Promise.all([
            new Promise((resolve) => (readabilityScript.onload = resolve)),
            new Promise((resolve) => (turndownScript.onload = resolve)),
        ]).then(() => {
            const reader = new Readability(document.cloneNode(true), {
                charThreshold: 0,
                keepClasses: true,
                nbTopCandidates: 500,
            });

            const article = reader.parse();
            const turndownService = new TurndownService();

            let documentWithoutScripts = document.cloneNode(true) as Document;
            ['script', 'style', 'iframe', 'noscript'].forEach(tag => {
                documentWithoutScripts.querySelectorAll(tag).forEach(el => el.remove());
            });

            return turndownService.turndown(enableDetailedResponse ? documentWithoutScripts.body.innerHTML : article.content);
        });
    }

    private isValidUrl(url: string): boolean {
        return /^(http|https):\/\/[^ "]+$/.test(url);
    }
}