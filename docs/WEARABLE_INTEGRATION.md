# Wearable Integration

## Current availability
The API and client include Web Bluetooth and companion-ingestion paths, but support is limited to device/browser combinations that expose compatible services and require explicit user permission. No generic smartwatch connection is assumed.

The integration status endpoint should remain authoritative:
- Web Bluetooth: available only in supported browsers, after user action and permission
- Apple Health: requires an iOS companion app or approved bridge; unavailable to an ordinary web page
- Android Health Connect: requires a native companion/bridge with permissions
- Fitbit and other vendor cloud APIs: require approved provider credentials/scopes and are not live merely because a UI exists

## Data handling
Wearable ingestion should validate owner, source, timestamp, units and schema; normalize supported units; deduplicate records; and preserve source and measured time. Manual input must remain labelled manual. AI summaries are not measurements or diagnoses.

## Outstanding verification
The following are not established as production-ready: provider-specific OAuth token lifecycle, revocation/deletion end to end, partial sync retry, stale-data UX across all screens, and native Apple/Android companion behavior. Do not report a device as connected or synced without provider confirmation.
