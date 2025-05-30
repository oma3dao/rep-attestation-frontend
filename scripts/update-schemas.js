#!/usr/bin/env node

/**
 * Schema Update Script
 * 
 * Reads JSON schema files from a folder and updates src/config/schemas.ts
 * 
 * Usage:
 *   node scripts/update-schemas.js /path/to/schemas/folder
 *   npm run update-schemas /path/to/schemas/folder
 */

const fs = require('fs').promises
const path = require('path')

// UI-specific metadata (stays in frontend)
const UI_METADATA = {
  certification: {
    icon: '🏆',
    color: 'bg-blue-500',
    title: 'Product Certification',
    description: 'Certify compliance with standards and regulations'
  },
  endorsement: {
    icon: '👍',
    color: 'bg-green-500', 
    title: 'Professional Endorsement',
    description: 'Endorse skills, qualifications, or achievements'
  },
  'linked-identifier': {
    icon: '🔗',
    color: 'bg-purple-500',
    title: 'Identity Verification', 
    description: 'Link and verify digital identities'
  },
  'user-review': {
    icon: '⭐',
    color: 'bg-yellow-500',
    title: 'User Review',
    description: 'Share experiences and feedback'
  }
}

/**
 * Transform JSON Schema to UI Schema
 */
function transformToUISchema(jsonSchema, schemaId) {
  const uiMeta = UI_METADATA[schemaId] || {
    icon: '📄',
    color: 'bg-gray-500',
    title: jsonSchema.title || formatLabel(schemaId),
    description: jsonSchema.description || 'No description available'
  }

  return {
    id: schemaId,
    title: uiMeta.title,
    description: uiMeta.description,
    icon: uiMeta.icon,
    color: uiMeta.color,
    fields: transformFields(jsonSchema.properties || {}, jsonSchema.required || [])
  }
}

/**
 * Transform JSON Schema properties to FormField format
 */
function transformFields(properties, required = []) {
  return Object.entries(properties)
    .filter(([name, prop]) => {
      // Skip fields marked with x-oma3-skip-reason
      if (prop['x-oma3-skip-reason']) {
        console.log(`Skipping field '${name}' - reason: ${prop['x-oma3-skip-reason']}`)
        return false
      }
      return true
    })
    .map(([name, prop]) => {
      // Map JSON Schema types to UI field types
      const typeMapping = {
        'string': prop.format === 'uri' ? 'uri' : 
                  prop.format === 'date-time' ? 'datetime' : 'string',
        'integer': 'integer',
        'number': 'integer',
        'array': 'array',
        'boolean': 'enum' // Convert boolean to enum with Yes/No options
      }

      const field = {
        name,
        type: typeMapping[prop.type] || 'string',
        label: prop.title || formatLabel(name),
        description: prop.description,
        required: required.includes(name),
        placeholder: prop.examples?.[0] || generatePlaceholder(name, prop)
      }

      // Add type-specific properties
      if (prop.enum) {
        field.type = 'enum'
        field.options = prop.enum
      }

      if (prop.type === 'boolean') {
        field.type = 'enum'
        field.options = ['Yes', 'No']
      }

      if (prop.type === 'integer' || prop.type === 'number') {
        if (prop.minimum !== undefined) field.min = prop.minimum
        if (prop.maximum !== undefined) field.max = prop.maximum
      }

      if (prop.format) {
        field.format = prop.format
      }

      return field
    })
}

/**
 * Format field name to readable label
 */
function formatLabel(name) {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/\b\w/g, str => str.toUpperCase())
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
}

/**
 * Generate placeholder text based on field name and properties
 */
function generatePlaceholder(name, prop) {
  if (name.includes('did') || name.includes('DID')) {
    return 'did:example:123...'
  }
  if (prop.format === 'uri') {
    return 'https://example.com'
  }
  if (prop.format === 'date-time') {
    return '2024-01-01T00:00:00Z'
  }
  if (prop.type === 'integer') {
    return '0'
  }
  return `Enter ${formatLabel(name).toLowerCase()}`
}

/**
 * Read schemas from directory
 */
async function readSchemasFromDirectory(directoryPath) {
  try {
    console.log(`📁 Reading schemas from: ${directoryPath}`)
    
    const fullPath = path.resolve(directoryPath)
    const files = await fs.readdir(fullPath)
    const schemas = {}
    
    for (const file of files) {
      // Skip test-deploy.schema.json and non-JSON files
      if (file === 'test-deploy.schema.json' || !file.endsWith('.json')) {
        console.log(`⏭️  Skipping: ${file}`)
        continue
      }

      try {
        const filePath = path.join(fullPath, file)
        const content = await fs.readFile(filePath, 'utf8')
        const schema = JSON.parse(content)
        
        // Extract schema ID from filename (remove .schema.json or .json)
        const schemaId = file.replace(/\.schema\.json$/, '').replace(/\.json$/, '')
        schemas[schemaId] = schema
        
        console.log(`✅ Loaded: ${file} → ${schemaId}`)
      } catch (error) {
        console.error(`❌ Failed to load ${file}:`, error.message)
      }
    }
    
    return schemas
  } catch (error) {
    console.error('❌ Failed to read directory:', error.message)
    throw error
  }
}

/**
 * Read deployment data from the tools project
 */
async function readDeploymentData() {
  const deploymentPath = path.resolve('../rep-attestation-tools-evm-solidity/generated')
  const deployments = {}
  
  try {
    console.log(`📡 Reading deployment data from: ${deploymentPath}`)
    const files = await fs.readdir(deploymentPath)
    
    for (const file of files) {
      let schemaId, chainId, chainName
      
      if (file.endsWith('.deployed.bastest.json')) {
        schemaId = file.replace('.deployed.bastest.json', '')
        chainId = 97
        chainName = 'BSC Testnet'
      } else if (file.endsWith('.deployed.bas.json')) {
        schemaId = file.replace('.deployed.bas.json', '')
        chainId = 56
        chainName = 'BSC Mainnet'
      } else {
        continue
      }
      
      try {
        const filePath = path.join(deploymentPath, file)
        const content = await fs.readFile(filePath, 'utf8')
        const deploymentData = JSON.parse(content)
        
        if (!deployments[schemaId]) {
          deployments[schemaId] = {}
        }
        
        deployments[schemaId][chainId] = {
          schemaUID: deploymentData.schemaUID,
          blockNumber: deploymentData.blockNumber,
          chainId
        }
        
        console.log(`📋 Loaded deployment: ${file} → ${schemaId} (${chainName})`)
      } catch (error) {
        console.error(`❌ Failed to load deployment ${file}:`, error.message)
      }
    }
    
    return deployments
  } catch (error) {
    console.warn(`⚠️  Could not read deployment data: ${error.message}`)
    return {}
  }
}

/**
 * Generate the schemas.ts file
 */
async function generateSchemasFile(schemas, deployments = {}) {
  const uiSchemas = Object.entries(schemas).map(([id, schema]) => 
    transformToUISchema(schema, id)
  )

  // Generate field arrays for each schema
  const fieldArrays = uiSchemas.map(schema => {
    const fieldsVarName = `${schema.id}Fields`
    const fieldsCode = `const ${fieldsVarName}: FormField[] = ${JSON.stringify(schema.fields, null, 2)}`
    return { schema, fieldsVarName, fieldsCode }
  })

  const content = `// This file is auto-generated by scripts/update-schemas.js
// Do not edit manually - your changes will be overwritten

// Schema definitions for attestation forms
export type FieldType = 'string' | 'integer' | 'array' | 'enum' | 'datetime' | 'uri'

export interface FormField {
  name: string
  type: FieldType
  label: string
  description?: string
  required: boolean
  placeholder?: string
  options?: string[] // for enum fields
  format?: string // for validation (uri, date-time, etc.)
  min?: number // for integer fields
  max?: number // for integer fields
}

export interface AttestationSchema {
  id: string
  title: string
  description: string
  icon: string
  color: string
  fields: FormField[]
  deployedUIDs?: Record<number, string> // chainId -> schemaUID mapping
  deployedBlocks?: Record<number, number> // chainId -> deployment block number
}

// Field definitions
${fieldArrays.map(item => item.fieldsCode).join('\n\n')}

// Schema definitions
${fieldArrays.map(item => {
  const schemaDeployments = deployments[item.schema.id] || {}
  
  // BSC Testnet (97)
  const testnetDeployment = schemaDeployments[97]
  const testnetUID = testnetDeployment ? testnetDeployment.schemaUID : '0x0000000000000000000000000000000000000000000000000000000000000000'
  const testnetBlock = testnetDeployment ? testnetDeployment.blockNumber : 0
  
  // BSC Mainnet (56)  
  const mainnetDeployment = schemaDeployments[56]
  const mainnetUID = mainnetDeployment ? mainnetDeployment.schemaUID : '0x0000000000000000000000000000000000000000000000000000000000000000'
  const mainnetBlock = mainnetDeployment ? mainnetDeployment.blockNumber : 0

  const schemaExport = `export const ${item.schema.id}Schema: AttestationSchema = {
    id: '${item.schema.id}',
    title: '${item.schema.title}',
    description: '${item.schema.description}',
    icon: '${item.schema.icon}',
    color: '${item.schema.color}',
    fields: ${item.fieldsVarName},
    deployedUIDs: {
      97: '${testnetUID}', // BSC Testnet
      56: '${mainnetUID}'  // BSC Mainnet
    },
    deployedBlocks: {
      97: ${testnetBlock}, // BSC Testnet
      56: ${mainnetBlock}  // BSC Mainnet
    }
  }`
  return schemaExport
}).join('\n')}

// Export all schemas
const allSchemas: AttestationSchema[] = [
${fieldArrays.map(item => `  ${item.schema.id}Schema`).join(',\n')}
]

export function getSchema(id: string): AttestationSchema | undefined {
  return allSchemas.find(schema => schema.id === id)
}

export function getSchemaIds(): string[] {
  return allSchemas.map(schema => schema.id)
}

export function getAllSchemas(): AttestationSchema[] {
  return allSchemas
}
`

  const outputPath = path.resolve('src/config/schemas.ts')
  await fs.writeFile(outputPath, content, 'utf8')
  console.log(`✅ Generated schema file: ${outputPath}`)
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.error('❌ Error: Please provide a directory path')
    console.error('Usage: node scripts/update-schemas.js /path/to/schemas')
    process.exit(1)
  }
  
  const directoryPath = args[0]
  
  try {
    console.log(`🚀 Starting schema update from: ${directoryPath}`)
    
    const schemas = await readSchemasFromDirectory(directoryPath)
    
    if (Object.keys(schemas).length === 0) {
      console.warn('⚠️  No schemas found to process')
      return
    }
    
    const deployments = await readDeploymentData()
    
    await generateSchemasFile(schemas, deployments)
    
    console.log(`✅ Schema update completed successfully!`)
    console.log(`📊 Processed ${Object.keys(schemas).length} schemas:`)
    Object.keys(schemas).forEach(id => console.log(`   - ${id}`))
    
    if (Object.keys(deployments).length > 0) {
      console.log(`🚀 Loaded deployments:`)
      Object.entries(deployments).forEach(([schemaId, chains]) => {
        console.log(`   - ${schemaId}:`)
        Object.entries(chains).forEach(([chainId, deployment]) => {
          const chainName = chainId === '97' ? 'BSC Testnet' : 'BSC Mainnet'
          console.log(`     ${chainName}: ${deployment.schemaUID} (block ${deployment.blockNumber})`)
        })
      })
    }
    
  } catch (error) {
    console.error('❌ Schema update failed:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
} 