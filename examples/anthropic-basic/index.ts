/**
 * AgentLens - Anthropic Basic Example
 *
 * This example demonstrates the simplest way to use AgentLens with the Anthropic SDK.
 * All API calls are automatically logged and formatted to the terminal.
 *
 * Usage:
 *   npx ts-node examples/anthropic-basic/index.ts
 *
 * Requirements:
 *   - @anthropic-ai/sdk
 *   - @agentlens/core
 *   - @agentlens/transport
 *   - ts-node
 */

import { AgentLens } from '@agentlens/core'
import Anthropic from '@anthropic-ai/sdk'

async function main() {
  // Initialize AgentLens with human-readable terminal output
  const lens = new AgentLens({
    agent: 'BasicAssistant',
    mode: 'human',
    transport: 'console',
  })

  // Wrap the Anthropic client - all API calls are now logged
  const client = lens.wrap(new Anthropic())

  console.log('🚀 Starting BasicAssistant...\n')

  try {
    // Make an API call - this will be logged by AgentLens
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: 'What is AI agent observability and why is it important?',
        },
      ],
    })

    // Display the response
    console.log('\n📝 Response from Claude:\n')
    if (response.content[0] && response.content[0].type === 'text') {
      console.log(response.content[0].text)
    }

    console.log('\n✅ Request completed successfully!')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    // Flush and close AgentLens to ensure all logs are written
    await lens.close()
    console.log('\n🏁 BasicAssistant finished.\n')
  }
}

// Run the example
main()
