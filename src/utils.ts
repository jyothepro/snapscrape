// Utils.ts

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