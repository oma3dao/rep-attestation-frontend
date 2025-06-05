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

/**
 * Escape string for JavaScript code generation
 */
function escapeString(str) {
  if (typeof str !== 'string') return str
  return str
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/'/g, "\\'")    // Escape single quotes
    .replace(/"/g, '\\"')    // Escape double quotes
    .replace(/\n/g, '\\n')   // Escape newlines
    .replace(/\r/g, '\\r')   // Escape carriage returns
    .replace(/\t/g, '\\t')   // Escape tabs
}

/**
 * Transform JSON Schema to UI Schema
 */
function transformToUISchema(jsonSchema, schemaId) {
  // Require title - it's essential for UI
  if (!jsonSchema.title) {
    throw new Error(`Schema '${schemaId}' is missing required 'title' property. Schema titles are used in form headings and must be provided.`)
  }

  // Require description - it's essential for UI
  if (!jsonSchema.description) {
    throw new Error(`Schema '${schemaId}' is missing required 'description' property. Schema descriptions are used in form instructions and must be provided.`)
  }

  return {
    id: schemaId,
    title: jsonSchema.title,
    description: jsonSchema.description,
    fields: transformFields(jsonSchema.properties || {}, jsonSchema.required || [], schemaId)
  }
}

/**
 * Transform JSON Schema properties to FormField format
 */
function transformFields(properties, required = [], schemaId = '') {
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
      // Require title for form fields - it's essential for UI labels
      if (!prop.title) {
        throw new Error(`Field '${name}' in schema '${schemaId}' is missing required 'title' property. Field titles are used as form labels and must be provided.`)
      }

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
        label: prop.title,
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
  return `Enter ${name.toLowerCase()}`
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
async function readDeploymentData(rootPath) {
  const deploymentPath = path.join(rootPath, 'generated')
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
        continue // Skip non-deployment files
      }
      
      try {
        const filePath = path.join(deploymentPath, file)
        const content = await fs.readFile(filePath, 'utf8')
        const deploymentData = JSON.parse(content)
        
        // Convert PascalCase filename to kebab-case to match schema IDs
        // e.g., "Certification" -> "certification", "Linked-Identifier" -> "linked-identifier"
        const normalizedSchemaId = schemaId
          .replace(/([A-Z])/g, (match, letter, index) => {
            // Insert hyphen before uppercase letters (except first character)
            // But don't add hyphen if there's already a hyphen before it
            if (index > 0 && schemaId[index - 1] !== '-') {
              return '-' + letter.toLowerCase()
            }
            return letter.toLowerCase()
          })
        
        // Initialize schema deployments if not exists
        if (!deployments[normalizedSchemaId]) {
          deployments[normalizedSchemaId] = {}
        }
        
        deployments[normalizedSchemaId][chainId] = {
          schemaUID: deploymentData.uid, // Property is 'uid' not 'schemaUID'
          blockNumber: deploymentData.blockNumber,
          chainName
        }
        
        console.log(`   ✅ ${schemaId} -> ${normalizedSchemaId} (${chainName}): ${deploymentData.uid}`)
      } catch (fileError) {
        console.warn(`   ⚠️  Failed to read ${file}:`, fileError.message)
      }
    }
  } catch (error) {
    console.warn(`⚠️  Could not read deployment directory: ${error.message}`)
    console.log(`   This is okay - will use placeholder values`)
  }
  
  return deployments
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
    // Convert kebab-case to camelCase for variable names
    const camelCaseId = schema.id.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase())
    const fieldsVarName = `${camelCaseId}Fields`
    const fieldsCode = `const ${fieldsVarName}: FormField[] = ${JSON.stringify(schema.fields, null, 2)}`
    return { schema, fieldsVarName, fieldsCode }
  })

  // Generate TypeScript export for each schema
  const schemaExports = fieldArrays.map(item => {
    const deployment = deployments[item.schema.id]
    const testnetData = deployment?.[97]
    const mainnetData = deployment?.[56]
    
    const testnetUID = testnetData ? testnetData.schemaUID : '0x0000000000000000000000000000000000000000000000000000000000000000'
    const testnetBlock = testnetData ? testnetData.blockNumber : 0
    const mainnetUID = mainnetData ? mainnetData.schemaUID : '0x0000000000000000000000000000000000000000000000000000000000000000'
    const mainnetBlock = mainnetData ? mainnetData.blockNumber : 0

    // Convert kebab-case to camelCase for variable names
    const varName = item.schema.id.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase())

    const schemaExport = [
      `export const ${varName}Schema: AttestationSchema = {`,
      `  id: '${escapeString(item.schema.id)}',`,
      `  title: '${escapeString(item.schema.title)}',`,
      `  description: '${escapeString(item.schema.description)}',`,
      `  fields: ${item.fieldsVarName},`,
      `  deployedUIDs: {`,
      `    97: '${escapeString(testnetUID)}', // BSC Testnet`,
      `    56: '${escapeString(mainnetUID)}'  // BSC Mainnet`,
      `  },`,
      `  deployedBlocks: {`,
      `    97: ${testnetBlock}, // BSC Testnet`,
      `    56: ${mainnetBlock}  // BSC Mainnet`,
      `  }`,
      `};`
    ].join('\n')
    
    return {
      varName,
      export: schemaExport
    }
  })

  const fileContent = `// This file is auto-generated by scripts/update-schemas.js
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
  fields: FormField[]
  deployedUIDs?: Record<number, string> // chainId -> schemaUID mapping
  deployedBlocks?: Record<number, number> // chainId -> deployment block number
}

// Field definitions
${fieldArrays.map(item => item.fieldsCode).join('\n\n')}

// Schema definitions
${schemaExports.map(item => item.export).join('\n\n')}

// Export all schemas
const allSchemas: AttestationSchema[] = [
  ${schemaExports.map(item => `${item.varName}Schema`).join(',\n  ')}
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
  await fs.writeFile(outputPath, fileContent, 'utf8')
  console.log(`✅ Generated schema file: ${outputPath}`)
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length !== 1) {
    console.error('❌ Error: Please provide the root path to the tools project')
    console.error('Usage: node scripts/update-schemas.js /path/to/rep-attestation-tools-evm-solidity')
    process.exit(1)
  }

  const rootPath = path.resolve(args[0])
  const schemasPath = path.join(rootPath, 'schemas-json')

  try {
    console.log(`🚀 Starting schema update from tools project: ${rootPath}`)
    console.log(`📁 Reading schemas from: ${schemasPath}`)
    
    const schemas = await readSchemasFromDirectory(schemasPath)
    
    if (Object.keys(schemas).length === 0) {
      console.warn('⚠️  No schemas found to process')
      return
    }
    
    const deployments = await readDeploymentData(rootPath)
    
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
    console.error(`❌ Schema update failed: ${error.message}`)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
} 