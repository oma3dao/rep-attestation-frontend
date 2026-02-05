# Test Coverage Report

**Last Updated:** February 5, 2026  
**Framework:** Vitest v3.2.4 with v8 coverage

## Current Coverage Summary

```
=============================== Coverage summary ===============================
Statements   : 99.83% ( 5458/5467 )
Branches     : 93.94% ( 993/1057 )
Functions    : 95.93% ( 189/197 )
Lines        : 99.83% ( 5458/5467 )
================================================================================
```

## Test Statistics

- **Test Files:** 44 passed
- **Total Tests:** 503 passed, 11 skipped (514 total)
- **Duration:** ~20 seconds

## Coverage by Directory

| Directory | Statements | Branches | Functions | Lines |
|-----------|------------|----------|-----------|-------|
| app | 100% | 100% | 100% | 100% |
| app/api/eas/delegated-attest | 100% | 91.3% | 100% | 100% |
| app/api/eas/nonce | 100% | 100% | 100% | 100% |
| app/attest | 100% | 100% | 100% | 100% |
| app/attest/[type] | 100% | 81.25% | 100% | 100% |
| app/dashboard | 100% | 100% | 100% | 100% |
| components | 99.85% | 90.13% | 94.11% | 99.85% |
| components/ui | 100% | 96.05% | 100% | 100% |
| config | 100% | 100% | 100% | 100% |
| lib | 99.83% | 94.44% | 98.21% | 99.83% |
| lib/utils/caip10 | 100% | 100% | 100% | 100% |
| lib/utils/caip10/validators | 96.85% | 94.23% | 100% | 96.85% |

## Remaining Uncovered Code (9 statements)

The following lines remain uncovered due to being unreachable or extremely difficult to test:

### Unreachable Defensive Code (Cannot be tested)

1. **`src/lib/service.ts` line 98**
   - Default switch case that TypeScript prevents from executing
   - The `serviceType` is constrained to `'eas' | 'bas'`

2. **`src/lib/utils/caip10/validators/solana.ts` lines 81-85**
   - Error handling after `decodeBase58()` call
   - Unreachable because prior `isBase58()` check guarantees valid base58

### Extremely Difficult to Test (Race conditions)

3. **`src/components/ObjectFieldRenderer.tsx` lines 89-90**
   - Dynamic import loading state
   - Import resolves too fast in tests to capture loading state

4. **`src/components/caip10-input.tsx` line 124**
   - Debounce setTimeout callback
   - Stale closure issue with fake timers makes this unreliable to test

## Coverage History

| Date | Statements | Notes |
|------|------------|-------|
| Feb 5, 2026 | 99.83% | Final optimized coverage |
| Feb 5, 2026 | 99.78% | After redundancy review |
| Feb 5, 2026 | 99.68% | Before redundancy review |
| Earlier | ~67-69% | Various stages of improvement |

## Notes

- The 9 uncovered statements represent defensive programming patterns that are either:
  - Impossible to reach in production due to TypeScript type constraints
  - Race conditions that cannot be reliably captured in a test environment
- Current coverage of 99.83% represents effective 100% of testable code
