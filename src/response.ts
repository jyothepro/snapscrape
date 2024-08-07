export const html = `<!--
// Author: @jyothepro
-->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SnapScrape - Web Scraping Made Easy</title>
    <meta name="description" content="SnapScrape is a powerful web scraping tool that converts websites into markdown format ready to feed LLMs. Easy to use with customizable options.">
    <meta name="keywords" content="web scraping, markdown, API, content extraction, AI, LLM ready">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
	<link rel="icon" type="image/png" href="https://jyo-dev.s3.amazonaws.com/favicon.ico">

	<meta property="og:type" content="website">
    <meta property="og:url" content="https://snapscrape.jyothepro.com/">
    <meta property="og:title" content="SnapScrape - Web Scraping Made Easy">
    <meta property="og:description" content="Convert any website into markdown format ready to feed any LLM with SnapScrape. Customizable options and easy-to-use API.">
    <meta property="og:image" content="https://jyo-dev.s3.amazonaws.com/logo.png">

	<meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="https://snapscrape.jyothepro.com/">
    <meta property="twitter:title" content="SnapScrape - Web Scraping Made Easy">
    <meta property="twitter:description" content="Convert any website into markdown format ready to feed any LLM with SnapScrape. Customizable options and easy-to-use API.">
    <meta property="twitter:image" content="https://jyo-dev.s3.amazonaws.com/logo.png">

</head>
<body class="bg-gray-100 min-h-screen flex flex-col items-center justify-center p-4">
    <div class="w-full max-w-2xl bg-white shadow-md rounded-lg p-6">
		<div id="spinnerContainer" class="hidden absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 backdrop-blur-sm z-50">
			<svg class="w-12 h-12 text-gray-300 animate-spin" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
				<path
					d="M32 3C35.8083 3 39.5794 3.75011 43.0978 5.20749C46.6163 6.66488 49.8132 8.80101 52.5061 11.4939C55.199 14.1868 57.3351 17.3837 58.7925 20.9022C60.2499 24.4206 61 28.1917 61 32C61 35.8083 60.2499 39.5794 58.7925 43.0978C57.3351 46.6163 55.199 49.8132 52.5061 52.5061C49.8132 55.199 46.6163 57.3351 43.0978 58.7925C39.5794 60.2499 35.8083 61 32 61C28.1917 61 24.4206 60.2499 20.9022 58.7925C17.3837 57.3351 14.1868 55.199 11.4939 52.5061C8.801 49.8132 6.66487 46.6163 5.20749 43.0978C3.7501 39.5794 3 35.8083 3 32C3 28.1917 3.75011 24.4206 5.2075 20.9022C6.66489 17.3837 8.80101 14.1868 11.4939 11.4939C14.1868 8.80099 17.3838 6.66487 20.9022 5.20749C24.4206 3.7501 28.1917 3 32 3L32 3Z"
					stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
				<path
					d="M32 3C36.5778 3 41.0906 4.08374 45.1692 6.16256C49.2477 8.24138 52.7762 11.2562 55.466 14.9605C58.1558 18.6647 59.9304 22.9531 60.6448 27.4748C61.3591 31.9965 60.9928 36.6232 59.5759 40.9762"
					stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" class="text-gray-900">
				</path>
			</svg>
        </div>

        <h1 class="text-4xl font-bold text-center mb-8 text-black">SnapScrape</h1>
		<div class="text-xl max-w-2xl bg-white p-4">
			Convert any website into markdown format ready to feed any LLM
		</div>
        
        <div class="mb-6">
            <input id="urlInput" type="text" placeholder="Enter a URL" class="w-full p-2 border border-gray-300 rounded-md mb-2">
            <button id="scrapeButton" class="w-full bg-gray-800 text-white p-2 rounded-md hover:bg-gray-700 transition">Scrape Content</button>
        </div>
        
        <div class="bg-gray-200 p-4 rounded-md relative mb-6">
            <pre class="text-sm overflow-x-auto"><code>$ curl -X GET 'https://snapscrape.jyothepro.com/?url=https://en.wikipedia.org/wiki/Mount_Everest'</code></pre>
            <button id="copyButton" class="absolute top-0 right-2 text-gray-600 hover:text-gray-800" onclick="copyToClipboard()">
                <i class="fas fa-copy"></i>
            </button>
            <span id="copyFeedback" class="absolute top-0 right-8 text-green-600 opacity-0 transition-opacity duration-300">Copied!</span>
        </div>
        
        <div class="mb-6">
            <h2 class="text-xl font-semibold mb-2 text-black">Options</h2>
            <ul class="list-disc list-inside text-sm text-gray-700">
                <li><code class="bg-gray-200 px-1 rounded">enableDetailedResponse</code>: Toggle for detailed response with full HTML content</li>
                <li><code class="bg-gray-200 px-1 rounded">crawlSubpages</code>: Crawl and return markdown for up to 10 subpages</li>
                <li><code class="bg-gray-200 px-1 rounded">llmFilter</code>: Filter out unnecessary information using LLM</li>
            </ul>
        </div>

        <div class="mb-6">
            <h2 class="text-xl font-semibold mb-2 text-black">Response Types</h2>
            <ul class="list-disc list-inside text-sm text-gray-700">
                <li>Add <code class="bg-gray-200 px-1 rounded">Content-Type: text/plain</code> in headers for plain text response</li>
                <li>Add <code class="bg-gray-200 px-1 rounded">Content-Type: application/json</code> in headers for JSON response</li>
            </ul>
        </div>

		<div class="bg-gradient-to-r from-gray-100 to-gray-200 border border-gray-300 rounded-lg p-4 mb-6">
            <p class="text-sm text-gray-700 italic">
                <span class="font-semibold">Need more power?</span>
				<p class="text-sm text-gray-700 italic">
					If your use case requires higher rate limits, we offer premium API keys tailored to your needs.
				</p>
            </p>
            <a href="https://twitter.com/jyothepro" class="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800 transition duration-300">
                DM me on X</i>
            </a>
        </div>
    </div>

    <footer class="mt-8 text-center text-gray-600">
        <div class="flex justify-center space-x-4">
            <a href="https://github.com/jyothepro/snapscrape" target="_blank" rel="noopener noreferrer" class="inline-flex items-center hover:text-gray-800">
                <i class="fab fa-github mr-2"></i>
                View on GitHub
            </a>
            <a href="https://twitter.com/jyothepro" target="_blank" rel="noopener noreferrer" class="inline-flex items-center hover:text-gray-800">
                <i class="fab fa-twitter mr-2"></i>
                Follow on Twitter
            </a>
        </div>
    </footer>

    <script>
		document.addEventListener('DOMContentLoaded', function() {
			document.getElementById('scrapeButton').addEventListener('click', function() {
				const urlInput = document.getElementById('urlInput').value;
				if (urlInput) {
					const spinnerContainer = document.getElementById('spinnerContainer');
                    spinnerContainer.classList.remove('hidden');

					window.location.href = 'https://markdowner-final.cooljyo.workers.dev/?url=' + encodeURIComponent(urlInput);

				}
			});
		});

		function copyToClipboard() {
			const curlCommand = document.querySelector('code').innerText;
			const trimmedCommand = curlCommand.slice(2);
			navigator.clipboard.writeText(trimmedCommand).then(() => {
				const feedback = document.getElementById('copyFeedback');
				feedback.classList.remove('opacity-0');
				feedback.classList.add('opacity-100');
				setTimeout(() => {
					feedback.classList.remove('opacity-100');
					feedback.classList.add('opacity-0');
				}, 2000);
			});
		}
    </script>
</body>
</html>`;