// Pure core: resolve a human-readable UPS service name from the service code.
//
// UPS's Rating response carries `Service: { Code: "14", Description: "" }` — the description field
// is PRESENT but EMPTY (verified live against CIE 2026-09-06). So `Description ?? ''` yields an
// empty string rather than falling back, and every rate row shipped with a blank service name
// (issue #44). The name has to be resolved locally from the code.
//
// The catch is that the SAME code names DIFFERENT products depending on the origin country: from
// the US, `01` is Next Day Air; from Canada it is Express. A flat table would confidently mislabel
// every rate for a Canadian shipper — including this project's own CIE test account, which is
// Canada-registered (gotchas §12). So the lookup is keyed on origin, using the Effective Origin
// (ShipFrom else Shipper) that already decides international classification (ADR-0003), so naming
// and classification can never disagree about where a shipment starts.
//
// This is a curated table, not an exhaustive one: UPS publishes service codes per origin country
// and adds products over time. Unmapped codes degrade to `UPS Service <code>` — still readable,
// still carries the code, and never silently blank.

// Codes that mean the same product from any origin (the international/worldwide family).
const SHARED: Record<string, string> = {
	'07': 'UPS Worldwide Express',
	'08': 'UPS Worldwide Expedited',
	'11': 'UPS Standard',
	'54': 'UPS Worldwide Express Plus',
	'65': 'UPS Worldwide Saver',
	'96': 'UPS Worldwide Express Freight',
};

// US origin — also the fallback for origins we have no specific table for.
const US: Record<string, string> = {
	...SHARED,
	'01': 'UPS Next Day Air',
	'02': 'UPS 2nd Day Air',
	'03': 'UPS Ground',
	'12': 'UPS 3 Day Select',
	'13': 'UPS Next Day Air Saver',
	'14': 'UPS Next Day Air Early',
	'59': 'UPS 2nd Day Air A.M.',
};

// Canada origin — 01/02/13/14 are the Express family here, NOT the US Next Day Air family.
const CA: Record<string, string> = {
	...SHARED,
	'01': 'UPS Express',
	'02': 'UPS Expedited',
	'12': 'UPS 3 Day Select',
	'13': 'UPS Express Saver',
	'14': 'UPS Express Early',
	'70': 'UPS Access Point Economy',
};

const BY_ORIGIN: Record<string, Record<string, string>> = { US, CA };

/**
 * Resolve the display name for a UPS service code.
 *
 * @param code           UPS `Service.Code` (e.g. `"03"`).
 * @param originCountry  Effective Origin country code; unknown origins use the US table.
 * @param upsDescription `Service.Description` as returned by UPS. Used verbatim when non-empty so
 *                       UPS stays authoritative about its own product names if it ever populates it.
 */
export function serviceName(
	code: string,
	originCountry: string,
	upsDescription?: string,
): string {
	const fromUps = (upsDescription ?? '').trim();
	if (fromUps.length > 0) return fromUps;

	if (code.length === 0) return '';

	const table = BY_ORIGIN[originCountry.trim().toUpperCase()] ?? US;
	return table[code] ?? `UPS Service ${code}`;
}
