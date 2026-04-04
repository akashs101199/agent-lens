#!/usr/bin/env node

/**
 * @agentlens/cli — Command-line interface for AgentLens
 *
 * Usage:
 *   npx agentlens init                     Scaffold AgentLens configuration
 *   npx agentlens trace <run_id> <file>   Visualize a specific run
 *   npx agentlens analyze <file>          Summarize agent behavior
 */

import { initCommand } from './commands/init.js'
import { traceCommand } from './commands/trace.js'
import { analyzeCommand } from './commands/analyze.js'

/**
 * Parse command line arguments and execute the appropriate command.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    printHelp()
    process.exit(0)
  }

  const command = args[0]

  try {
    switch (command) {
      case 'init':
        await initCommand()
        break

      case 'trace': {
        if (args.length < 3) {
          console.error('Error: trace command requires <run_id> and <file> arguments')
          console.error('Usage: npx agentlens trace <run_id> <file>')
          process.exit(1)
        }
        const runId = args[1]
        const file = args[2]
        if (runId && file) {
          await traceCommand(runId, file)
        }
        break
      }

      case 'analyze': {
        if (args.length < 2) {
          console.error('Error: analyze command requires <file> argument')
          console.error('Usage: npx agentlens analyze <file>')
          process.exit(1)
        }
        const file = args[1]
        if (file) {
          await analyzeCommand(file)
        }
        break
      }

      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
        break

      case '--version':
      case '-v':
        printVersion()
        process.exit(0)
        break

      default:
        console.error(`Error: unknown command "${command}"`)
        printHelp()
        process.exit(1)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Error: ${message}`)
    process.exit(1)
  }
}

/**
 * Print help text
 */
function printHelp(): void {
  console.log(`
AgentLens - AI Agent Observability CLI

USAGE:
  npx agentlens <command> [options]

COMMANDS:
  init                      Scaffold AgentLens configuration for your project
  trace <run_id> <file>     Visualize a specific agent run from a JSONL log file
  analyze <file>            Analyze and summarize agent behavior from logs

OPTIONS:
  -h, --help               Show this help message
  -v, --version            Show version number

EXAMPLES:
  # Initialize AgentLens in your project
  npx agentlens init

  # View a specific agent run
  npx agentlens trace run_1234567890_abc def agentlens.log

  # Get a summary of all runs in a log file
  npx agentlens analyze agentlens.log

For more information, visit: https://github.com/akashs101199/agent-lens
`)
}

/**
 * Print version number
 */
function printVersion(): void {
  console.log('AgentLens CLI v1.0.0')
}

// Run the CLI
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
