/**
 * Convert country code to flag emoji
 * @param {string} countryCode 2-letter country code
 * @example
 * countryCodeToFlag('us')
 * // => 🇺🇸
 * @returns {string}
 */
export function countryCodeToFlag(countryCode: string): string {
	return countryCode.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397))
}
