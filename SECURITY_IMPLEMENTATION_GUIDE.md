# Security Implementation Guide

## Immediate Action Items

### 1. Input Validation Implementation

#### A. Add Validation to Attestation Data
```typescript
// src/lib/validation.ts
export function validateAttestationData(data: Record<string, any>): Record<string, any> {
  const validated: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(data)) {
    // Prevent prototype pollution
    if (key.includes('__proto__') || key.includes('constructor') || key.includes('prototype')) {
      throw new Error(`Invalid field name: ${key}`)
    }
    
    // Sanitize values based on type
    validated[key] = sanitizeValue(value)
  }
  
  return validated
}

function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    // Remove potentially dangerous characters
    return value.replace(/[<>\"'&]/g, '')
  }
  
  if (typeof value === 'object' && value !== null) {
    // Recursively sanitize nested objects
    return validateAttestationData(value)
  }
  
  return value
}
```

#### B. Update BAS Client to Use Validation
```typescript
// src/lib/bas.ts - Update the createAttestation function
import { validateAttestationData } from './validation'

// In the createAttestation function, add validation:
const createAttestation = async (data: AttestationData): Promise<AttestationResult> => {
  // ... existing checks ...
  
  // Validate and sanitize input data
  const validatedData = validateAttestationData(data.data)
  
  // Use validated data for encoding
  const basData = convertToBASData(schema, validatedData)
  
  // ... rest of the function ...
}
```

### 2. Add Security Monitoring

#### A. Create Security Monitoring Hook
```typescript
// src/lib/security-monitoring.ts
export function useSecurityMonitoring() {
  const logSecurityEvent = (event: string, data?: any) => {
    console.warn(`[SECURITY] ${event}`, data)
    // TODO: Send to monitoring service (e.g., Sentry, LogRocket)
  }
  
  const validateUserInput = (input: any, context: string) => {
    try {
      // Basic validation
      if (typeof input === 'object' && input !== null) {
        for (const key in input) {
          if (key.includes('__proto__') || key.includes('constructor')) {
            logSecurityEvent('Potential prototype pollution attempt', { context, input })
            throw new Error('Invalid input detected')
          }
        }
      }
      return true
    } catch (error) {
      logSecurityEvent('Input validation failed', { context, error, input })
      throw error
    }
  }
  
  return { logSecurityEvent, validateUserInput }
}
```

#### B. Integrate with Attestation Form
```typescript
// src/components/AttestationForm.tsx - Add security monitoring
import { useSecurityMonitoring } from '@/lib/security-monitoring'

export function AttestationForm({ schema, validateForm }: AttestationFormProps) {
  const { validateUserInput, logSecurityEvent } = useSecurityMonitoring()
  
  const handleFieldChange = (fieldName: string, value: string | string[]) => {
    try {
      // Validate input before processing
      validateUserInput(value, `field:${fieldName}`)
      
      setFormData(prev => ({
        ...prev,
        [fieldName]: value
      }))
      
      // Clear errors...
    } catch (error) {
      logSecurityEvent('Invalid field input', { fieldName, value, error })
      setErrors(prev => ({
        ...prev,
        [fieldName]: 'Invalid input detected'
      }))
    }
  }
  
  // ... rest of component
}
```

### 3. Add CI/CD Security Checks

#### A. Create Security Check Script
```javascript
// scripts/security-check.js
const { execSync } = require('child_process')
const fs = require('fs')

function runSecurityChecks() {
  console.log('🔒 Running security checks...')
  
  try {
    // Run npm audit
    const auditResult = execSync('npm audit --audit-level=high', { encoding: 'utf8' })
    console.log('✅ npm audit completed')
    
    // Check for known vulnerable patterns in code
    const sourceFiles = execSync('find src -name "*.ts" -o -name "*.tsx"', { encoding: 'utf8' })
    const files = sourceFiles.split('\n').filter(f => f)
    
    let vulnerabilitiesFound = false
    
    for (const file of files) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8')
        
        // Check for dangerous patterns
        const dangerousPatterns = [
          /eval\s*\(/,
          /Function\s*\(/,
          /__proto__/,
          /constructor\s*\.\s*prototype/
        ]
        
        for (const pattern of dangerousPatterns) {
          if (pattern.test(content)) {
            console.warn(`⚠️  Potential security issue in ${file}`)
            vulnerabilitiesFound = true
          }
        }
      }
    }
    
    if (vulnerabilitiesFound) {
      console.error('❌ Security vulnerabilities found in code')
      process.exit(1)
    } else {
      console.log('✅ No obvious security vulnerabilities in code')
    }
    
  } catch (error) {
    console.error('❌ Security check failed:', error.message)
    process.exit(1)
  }
}

runSecurityChecks()
```

#### B. Update package.json Scripts
```json
{
  "scripts": {
    "security-check": "node scripts/security-check.js",
    "prebuild": "npm run security-check",
    "predeploy": "npm run security-check"
  }
}
```

### 4. Environment-Specific Security

#### A. Production Security Config
```typescript
// src/config/security.ts
export const SECURITY_CONFIG = {
  // Enable additional security in production
  enableStrictValidation: process.env.NODE_ENV === 'production',
  
  // Log security events in production
  enableSecurityLogging: process.env.NODE_ENV === 'production',
  
  // Rate limiting for attestation creation
  maxAttestationsPerHour: process.env.NODE_ENV === 'production' ? 10 : 100,
  
  // Allowed domains for attestation recipients
  allowedDomains: process.env.ALLOWED_DOMAINS?.split(',') || [],
  
  // Security headers
  securityHeaders: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }
}
```

#### B. Add Security Headers
```typescript
// next.config.ts - Add security headers
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}
```

### 5. Monitoring and Alerting Setup

#### A. Create Security Dashboard
```typescript
// src/components/SecurityDashboard.tsx (Admin only)
export function SecurityDashboard() {
  const [securityEvents, setSecurityEvents] = useState([])
  const [vulnerabilityStatus, setVulnerabilityStatus] = useState({})
  
  useEffect(() => {
    // Fetch security events and vulnerability status
    // This would connect to your monitoring service
  }, [])
  
  return (
    <div className="security-dashboard">
      <h2>Security Status</h2>
      
      <div className="vulnerability-status">
        <h3>NPM Audit Status</h3>
        <div className="status-item">
          <span>High Severity:</span>
          <span className="status-high">2 vulnerabilities</span>
        </div>
        <div className="status-item">
          <span>Last Check:</span>
          <span>{new Date().toLocaleDateString()}</span>
        </div>
      </div>
      
      <div className="security-events">
        <h3>Recent Security Events</h3>
        {securityEvents.map(event => (
          <div key={event.id} className="event-item">
            <span>{event.timestamp}</span>
            <span>{event.type}</span>
            <span>{event.severity}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Testing Security Measures

### 1. Security Test Cases
```typescript
// tests/security.test.ts
import { validateAttestationData } from '../src/lib/validation'

describe('Security Validation', () => {
  test('should reject prototype pollution attempts', () => {
    const maliciousData = {
      '__proto__.polluted': 'true',
      'normal': 'value'
    }
    
    expect(() => {
      validateAttestationData(maliciousData)
    }).toThrow('Invalid field name')
  })
  
  test('should sanitize dangerous characters', () => {
    const dataWithDangerousChars = {
      'field': '<script>alert("xss")</script>'
    }
    
    const result = validateAttestationData(dataWithDangerousChars)
    expect(result.field).not.toContain('<script>')
  })
  
  test('should handle nested objects safely', () => {
    const nestedData = {
      'user': {
        'name': 'John',
        '__proto__.polluted': 'true'
      }
    }
    
    expect(() => {
      validateAttestationData(nestedData)
    }).toThrow('Invalid field name')
  })
})
```

### 2. Integration Tests
```typescript
// tests/integration/security.test.ts
import { render, fireEvent } from '@testing-library/react'
import { AttestationForm } from '../../src/components/AttestationForm'

describe('AttestationForm Security', () => {
  test('should handle malicious input gracefully', () => {
    const schema = { /* test schema */ }
    const { getByLabelText } = render(<AttestationForm schema={schema} />)
    
    const input = getByLabelText('Name')
    fireEvent.change(input, {
      target: { value: '<script>alert("xss")</script>' }
    })
    
    // Should sanitize or reject the input
    expect(input.value).not.toContain('<script>')
  })
})
```

## Deployment Checklist

### Pre-Deployment
- [ ] Run `npm run security-check`
- [ ] Verify all security headers are configured
- [ ] Test input validation with malicious data
- [ ] Review recent security events

### Post-Deployment
- [ ] Monitor security logs for first 24 hours
- [ ] Verify security headers are active
- [ ] Test attestation flows with validation
- [ ] Document any security incidents

## Emergency Procedures

### If Vulnerability is Exploited
1. **Immediate Actions:**
   - Disable affected functionality
   - Review logs for suspicious activity
   - Notify security team

2. **Investigation:**
   - Identify attack vector
   - Assess data compromise
   - Document incident

3. **Recovery:**
   - Implement additional validation
   - Update security measures
   - Communicate to stakeholders

### Contact Information
- **Security Lead:** [Add contact]
- **DevOps Emergency:** [Add contact]
- **Legal/Compliance:** [Add contact]

---

**Last Updated:** [Current Date]  
**Next Review:** [Date + 1 week] 

## Known Vulnerabilities and Mitigation

For full transparency, any unfixable vulnerabilities due to upstream dependencies are documented in [SECURITY_VULNERABILITIES.md](./SECURITY_VULNERABILITIES.md). These are monitored regularly, and the team will update dependencies as soon as upstream fixes are available.

- All critical and high vulnerabilities are tracked and reviewed.
- Risk is mitigated by ensuring no direct usage of affected packages in application code.
- See the vulnerabilities file for details, paths, and mitigation steps. 