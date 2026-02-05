# Contract Mocking Issues - Test Engineering Notes

## Problem

The API route tests are failing because the `Contract` mock from ethers.js isn't properly returning methods when `new Contract()` is called.

## Root Cause

The route creates Contract instances like this:
```typescript
const easReadOnly = new Contract(easAddress, abi, provider);
const nonce = await easReadOnly.getNonce(attester);
```

The mock needs to ensure that **every** `new Contract()` call returns an object with the required methods (`getNonce`, `getSchemaRegistry`, `getSchema`, `attestByDelegation`).

## Current Mock Implementation

```typescript
const createMockContract = () => {
  return {
    getNonce: vi.fn().mockResolvedValue(BigInt(0)),
    getSchemaRegistry: vi.fn().mockResolvedValue('0x' + 'registry'.repeat(8)),
    getSchema: vi.fn().mockResolvedValue({...}),
    attestByDelegation: vi.fn().mockResolvedValue({...}),
  }
}

const MockContract = vi.fn().mockImplementation(createMockContract)
```

## Issue

The mock is set up correctly, but there may be a timing issue with `vi.resetModules()` in `beforeEach`. When modules are reset, the mock may not be properly re-applied.

## Solutions to Try

### Option 1: Don't reset modules between tests
```typescript
beforeEach(() => {
  // Remove vi.resetModules() or use it more carefully
  vi.clearAllMocks()
  // ... rest of setup
})
```

### Option 2: Re-apply mock after reset
```typescript
beforeEach(async () => {
  vi.resetModules()
  // Re-import and re-mock after reset
  await import('ethers')
  // ... re-apply mocks
})
```

### Option 3: Use vi.hoisted() for mocks
```typescript
const { mockContract } = vi.hoisted(() => {
  return {
    mockContract: vi.fn().mockImplementation(() => ({
      getNonce: vi.fn().mockResolvedValue(BigInt(0)),
      // ...
    }))
  }
})
```

## Test Status

- ✅ 20/25 API route tests passing
- ❌ 5 tests failing due to Contract mock issues:
  1. Signature validation (signer mismatch)
  2. Idempotency (duplicate submission)
  3. Chain handling (environment chain)
  4. Transaction submission (parameter verification)
  5. Transaction submission (success response)

## Recommendation

For test engineering purposes, these tests are **correctly written** but need the mocking infrastructure fixed. The tests document the expected behavior and will pass once the Contract mock is properly configured.

## Workaround

Tests can be marked as `it.skip()` with a note about the mocking issue, or the test expectations can be made more flexible to accept 500 errors when contract calls fail.
