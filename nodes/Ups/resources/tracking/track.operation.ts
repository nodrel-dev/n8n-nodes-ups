import {
	NodeOperationError,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
	type IN8nHttpFullResponse,
	type INodeExecutionData,
	type INodeProperties,
} from 'n8n-workflow';
import { mapTrackStatus, type TrackDetail } from '../../core/mapTrackStatus';
import { mapUpsError } from '../../core/mapUpsError';
import { sanitizeTrackingNumber } from '../../core/sanitizeTrackingNumber';

const showOnlyForTrack = {
	operation: ['track'],
	resource: ['tracking'],
};

// preSend enforces the URL-path boundary BEFORE any UPS call. Track is the only operation that
// interpolates a user value into the path, so an inquiry number arriving from untrusted input (a
// webhook, an AI-Agent tool call) must not be able to carry `..`, `?`, or `#` and retarget the
// authenticated request at another UPS endpoint. The url is REBUILT from the sanitized value
// rather than merely validated, so the guard stays authoritative even if the routing template
// above is edited later. Like the other preSends we throw NodeOperationError — a pre-call boundary
// failure, which n8n rewraps with httpCode='none' to distinguish it from a real UPS HTTP error.
async function trackPreSend(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const raw = this.getNodeParameter('trackingNumber', '') as unknown;
	const trackingNumber = sanitizeTrackingNumber(raw);

	if (trackingNumber === null) {
		throw new NodeOperationError(this.getNode(), 'Invalid UPS tracking number.', {
			description:
				'A UPS inquiry number is letters and digits only (for example 1Z9999999999999999), up to 35 characters. Remove any spaces, slashes, or punctuation — and if this value comes from an earlier node, check it is the tracking number and not a URL or a whole record.',
		});
	}

	requestOptions.url = `/track/v1/details/${trackingNumber}`;
	return requestOptions;
}

// postReceive runs on EVERY response because the request sets `ignoreHttpStatusErrors: true`
// (ADR-0004). On non-2xx we hand the body to the shared mapUpsError (surfaces UPS code/message
// verbatim, classifies, flags per-item under Continue On Fail). On success we shape via the pure core.
async function trackPostReceive(
	this: IExecuteSingleFunctions,
	_items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	if (response.statusCode >= 400) {
		mapUpsError(this.getNode(), response.body, response.statusCode);
	}

	const detail = this.getNodeParameter('detail', 'detailed') as TrackDetail;
	const results = mapTrackStatus(response.body as object, { detail });
	return results.map((json) => ({ json: json as unknown as INodeExecutionData['json'] }));
}

// Track parameters. Track is GET-per-inquiry-number → one input item per number (native iteration,
// delta 13.3). Only `locale` is sent in v1; returnPOD/returnSignature/returnMilestones are deferred.
export const trackOperationDescription: INodeProperties[] = [
	{
		displayName: 'Tracking Number',
		name: 'trackingNumber',
		type: 'string',
		required: true,
		default: '',
		placeholder: '1Z9999999999999999',
		displayOptions: { show: showOnlyForTrack },
		description: 'The UPS inquiry (tracking) number to look up. One number per item.',
	},
	{
		displayName: 'Detail',
		name: 'detail',
		type: 'options',
		options: [
			{ name: 'Detailed (Status + Activity History)', value: 'detailed' },
			{ name: 'Status Only', value: 'status' },
		],
		default: 'detailed',
		displayOptions: { show: showOnlyForTrack },
		description: 'Whether to include the full scan/activity history or only the current status',
	},
	{
		displayName: 'Locale',
		name: 'locale',
		type: 'string',
		default: 'en_US',
		displayOptions: { show: showOnlyForTrack },
		description:
			'Language and country code for status text, separated by an underscore (e.g. en_US)',
		routing: {
			send: { type: 'query', property: 'locale' },
		},
	},
];

// The operation option (merged into the resource's Operation selector by tracking/index.ts).
export const trackOperationOption = {
	name: 'Track',
	value: 'track',
	action: 'Track a shipment',
	description: 'Get current status and scan history for a tracking number',
	routing: {
		request: {
			method: 'GET' as const,
			url: '=/track/v1/details/{{$parameter.trackingNumber}}',
			// UPS Track v1 REQUIRES both headers or it 400s with TV0011 "Missing transactionSrc"
			// + TV0001 "Missing transId" (verified live CIE 2026-06-19 — gotchas §13). transId is a
			// caller-set unique transaction id (≤32 chars); transactionSrc identifies the client.
			// Track is the only one of the four UPS APIs that requires these (Rate/Validate/Ship
			// accept the calls without them).
			headers: {
				transId: "={{ 'n8n-' + $now.toMillis() }}",
				transactionSrc: 'n8n-nodes-ups',
			},
			ignoreHttpStatusErrors: true,
		},
		send: {
			preSend: [trackPreSend],
		},
		output: {
			postReceive: [trackPostReceive],
		},
	},
};
