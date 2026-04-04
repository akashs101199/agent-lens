import { promises as fs } from 'fs'
import { existsSync } from 'fs'
import { join } from 'path'

/**
 * Initialize AgentLens configuration for the current project.
 * Detects which SDK is installed and generates appropriate config.
 */
export async function initCommand(): Promise<void> {
  try {
    // Check for package.json
    if (!existsSync('package.json')) {
      console.error('Error: package.json not found. Are you in a project directory?')
      process.exit(1)
    }

    const packageJsonContent = await fs.readFile('package.json', 'utf-8')
    const packageJson = JSON.parse(packageJsonContent)

    // Detect installed SDKs
    const hasAnthropic = packageJson.dependencies?.['@anthropic-ai/sdk'] ||
      packageJson.devDependencies?.['@anthropic-ai/sdk']
    const hasOpenAI = packageJson.dependencies?.['openai'] ||
      packageJson.devDependencies?.['openai']

    let configContent: string
    let snippet: string

    if (hasAnthropic) {
      configContent = generateAnthropicConfig()
      snippet = generateAnthropicSnippet()
    } else if (hasOpenAI) {
      configContent = generateOpenAIConfig()
      snippet = generateOpenAISnippet()
    } else {
      configContent = generateBasicConfig()
      snippet = generateBasicSnippet()
    }

    // Write config file
    const configPath = 'agentlens.config.ts'
    if (existsSync(configPath)) {
      console.log(`⚠️  ${configPath} already exists. Skipping...`)
    } else {
      await fs.writeFile(configPath, configContent, 'utf-8')
      console.log(`✅ Created ${configPath}`)
    }

    // Print getting-started snippet
    console.log('\n📋 To get started, add this to your code:\n')
    console.log(snippet)

    console.log('\n✨ AgentLens initialized! See README.md for more options.')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to initialize AgentLens: ${message}`)
  }
}

function generateAnthropicConfig(): string {
  return `import { AgentLens } from '@agentlens/core'
import Anthropic from '@anthropic-ai/sdk'

export const agentlens = new AgentLens({
  agent: 'MyAgent',
  mode: 'human',
  transport: 'console',
})

export const client = agentlens.wrap(new Anthropic())
`
}

function generateAnthropicSnippet(): string {
  return `import { agentlens, client } from './agentlens.config'

const response = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Hello! What can you do?' }
  ],
})

console.log(response.content)
await agentlens.close()`
}

function generateOpenAIConfig(): string {
  return `import { AgentLens } from '@agentlens/core'
import OpenAI from 'openai'

export const agentlens = new AgentLens({
  agent: 'MyAgent',
  mode: 'human',
  transport: 'console',
})

export const client = agentlens.wrap(new OpenAI())
`
}

function generateOpenAISnippet(): string {
  return `import { agentlens, client } from './agentlens.config'

const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'Hello! What can you do?' }
  ],
})

console.log(response.choices[0].message.content)
await agentlens.close()`
}

function generateBasicConfig(): string {
  return `import { AgentLens } from '@agentlens/core'

export const agentlens = new AgentLens({
  agent: 'MyAgent',
  mode: 'human',
  transport: 'console',
})

// Then wrap your SDK client:
// import Anthropic from '@anthropic-ai/sdk'
// const client = agentlens.wrap(new Anthropic())
`
}

function generateBasicSnippet(): string {
  return `import { agentlens } from './agentlens.config'

// Use agentlens.wrapTool() to log tool calls
const searchTool = agentlens.wrapTool('search', async (query: string) => {
  return \`Results for: \${query}\`
})

const result = await searchTool('AI observability')
console.log(result)
await agentlens.close()`
}
