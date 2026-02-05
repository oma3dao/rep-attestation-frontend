# Test Engineering vs Development Responsibilities

## Contract Mocking Issue - Who Fixes It?

### 🧪 Test Engineer Responsibility

**The Contract mocking issue is a TEST ENGINEER responsibility** because:

1. **It's test infrastructure** - The mock setup is part of the test code, not production code
2. **Tests are correctly written** - The test logic is sound; only the mock configuration needs fixing
3. **No code changes needed** - The implementation doesn't need to change
4. **Standard test engineering task** - Setting up mocks is a core test engineering skill

### What Test Engineers Should Fix

✅ **Mock Configuration**
- Setting up `vi.mock()` correctly
- Ensuring mocks return proper methods
- Handling `vi.resetModules()` correctly
- Using `vi.hoisted()` if needed

✅ **Test Infrastructure**
- Mock factories and helpers
- Test setup/teardown
- Mock lifecycle management
- Test data preparation

✅ **Test Assertions**
- Making assertions flexible
- Handling implementation variations
- Verifying mock calls correctly

### What Developers Might Need to Help With

⚠️ **Only if implementation makes mocking impossible**:

- If code uses tight coupling that prevents mocking
- If dependency injection is needed for testability
- If the code structure makes it impossible to mock

**In this case**: The implementation is fine - it's just a mock setup issue.

## Recommended Approach

### For Test Engineers

1. **Try these fixes first** (test engineering solutions):
   ```typescript
   // Option 1: Use vi.hoisted() for stable mocks
   const { mockContract } = vi.hoisted(() => {
     return {
       mockContract: vi.fn().mockImplementation(() => ({
         getNonce: vi.fn().mockResolvedValue(BigInt(0)),
         // ...
       }))
     }
   })
   
   // Option 2: Remove vi.resetModules() if it breaks mocks
   beforeEach(() => {
     // vi.resetModules() // Remove this
     vi.clearAllMocks()
   })
   
   // Option 3: Create shared mock instances
   const sharedMocks = {
     getNonce: vi.fn().mockResolvedValue(BigInt(0)),
     // ...
   }
   ```

2. **Document what you tried** - If you can't fix it, document:
   - What you tried
   - Why it didn't work
   - What would need to change in implementation

3. **Escalate only if**:
   - Implementation structure prevents mocking
   - Code needs refactoring for testability
   - Dependency injection is required

### For Developers

**You should only be involved if**:
- Test engineer has tried all mock solutions
- Code structure needs refactoring for testability
- Dependency injection or abstraction is needed
- Implementation changes are required

**You should NOT need to**:
- Fix mock configuration
- Set up test infrastructure
- Write test mocks
- Debug test setup issues

## Current Situation

### Status: Test Engineer Task ✅

The Contract mocking issue is:
- ✅ A test infrastructure problem
- ✅ Solvable with mock configuration
- ✅ No code changes needed
- ✅ Standard test engineering work

### What's Needed

**Test Engineer should**:
1. Try `vi.hoisted()` approach
2. Verify mock implementation is correct
3. Check if `vi.resetModules()` is the issue
4. Ensure mocks are applied before imports

**Developer involvement**: Not needed unless test engineer determines code refactoring is required.

## Best Practices

### Test Engineers Should
- Own test infrastructure
- Fix mocking issues
- Set up test utilities
- Document test limitations
- Escalate only when code changes needed

### Developers Should
- Write testable code
- Provide dependency injection when needed
- Help understand implementation details
- Review test coverage gaps
- Refactor if testability is impossible

## Conclusion

**The Contract mocking fix is a TEST ENGINEER responsibility.**

The test engineer should:
1. Try the solutions in `tests/MOCKING_ISSUES.md`
2. Experiment with different mock strategies
3. Document what works
4. Only escalate if implementation changes are needed

**Estimated time**: 30-60 minutes for a test engineer familiar with Vitest mocking.
