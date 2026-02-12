#!/usr/bin/env node
// @ts-nocheck - Build script with dynamic JSON processing

/**
 * Schema Update Script
 * 
 * Reads JSON schema files from a folder and updates src/config/schemas.ts
 * 
 * Usage:
 *   npx esno scripts/update-schemas.ts /path/to/schemas/folder
 *   npm run update-schemas /path/to/schemas/folder
 */

import { promises as fs } from 'fs'
import path from 'path'
import { CHAIN_IDS, DEPLOYMENT_FILE_MAPPINGS, getChainName } from '../src/config/chains'

// Zero UID constant
const ZERO_UID = '0x0000000000000000000000000000000000000000000000000000000000000000'

// Cache for loaded external schemas
let externalSchemaCache: Record<string, any> = {}
let schemasDirectory: string = ''

/**
 * Load an external schema file (e.g., common.schema.json)
 */
async function loadExternalSchema(schemaFile: string): Promise<any> {
  if (externalSchemaCache[schemaFile]) {
    return externalSchemaCache[schemaFile]
  }

  const schemaPath = path.join(schemasDirectory, schemaFile)
  try {
    const content = await fs.readFile(schemaPath, 'utf8')
    const schema = JSON.parse(content)
    externalSchemaCache[schemaFile] = schema
    return schema
  } catch (error) {
    console.warn(`⚠️  Could not load external schema ${schemaFile}: ${error.message}`)
    return null
  }
}

/**
 * Resolve a $ref reference to get the referenced definition
 * Supports refs like "common.schema.json#/$defs/Version"
 */
async function resolveRef(ref: string): Promise<any> {
  const [schemaFile, pointer] = ref.split('#')
  
  if (!schemaFile || !pointer) {
    console.warn(`⚠️  Invalid $ref format: ${ref}`)
    return null
  }

  const schema = await loadExternalSchema(schemaFile)
  if (!schema) return null

  // Parse JSON pointer (e.g., "/$defs/Version" -> ["$defs", "Version"])
  const parts = pointer.split('/').filter(p => p)
  let result = schema
  
  for (const part of parts) {
    if (result && typeof result === 'object' && part in result) {
      result = result[part]
    } else {
      console.warn(`⚠️  Could not resolve path ${pointer} in ${schemaFile}`)
      return null
    }
  }

  return result
}

/**
 * Resolve a property that may contain a $ref, merging with local overrides
 * Local properties take precedence over referenced properties
 */
async function resolveProperty(prop: any): Promise<any> {
  if (!prop || typeof prop !== 'object') return prop
  
  // If no $ref, return as-is
  if (!prop['$ref']) return prop

  // Resolve the reference
  const refDef = await resolveRef(prop['$ref'])
  if (!refDef) return prop

  // Merge: start with referenced definition, override with local properties
  const { '$ref': _ref, ...localProps } = prop
  return { ...refDef, ...localProps }
}

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
 * Detect if schema should be revocable based on presence of 'revoked' field
 * with x-oma3-skip-reason: "eas" (meaning EAS handles revocation natively)
 * 
 * When a schema has revoked field with x-oma3-skip-reason: "eas", it means:
 * 1. The schema is deployed as revocable on EAS
 * 2. ALL attestations using this schema MUST be revocable
 * 3. Clients should ignore non-revocable attestations on revocable schemas
 */
function detectRevocable(properties: Record<string, any> | undefined): boolean {
  if (!properties) return false
  
  const revokedField = properties['revoked']
  if (revokedField && revokedField['x-oma3-skip-reason'] === 'eas') {
    return true
  }
  return false
}

/**
 * Transform JSON Schema to UI Schema
 */
async function transformToUISchema(jsonSchema, schemaId) {
  // Require title - it's essential for UI
  if (!jsonSchema.title) {
    throw new Error(`Schema '${schemaId}' is missing required 'title' property. Schema titles are used in form headings and must be provided.`)
  }

  // Require description - it's essential for UI
  if (!jsonSchema.description) {
    throw new Error(`Schema '${schemaId}' is missing required 'description' property. Schema descriptions are used in form instructions and must be provided.`)
  }

  // Detect if schema should be revocable (has 'revoked' field with x-oma3-skip-reason: "eas")
  const revocable = detectRevocable(jsonSchema.properties)

  // Extract witness configuration if present
  const witness = jsonSchema['x-oma3-witness'] || undefined

  return {
    id: schemaId,
    title: jsonSchema.title,
    description: jsonSchema.description,
    fields: await transformFields(jsonSchema.properties || {}, jsonSchema.required || [], schemaId),
    revocable,
    witness
  }
}

/**
 * Transform JSON Schema properties to FormField format
 */
async function transformFields(properties, required = [], schemaId = '') {
  const entries = Object.entries(properties)
  const fields = []

  for (const [name, rawProp] of entries) {
    // Resolve $ref if present (merges with local overrides)
    const prop = await resolveProperty(rawProp)

    // Skip fields marked with x-oma3-skip-reason
    if (prop['x-oma3-skip-reason']) {
      console.log(`Skipping field '${name}' - reason: ${prop['x-oma3-skip-reason']}`)
      continue
    }

    // Require title for form fields - it's essential for UI labels
    if (!prop.title) {
      throw new Error(`Field '${name}' in schema '${schemaId}' is missing required 'title' property. Field titles are used as form labels and must be provided.`)
    }

    // Handle object types with nested properties
    if (prop.type === 'object' && prop.properties) {
      // Check render mode: 'raw' = JSON input, 'expanded' or default = sub-fields
      const renderMode = prop['x-oma3-render'] || 'expanded'
      
      if (renderMode === 'raw') {
        console.log(`   📦 Processing object field '${name}' as raw JSON input`)
        const rawField = {
          name,
          type: 'json',
          label: prop.title,
          description: prop.description,
          required: required.includes(name),
          placeholder: 'Paste JSON object...'
        }
        fields.push(rawField)
        continue
      }

      // renderMode === 'expanded' (default)
      console.log(`   📦 Processing object field '${name}' with ${Object.keys(prop.properties).length} sub-fields`)
      const objectField = {
        name,
        type: 'object',
        label: prop.title,
        description: prop.description,
        required: required.includes(name),
        subFields: await transformFields(prop.properties, prop.required || [], schemaId)
      }

      // Add nested flag if present
      if (prop['x-oma3-nested'] !== undefined) {
        objectField.nested = prop['x-oma3-nested']
      }

      fields.push(objectField)
      continue
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

      // Add default value if present
      if (prop.default !== undefined) {
        field.default = prop.default
      }

      // Add auto-default marker if present
      if (prop['x-oma3-default']) {
        field.autoDefault = prop['x-oma3-default']
      }

      // Add subtype if present
      if (prop['x-oma3-subtype']) {
        field.subtype = prop['x-oma3-subtype']
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

      if (prop.type === 'string') {
        if (prop.minLength !== undefined) field.minLength = prop.minLength
        if (prop.maxLength !== undefined) field.maxLength = prop.maxLength
        if (prop.pattern) field.pattern = prop.pattern
      }

      if (prop.format) {
        field.format = prop.format
      }

    fields.push(field)
  }

  return fields
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

      // Find matching deployment file extension
      const matchedExtension = Object.keys(DEPLOYMENT_FILE_MAPPINGS).find(ext => file.endsWith(ext))

      if (matchedExtension) {
        schemaId = file.replace(matchedExtension, '')
        chainId = DEPLOYMENT_FILE_MAPPINGS[matchedExtension]
        chainName = getChainName(chainId)
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
 * Read EAS schema strings from generated .eas.json files (not .deployed.)
 * These contain the Solidity-typed schema string used by SchemaEncoder.
 */
async function readEasSchemaStrings(rootPath) {
  const generatedPath = path.join(rootPath, 'generated')
  const schemaStrings: Record<string, string> = {}

  try {
    console.log(`📐 Reading EAS schema strings from: ${generatedPath}`)
    const files = await fs.readdir(generatedPath)

    for (const file of files) {
      // Match .eas.json but NOT .deployed.*.json
      if (!file.endsWith('.eas.json') || file.includes('.deployed.')) continue

      const rawName = file.replace('.eas.json', '')

      // Convert PascalCase/hyphenated filename to kebab-case to match schema IDs
      const normalizedSchemaId = rawName
        .replace(/([A-Z])/g, (match, letter, index) => {
          if (index > 0 && rawName[index - 1] !== '-') {
            return '-' + letter.toLowerCase()
          }
          return letter.toLowerCase()
        })

      try {
        const filePath = path.join(generatedPath, file)
        const content = await fs.readFile(filePath, 'utf8')
        const data = JSON.parse(content)

        if (data.schema) {
          schemaStrings[normalizedSchemaId] = data.schema
          console.log(`   ✅ ${normalizedSchemaId}: ${data.schema.substring(0, 60)}...`)
        }
      } catch (err) {
        console.warn(`   ⚠️  Failed to read ${file}:`, err.message)
      }
    }
  } catch (error) {
    console.warn(`⚠️  Could not read generated directory for schema strings: ${error.message}`)
  }

  return schemaStrings
}

/**
 * Generate the schemas.ts file
 */
/**
 * Read existing schemas.ts to preserve historical deployedUIDs.
 *
 * When a schema is redeployed (e.g., field layout change), the old UID
 * disappears from the deployment data. But existing attestations under
 * the old UID still need witness support. This function extracts all
 * current deployedUIDs and priorUIDs so they can be merged into the
 * regenerated file.
 *
 * Returns: Record<schemaId, Record<chainId, Set<uid>>> — all known UIDs per schema per chain.
 */
async function readExistingUIDs(): Promise<Record<string, Record<number, Set<string>>>> {
  const schemasPath = path.resolve('src/config/schemas.ts')
  const result: Record<string, Record<number, Set<string>>> = {}

  try {
    const content = await fs.readFile(schemasPath, 'utf8')

    // Match each schema block: id + deployedUIDs + optional priorUIDs
    const schemaBlockRegex = /id:\s*'([^']+)'[\s\S]*?deployedUIDs:\s*\{([^}]+)\}/g
    let match

    while ((match = schemaBlockRegex.exec(content)) !== null) {
      const schemaId = match[1]
      const uidsBlock = match[2]
      const chainUIDs: Record<number, Set<string>> = {}

      // Extract chainId: 'uid' pairs from the deployedUIDs block
      const pairRegex = /(\d+):\s*'(0x[0-9a-fA-F]{64})'/g
      let pairMatch
      while ((pairMatch = pairRegex.exec(uidsBlock)) !== null) {
        const chainId = parseInt(pairMatch[1], 10)
        const uid = pairMatch[2].toLowerCase()
        if (uid !== ZERO_UID.toLowerCase()) {
          if (!chainUIDs[chainId]) chainUIDs[chainId] = new Set()
          chainUIDs[chainId].add(uid)
        }
      }

      // Also extract from priorUIDs if present: Record<chainId, string[]>
      const afterDeployedUIDs = content.slice(match.index + match[0].length, match.index + match[0].length + 1000)
      const priorMatch = afterDeployedUIDs.match(/priorUIDs:\s*\{([\s\S]*?)\}/)
      if (priorMatch) {
        const priorBlock = priorMatch[1]
        // Match chainId: ['uid1', 'uid2'] patterns
        const chainArrayRegex = /(\d+):\s*\[([\s\S]*?)\]/g
        let chainArrayMatch
        while ((chainArrayMatch = chainArrayRegex.exec(priorBlock)) !== null) {
          const chainId = parseInt(chainArrayMatch[1], 10)
          const arrayContent = chainArrayMatch[2]
          const uidRegex = /'(0x[0-9a-fA-F]{64})'/g
          let uidMatch
          while ((uidMatch = uidRegex.exec(arrayContent)) !== null) {
            if (!chainUIDs[chainId]) chainUIDs[chainId] = new Set()
            chainUIDs[chainId].add(uidMatch[1].toLowerCase())
          }
        }
      }

      if (Object.keys(chainUIDs).length > 0) {
        result[schemaId] = chainUIDs
      }
    }

    const totalUIDs = Object.values(result).reduce(
      (sum, chains) => sum + Object.values(chains).reduce((s, set) => s + set.size, 0), 0
    )
    console.log(`📜 Read ${totalUIDs} existing UIDs across ${Object.keys(result).length} schemas`)
  } catch (error) {
    console.log(`📜 No existing schemas.ts found — starting fresh`)
  }

  return result
}

async function generateSchemasFile(schemas, deployments = {}, easSchemaStrings: Record<string, string> = {}, existingUIDs: Record<string, Record<number, Set<string>>> = {}) {
  const uiSchemas = await Promise.all(
    Object.entries(schemas).map(([id, schema]) =>
      transformToUISchema(schema, id)
    )
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
    const bscTestnetData = deployment?.[CHAIN_IDS.BSC_TESTNET]
    const bscMainnetData = deployment?.[CHAIN_IDS.BSC_MAINNET]
    const omachainTestnetData = deployment?.[CHAIN_IDS.OMACHAIN_TESTNET]
    const omachainMainnetData = deployment?.[CHAIN_IDS.OMACHAIN_MAINNET]

    const bscTestnetUID = bscTestnetData ? bscTestnetData.schemaUID : '0x0000000000000000000000000000000000000000000000000000000000000000'
    const bscTestnetBlock = bscTestnetData ? bscTestnetData.blockNumber : 0
    const bscMainnetUID = bscMainnetData ? bscMainnetData.schemaUID : '0x0000000000000000000000000000000000000000000000000000000000000000'
    const bscMainnetBlock = bscMainnetData ? bscMainnetData.blockNumber : 0
    const omachainTestnetUID = omachainTestnetData ? omachainTestnetData.schemaUID : '0x0000000000000000000000000000000000000000000000000000000000000000'
    const omachainTestnetBlock = omachainTestnetData ? omachainTestnetData.blockNumber : 0
    const omachainMainnetUID = omachainMainnetData ? omachainMainnetData.schemaUID : '0x0000000000000000000000000000000000000000000000000000000000000000'
    const omachainMainnetBlock = omachainMainnetData ? omachainMainnetData.blockNumber : 0

    // Convert kebab-case to camelCase for variable names
    const varName = item.schema.id.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase())

    // Build schema export lines
    const exportLines = [
      `export const ${varName}Schema: AttestationSchema = {`,
      `  id: '${escapeString(item.schema.id)}',`,
      `  title: '${escapeString(item.schema.title)}',`,
      `  description: '${escapeString(item.schema.description)}',`,
      `  fields: ${item.fieldsVarName},`,
    ]

    // Add revocable flag only if true (schemas that need revocation support)
    // This is auto-detected from the JSON schema's 'revoked' field with x-oma3-skip-reason: "eas"
    if (item.schema.revocable) {
      exportLines.push(`  revocable: true,`)
    }

    // Add witness configuration if present (from x-oma3-witness in JSON schema)
    if (item.schema.witness) {
      exportLines.push(`  witness: ${JSON.stringify(item.schema.witness)},`)
    }

    // Add EAS schema string if available (from generated .eas.json files)
    const easStr = easSchemaStrings[item.schema.id]
    if (easStr) {
      exportLines.push(`  easSchemaString: '${escapeString(easStr)}',`)
    }

    exportLines.push(
      `  deployedUIDs: {`,
      `    ${CHAIN_IDS.BSC_TESTNET}: '${escapeString(bscTestnetUID)}', // BSC Testnet`,
      `    ${CHAIN_IDS.BSC_MAINNET}: '${escapeString(bscMainnetUID)}', // BSC Mainnet`,
      `    ${CHAIN_IDS.OMACHAIN_TESTNET}: '${escapeString(omachainTestnetUID)}', // OMAchain Testnet`,
      `    ${CHAIN_IDS.OMACHAIN_MAINNET}: '${escapeString(omachainMainnetUID)}'  // OMAchain Mainnet`,
      `  },`,
    )

    // Compute priorUIDs: any previously-deployed UIDs that differ from current, per chain
    const currentByChain: Record<number, string> = {
      [CHAIN_IDS.BSC_TESTNET]: bscTestnetUID,
      [CHAIN_IDS.BSC_MAINNET]: bscMainnetUID,
      [CHAIN_IDS.OMACHAIN_TESTNET]: omachainTestnetUID,
      [CHAIN_IDS.OMACHAIN_MAINNET]: omachainMainnetUID,
    }
    const existingForSchema = existingUIDs[item.schema.id]
    const priorByChain: Record<number, string[]> = {}

    if (existingForSchema) {
      for (const [chainIdStr, uidSet] of Object.entries(existingForSchema)) {
        const chainId = parseInt(chainIdStr, 10)
        const currentUID = (currentByChain[chainId] || ZERO_UID).toLowerCase()
        const priors: string[] = []
        for (const uid of uidSet) {
          if (uid !== currentUID) {
            priors.push(uid)
          }
        }
        if (priors.length > 0) {
          priorByChain[chainId] = priors.sort()
        }
      }
    }

    if (Object.keys(priorByChain).length > 0) {
      const priorLines: string[] = []
      for (const [chainId, uids] of Object.entries(priorByChain)) {
        const chainName = getChainName(parseInt(chainId, 10))
        const uidsStr = uids.map(u => `'${u}'`).join(', ')
        priorLines.push(`    ${chainId}: [${uidsStr}]${chainName ? ` // ${chainName}` : ''}`)
      }
      exportLines.push(
        `  priorUIDs: {`,
        ...priorLines.map((line, i) => i < priorLines.length - 1 ? line + ',' : line),
        `  },`,
      )
    }

    exportLines.push(
      `  deployedBlocks: {`,
      `    ${CHAIN_IDS.BSC_TESTNET}: ${bscTestnetBlock}, // BSC Testnet`,
      `    ${CHAIN_IDS.BSC_MAINNET}: ${bscMainnetBlock}, // BSC Mainnet`,
      `    ${CHAIN_IDS.OMACHAIN_TESTNET}: ${omachainTestnetBlock}, // OMAchain Testnet`,
      `    ${CHAIN_IDS.OMACHAIN_MAINNET}: ${omachainMainnetBlock}  // OMAchain Mainnet`,
      `  }`,
      `};`
    )

    return {
      varName,
      export: exportLines.join('\n')
    }
  })

  const fileContent = `// This file is auto-generated by scripts/update-schemas.js
// Do not edit manually - your changes will be overwritten

// Schema definitions for attestation forms
export type FieldType = 'string' | 'integer' | 'array' | 'enum' | 'datetime' | 'uri' | 'object' | 'json'

export interface FormField {
  name: string
  type: FieldType
  label: string
  description?: string
  required: boolean
  placeholder?: string
  options?: (string | number)[] // for enum fields (strings or integers)
  format?: string // for validation (uri, date-time, etc.)
  pattern?: string // regex pattern for string validation
  min?: number // for integer fields
  max?: number // for integer fields
  minLength?: number // for string fields
  maxLength?: number // for string fields
  subFields?: FormField[] // for object fields with nested properties
  default?: any // default value for the field
  autoDefault?: string // auto-generate default (e.g., 'current-timestamp')
  subtype?: string // semantic subtype (e.g., 'timestamp' for integer fields)
  nested?: boolean // for object fields: true = render with container/heading, false/omitted = render flat
}

export interface AttestationSchema {
  id: string
  title: string
  description: string
  fields: FormField[]
  deployedUIDs?: Record<number, string> // chainId -> schemaUID mapping
  deployedBlocks?: Record<number, number> // chainId -> deployment block number
  revocable?: boolean // Whether attestations using this schema can be revoked (default: false)
  easSchemaString?: string // Solidity-typed schema string for EAS SchemaEncoder
  witness?: { subjectField: string; controllerField: string } // Controller Witness API config from x-oma3-witness
  priorUIDs?: Record<number, string[]> // Previously-deployed schema UIDs per chain (preserved across redeployments for witness compatibility)
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

    // Set the schemas directory for $ref resolution
    schemasDirectory = schemasPath
    externalSchemaCache = {} // Clear cache for fresh run

    const schemas = await readSchemasFromDirectory(schemasPath)

    if (Object.keys(schemas).length === 0) {
      console.warn('⚠️  No schemas found to process')
      return
    }

    const deployments = await readDeploymentData(rootPath)

    const easSchemaStrings = await readEasSchemaStrings(rootPath)

    // Read existing UIDs from current schemas.ts to preserve historical deployments
    const existingUIDs = await readExistingUIDs()

    await generateSchemasFile(schemas, deployments, easSchemaStrings, existingUIDs)

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

// Export transformation functions for testing
module.exports = {
  transformToUISchema,
  transformFields,
  // ... you can add more exports as needed
} 