# Next Steps - EAS Delegated Attestation Test Improvements

## Immediate Actions

### 1. Verify Test Execution ✅
```bash
# Run all delegated attestation tests
npm test -- tests/lib/eas-delegated.test.ts tests/app/api/eas/delegated-attest.test.ts

# Run with coverage
npm run test:coverage -- tests/lib/eas-delegated.test.ts tests/app/api/eas/delegated-attest.test.ts
```

**Current Status**:
- ✅ EAS Utilities: 27/27 passing
- ⚠️ API Route: 20/25 passing (5 tests need Contract mock fixes)

### 2. Fix Contract Mocking Issues (High Priority)

**Problem**: 5 tests fail because `Contract` mock doesn't return methods properly.

**Solution Options**:

#### Option A: Use `vi.hoisted()` for Stable Mocks
```typescript
const { mockContractFactory } = vi.hoisted(() => {
  const createContract = () => ({
    getNonce: vi.fn().mockResolvedValue(BigInt(0)),
    getSchemaRegistry: vi.fn().mockResolvedValue('0x...'),
    getSchema: vi.fn().mockResolvedValue({...}),
    attestByDelegation: vi.fn().mockResolvedValue({...}),
  })
  return { mockContractFactory: createContract }
})

vi.mock('ethers', async () => {
  const actual = await vi.importActual('ethers')
  return {
    ...actual,
    Contract: vi.fn().mockImplementation(mockContractFactory),
  }
})
```

#### Option B: Remove `vi.resetModules()` from `beforeEach`
```typescript
beforeEach(() => {
  // Remove vi.resetModules() - it breaks mocks
  vi.clearAllMocks()
  // Re-apply mocks if needed
  MockContract.mockImplementation(createMockContract)
})
```

#### Option C: Create Shared Mock Instances
```typescript
// Create shared mock methods that persist across tests
const sharedMockGetNonce = vi.fn().mockResolvedValue(BigInt(0))
const sharedMockAttestByDelegation = vi.fn().mockResolvedValue({...})

const createMockContract = () => ({
  getNonce: sharedMockGetNonce,
  attestByDelegation: sharedMockAttestByDelegation,
  // ...
})
```

### 3. Generate Test Coverage Report

```bash
npm run test:coverage -- tests/lib/eas-delegated.test.ts tests/app/api/eas/delegated-attest.test.ts
```

**Target**: >80% coverage for delegated attestation code paths

**Review**:
- Identify uncovered lines
- Add tests for missing branches
- Document why certain paths can't be tested

### 4. Update Test Documentation

**Files to Review**:
- `TEST_ENGINEER_DELEGATED_ATTESTATION.md` - Original specifications
- `tests/DELEGATED_ATTESTATION_TEST_STATUS.md` - Current status
- `tests/MOCKING_ISSUES.md` - Known issues

**Actions**:
- Mark completed items in original spec
- Update status for remaining work
- Add notes about test limitations

## Medium-Term Improvements

### 5. Add Integration Tests

Create `tests/integration/eas-delegated-attest.test.ts`:
- End-to-end flow tests
- Real signature generation (if testnet available)
- Idempotency with actual cache
- Error recovery scenarios

### 6. Improve Test Maintainability

**Actions**:
- Extract common test patterns into helpers
- Create test fixtures for complex scenarios
- Add test data builders for different edge cases
- Document test organization patterns

### 7. Add Performance Tests

**Consider**:
- Response time benchmarks
- Concurrent request handling
- Cache performance
- Memory usage under load

## Long-Term Enhancements

### 8. Test Automation

**CI/CD Integration**:
- Run tests on every PR
- Block merges if tests fail
- Generate coverage reports automatically
- Track test metrics over time

### 9. Test Data Management

**Create**:
- Test data fixtures
- Schema test data
- Signature test vectors
- Error scenario catalog

### 10. Documentation

**Create**:
- Test execution guide
- Mocking strategy guide
- Troubleshooting guide
- Test contribution guide

## Priority Order

1. **Fix Contract Mocking** (Blocks 5 tests)
2. **Verify Coverage** (Ensure >80%)
3. **Update Documentation** (Mark completed work)
4. **Add Integration Tests** (End-to-end validation)
5. **Improve Maintainability** (Long-term health)

## Success Criteria

- [ ] All 52 tests passing (27 utilities + 25 API)
- [ ] Test coverage >80% for delegated attestation code
- [ ] All edge cases from spec covered
- [ ] Documentation updated and accurate
- [ ] Tests run reliably in CI/CD

## Resources

- **Test Files**: `tests/lib/eas-delegated.test.ts`, `tests/app/api/eas/delegated-attest.test.ts`
- **Helpers**: `tests/helpers/delegated-attestation.ts`
- **Documentation**: `tests/DELEGATED_ATTESTATION_TEST_STATUS.md`
- **Issues**: `tests/MOCKING_ISSUES.md`

## Questions to Resolve

1. Should we use `vi.hoisted()` for Contract mocks?
2. Can we remove `vi.resetModules()` from beforeEach?
3. Do we need integration tests with real blockchain?
4. What's the target test coverage percentage?
5. Should failing tests be skipped or fixed?

## Recommended Next Action

**Immediate**: Fix Contract mocking using Option A (vi.hoisted()) or Option B (remove resetModules)

**Command to test fix**:
```bash
npm test -- tests/app/api/eas/delegated-attest.test.ts --run
```

**Expected Result**: All 25 API route tests passing
