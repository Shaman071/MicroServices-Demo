# Runtime Validation Report

**Generated**: 2026-10-14T23:54:22+05:30  
**Target**: `D:\Basic Microservice Demo`

## Summary

| Step | Status | Exit Code | Details |
|------|--------|-----------|---------|
| Startup | PASS | 0 | Test harness started both services on temporary ports and observed `/health` with MongoDB connected. Missing required configuration also exits with code 1 and a clear message. |
| User Service Tests | PASS | 0 | `cd user-service; npm test` — 1 test passed. |
| Order Service Tests | PASS | 0 | `cd order-service; npm test` — 2 tests passed, including cross-service HTTP and dependency-unavailable flows. |
| Dependency Audit | PASS | 0 | `npm audit --omit=dev` reported 0 vulnerabilities for both services. |
| Browser E2E | N/A | n/a | API-only project; no browser UI to exercise. |

**Overall**: PASS

## Environment

- Node.js: `v22.17.1`
- npm: `10.9.2`
- MongoDB: available at `127.0.0.1:27017`; integration tests used isolated, temporary databases and removed them during teardown.
- Docker: unavailable; it was not needed because a real local MongoDB instance was available.
- Playwright: not applicable to these REST-only services.

## Coverage

- User creation, read-back persistence, duplicate email, missing fields, missing user, invalid ID, and malformed JSON.
- Order creation after live User Service validation, persisted order retrieval, missing-user rejection, invalid order input, malformed JSON, and User Service-unavailable response.
- Both service health endpoints reported a connected database.
- No authentication routes or credentials are implemented in this demo; authentication-failure testing does not apply.

## Issues Fixed During Validation

- The test harness used `exitCode` alone to detect stopped child processes. On Windows, processes terminated by a signal set `signalCode` instead, which left test runs waiting for an exit event. The harness now checks both codes and completes cleanup correctly.
- Malformed JSON requests now return a JSON `400` response from both services rather than Express's default HTML error response.

## Verdict

```text
environment:
  docker: UNAVAILABLE — Docker is not installed.
  node: AVAILABLE — v22.17.1.
  playwright: NOT APPLICABLE — API-only services; no browser-rendered UI.
  infra-tier: PRIMARY(real MongoDB) — local MongoDB at 127.0.0.1:27017 was available; no in-memory fallback used.
  browser-tier: NOT APPLICABLE — no browser UI.
startup: PASS — both test-launched services became ready at /health with MongoDB connected.
integration: PASS — exit_code: 0 for each service test command; passed: 3, failed: 0, skipped: 0; isolated real MongoDB databases.
e2e: PASS — exit_code: 0; passed: 2 order-service tests; cross-service user verification, order persistence/read-back, missing user, and dependency outage exercised.
overall: PASS — both services and their tested REST flows worked against real MongoDB.
```
