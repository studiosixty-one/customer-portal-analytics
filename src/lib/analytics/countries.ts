/**
 * Country helpers shared by the country breakdown and the live globe.
 *
 * - `flagEmoji` / `countryName` need no data (emoji from the ISO code, names via
 *   Intl.DisplayNames).
 * - `COUNTRY_CENTROIDS` maps ISO-3166 alpha-2 → [lat, lng] so the globe can plot
 *   a marker per country. Curated to the countries that generate the vast
 *   majority of web traffic; unknown codes simply don't get a globe marker.
 */

export function flagEmoji(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🏳️";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function countryName(code: string): string {
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region" }).of(
        code.toUpperCase(),
      ) ?? code
    );
  } catch {
    return code;
  }
}

export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  US: [39.8, -98.6], CA: [56.1, -106.3], MX: [23.6, -102.6], BR: [-14.2, -51.9],
  AR: [-38.4, -63.6], CL: [-35.7, -71.5], CO: [4.6, -74.3], PE: [-9.2, -75.0],
  GB: [55.4, -3.4], IE: [53.4, -8.2], FR: [46.2, 2.2], ES: [40.5, -3.7],
  PT: [39.4, -8.2], DE: [51.2, 10.4], NL: [52.1, 5.3], BE: [50.5, 4.5],
  CH: [46.8, 8.2], AT: [47.5, 14.6], IT: [41.9, 12.6], PL: [51.9, 19.1],
  CZ: [49.8, 15.5], SE: [60.1, 18.6], NO: [60.5, 8.5], DK: [56.3, 9.5],
  FI: [61.9, 25.7], RU: [61.5, 105.3], UA: [48.4, 31.2], RO: [45.9, 24.9],
  GR: [39.1, 21.8], TR: [38.9, 35.2], HU: [47.2, 19.5], BG: [42.7, 25.5],
  RS: [44.0, 21.0], HR: [45.1, 15.2], SK: [48.7, 19.7], LT: [55.2, 23.9],
  LV: [56.9, 24.6], EE: [58.6, 25.0],
  IN: [22.4, 79.6], CN: [35.9, 104.2], JP: [36.2, 138.3], KR: [35.9, 127.8],
  ID: [-2.5, 118.0], PK: [30.4, 69.3], BD: [23.7, 90.4], VN: [14.1, 108.3],
  TH: [15.9, 100.99], PH: [12.9, 121.8], MY: [4.2, 101.98], SG: [1.35, 103.8],
  HK: [22.3, 114.2], TW: [23.7, 121.0], AE: [23.4, 53.8], SA: [23.9, 45.1],
  IL: [31.0, 34.9], QA: [25.4, 51.2], KW: [29.3, 47.5], JO: [30.6, 36.2],
  IR: [32.4, 53.7], IQ: [33.2, 43.7], KZ: [48.0, 66.9], UZ: [41.4, 64.6],
  AU: [-25.3, 133.8], NZ: [-40.9, 174.9],
  ZA: [-30.6, 22.9], NG: [9.1, 8.7], EG: [26.8, 30.8], KE: [-0.0, 37.9],
  MA: [31.8, -7.1], DZ: [28.0, 1.7], TN: [33.9, 9.6], GH: [7.9, -1.0],
  ET: [9.1, 40.5], TZ: [-6.4, 34.9], UG: [1.4, 32.3],
};
