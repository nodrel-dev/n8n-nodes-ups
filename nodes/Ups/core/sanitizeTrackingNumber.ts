// Pure core: validate + normalize the inquiry number that Track interpolates into the URL PATH.
//
// Track is the only operation whose URL carries a user value
// (`/track/v1/details/{{$parameter.trackingNumber}}`); the other three POST a body to a static
// path. The value cannot become a host — requestDefaults.baseURL is credential-derived and the
// value lands after three fixed segments — but `..` segments, `?`, or `#` would let an inquiry
// number sourced from untrusted input (a webhook, an AI-Agent tool call) retarget the
// AUTHENTICATED request at a different UPS API path, carrying the user's bearer token with it.
//
// Every UPS inquiry number format is alphanumeric (1Z + 16, T + 10, Mail Innovations digit runs,
// bare 9/10/11-digit references), so an alphanumeric allowlist rejects nothing legitimate. This is
// an allowlist rather than an escape on purpose: percent-encoding a traversal attempt would still
// hand UPS a nonsense number, and failing at the boundary gives the user a clear message instead.
const TRACKING_NUMBER = /^[A-Za-z0-9]{1,35}$/;

/**
 * Returns the trimmed inquiry number when it is safe to place in the URL path, or `null` when it
 * is empty, over-long, or contains anything outside `[A-Za-z0-9]`. Callers turn `null` into a
 * NodeOperationError — a pre-call boundary failure, never a NodeApiError.
 */
export function sanitizeTrackingNumber(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const trimmed = raw.trim();
	return TRACKING_NUMBER.test(trimmed) ? trimmed : null;
}
