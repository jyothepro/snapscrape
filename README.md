# SnapScrape

An open-source web scraping tool that converts websites into markdown format.
Featuring customizable options, LLM-based filtering, and an easy-to-use API for efficient content extraction and analysis.

# Web Scraping Tool

This project is a web scraping tool inspired by [markdowner](https://github.com/supermemoryai/markdowner) by [@dhravya](https://github.com/Dhravya). While the original project served as a foundation, this version has been rebuilt to address deployment issues that I was not able to resolve.

Special thanks to [@dhravya](https://github.com/Dhravya) for open-sourcing the original markdowner, which provided valuable insights and inspiration for this tool.

## Features

SnapScrape offers a versatile set of capabilities for web content extraction and processing:

1. **Website to Markdown Conversion**
   - Transform any web page into clean, formatted Markdown
   - Preserve essential content structure and formatting

2. **LLM-Powered Content Filtering**
   - Utilize Large Language Models to refine and curate scraped content
   - Enhance relevance and quality of extracted information

3. **Flexible Output Formats**
   - Text: Receive scraped content as plain text for easy integration
   - JSON: Get structured data output for programmatic use
   - Markdown: Obtain content in Markdown format for documentation or content management systems

These features make SnapScrape suitable for a wide range of applications, from content aggregation to data analysis and documentation automation.

## Supports:
1. **Rate Limiting**: Prevents overwhelming the target server by limiting the number of requests per interval.
3. **Fingerprinting Rotation**: Randomizes browser fingerprints to mimic different users and avoid detection.
4. **Random Delays**: Adds random delays between requests to simulate human behavior and avoid detection.
5. **User Agent Rotation**: Randomizes browser user agents to mimic different users and avoid detection.

## Usage

Make a GET request to the snapscrape.jyothepro.com

### Basic Example

To convert a website to Markdown, use the following curl command:

```bash
curl 'https://snapscrape.jyothepro.com/?url=https://example.com' --output result.md
```
### Parameters

#### Required

- `url` (string): The website URL to convert into Markdown.

#### Optional

- `llmFilter` (boolean, default: false): When set to `true`, uses LLM to filter out unnecessary information.

### Response Formats

SnapScrape supports multiple response formats. Specify the desired format using the `Accept` header:

1. **Plain Text**:
```bash
curl 'https://snapscrape.jyothepro.com/?url=https://example.com' 
-H 'Accept: text/plain' 
--output result.txt
```


2. **JSON**:
```bash
curl 'https://snapscrape.jyothepro.com/?url=https://example.com' 
-H 'Accept: application/json' 
--output result.json
```

### Examples

1. Convert a website to Markdown with LLM filtering:
```bash
curl 'https://snapscrape.jyothepro.com/?url=https://example.com&llmFilter=true' 
--output filtered_result.md
```


2. Get JSON response:
```bash
curl 'https://snapscrape.jyothepro.com/?url=https://example.com' 
-H 'Accept: application/json' 
--output result.json
```

## Technology Stack

SnapScrape leverages cutting-edge Cloudflare technologies to provide efficient and scalable web scraping capabilities:

1. [Cloudflare Browser Rendering](https://developers.cloudflare.com/browser-rendering/):
   This service allows us to spin up headless browser instances in the cloud. It enables SnapScrape to render JavaScript-heavy pages and capture dynamic content that traditional scraping methods might miss.

2. [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/):
   Durable Objects provide a consistent and low-latency environment for our scraping operations. They allow us to maintain stateful interactions with web pages and manage concurrent scraping tasks efficiently.

3. [Turndown](https://github.com/mixmark-io/turndown):
   After capturing the rendered HTML content, we use Turndown to convert it into clean, readable Markdown format. This step ensures that the scraped content is easily consumable and can be integrated into various documentation systems or content management platforms.

This combination of technologies enables SnapScrape to handle complex web pages, maintain high performance, and produce high-quality Markdown output suitable for a wide range of applications.

## How to deploy
* You cannot dpeloy on your local machine as it needs browser rendering and Durable Objects from cloudflare.

You can easily host this project on cloudflare. To use the browser rendering and Durable Objects, you need the [Workers paid plan](https://developers.cloudflare.com/workers-ai/platform/pricing/)

1. Clone the repo and download dependencies

```
git clone https://github.com/jyothepro/snapscrape
npm install
```

2. Run this command:
```
npx wrangler kv namespace create md_cache
```
3. Open Wrangler.toml and change the kv_namespaces section
4. Run 
```
npm run deploy
```

# How to Deploy SnapScrape

SnapScrape is a web scraping tool that requires Cloudflare's special features. This guide will walk you through the process of deploying SnapScrape to Cloudflare's servers.

## Prerequisites

Before you begin, ensure you have the following:

1. **Cloudflare Account**: Sign up at [Cloudflare.com](https://www.cloudflare.com/) if you don't have an account.
2. **Workers Paid Plan**: SnapScrape requires Cloudflare's [Workers Paid Plan](https://developers.cloudflare.com/workers-ai/platform/pricing/) for Browser Rendering and Durable Objects.
3. **Node.js and npm**: Install from [nodejs.org](https://nodejs.org/).
4. **Git**: Install from [git-scm.com](https://git-scm.com/).


## Step 1: Get the Project Files

1. Clone the repository:
git clone https://github.com/jyothepro/snapscrape

2. Move into the project directory:
cd snapscrape


## Step 2: Install Project Dependencies

Run the following command to install necessary packages:
npm install


## Step 3: Install and Set Up Wrangler

Wrangler is Cloudflare's command-line tool for managing and deploying Workers projects.

1. Install Wrangler globally:
npm install -g wrangler


2. Verify the installation:
wrangler --version


3. Authenticate Wrangler with your Cloudflare account:
wrangler login

   Follow the prompts to log in via your web browser.

## Step 4: Configure the Project

1. Create a KV namespace for caching:
npx wrangler kv:namespace create md_cache

   Copy the output that looks like 
   `[[kv_namespaces]]
    binding = "md_cache"
    id = "6895f05a78334c86abe1a91a86133642"`

2. Open the `wrangler.toml` file in a text editor.

3. Find the `kv_namespaces` section and replace it with the text you copied in step 1.


## Step 6: Deploy to Cloudflare

Run the deployment command:
npm run deploy


## Step 5: Verify Deployment

1. After successful deployment, Cloudflare will provide a URL where your app is live.
2. Visit this URL in your web browser to ensure it's working correctly.

## Troubleshooting

If you encounter any issues during deployment:

- Double-check that you've signed up for the Cloudflare Workers Paid Plan.
- Ensure you've correctly copied the KV namespace information into `wrangler.toml`.
- Verify that you're logged in to Wrangler with the correct Cloudflare account.
- Check that all prerequisites are installed correctly.
- For Wrangler-specific issues:
  - Ensure npm's global bin directory is in your system's PATH.
  - On Windows, try running the command prompt as an administrator.
  - For permission issues on Unix-based systems, try using `sudo` with the installation command.

For additional assistance, consult the [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/).

## Important Note

SnapScrape cannot be deployed on a local machine as it requires Cloudflare's Browser Rendering and Durable Objects features. Always deploy directly to Cloudflare using the steps outlined above.