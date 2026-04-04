/**
 * AgentLens - Tool Calling Example
 *
 * This example demonstrates a multi-step agent that:
 * 1. Receives a user query
 * 2. Calls mock tools (web_search, fetch_document)
 * 3. Calls an LLM to synthesize results
 * 4. Logs the entire agent run with AgentLens
 *
 * This example shows the full power of AgentLens - visibility into
 * every step of an agent's execution.
 *
 * Usage:
 *   npx ts-node examples/tool-calling/index.ts
 */

import { AgentLens } from '@agentlens/core'

async function main() {
  // Initialize AgentLens
  const lens = new AgentLens({
    agent: 'ResearchAgent',
    mode: 'human',
    transport: 'console',
  })

  console.log('🤖 Starting ResearchAgent...\n')

  try {
    // Start a named run - this creates a context for all operations
    const run = lens.startRun({ name: 'ResearchAgent' })

    // Execute the agent within this run's context
    await run.exec(async () => {
      console.log(`📋 Starting research run: ${run.runId}\n`)

      // Step 1: Planning phase
      lens.log({
        schemaType: 'REASONING_STEP',
        phase: 'PLAN',
        metadata: {
          content:
            'User wants to know about AI agent observability. I should search for recent articles and summarize them.',
        },
      })

      // Step 2: Wrap and call mock tools
      const webSearch = lens.wrapTool('web_search', async (query: string) => {
        // Simulate web search delay
        await new Promise((resolve) => setTimeout(resolve, 500))
        return {
          results: [
            {
              title: 'Understanding AI Agent Observability',
              url: 'https://example.com/article1',
              snippet:
                'Observability in AI agents refers to understanding what an agent is doing...',
            },
            {
              title: 'Best Practices for Agent Monitoring',
              url: 'https://example.com/article2',
              snippet: 'Key metrics for monitoring agent behavior include latency, error rates...',
            },
          ],
        }
      })

      const fetchDocument = lens.wrapTool(
        'fetch_document',
        async (url: string) => {
          // Simulate document fetch delay
          await new Promise((resolve) => setTimeout(resolve, 300))
          return {
            title: 'Understanding AI Agent Observability',
            content:
              'Observability is the ability to understand the internal state of a system based on its external outputs. ' +
              'For AI agents, this means having visibility into their decision-making process, tool calls, and reasoning steps.',
          }
        }
      )

      // Call the tools
      console.log('\n🔍 Searching for information...\n')
      const searchResults = await webSearch('AI agent observability')

      console.log('📄 Fetching full article...\n')
      const document = await fetchDocument('https://example.com/article1')

      // Step 3: Synthesis phase
      lens.log({
        schemaType: 'REASONING_STEP',
        phase: 'REFLECT',
        metadata: {
          content: `Found ${searchResults.results.length} articles and fetched full document. Now synthesizing findings.`,
        },
      })

      // Step 4: Simulate LLM call (in real scenario, this would be actual API call)
      console.log('🧠 Synthesizing information with LLM...\n')

      // For demo purposes, we'll just log the synthesis
      lens.log({
        schemaType: 'REASONING_STEP',
        phase: 'RESPOND',
        metadata: {
          content: `Based on research: ${document.title} - ${document.content.substring(0, 100)}...`,
        },
      })

      // Final response
      const response = {
        summary:
          'AI Agent Observability refers to having complete visibility into an agent\'s behavior, including its decision-making process, ' +
          'tool invocations, and reasoning steps. This is critical for debugging, monitoring, and improving agent performance.',
        sources: searchResults.results.map((r) => r.title),
        confidence: 'high',
      }

      console.log('✨ Final Response:')
      console.log(JSON.stringify(response, null, 2))
    })

    console.log('\n✅ Research completed successfully!')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    // Close AgentLens to flush all pending logs
    await lens.close()
    console.log('\n🏁 ResearchAgent finished.\n')
  }
}

// Run the example
main()
