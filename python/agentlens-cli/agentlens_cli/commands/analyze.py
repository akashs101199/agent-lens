"""
Analyze and summarize agent logs.

Computes statistics from JSONL log files.
"""

import json
from pathlib import Path
from typing import DefaultDict, Any
from collections import defaultdict
import typer
from rich.console import Console
from rich.table import Table

console = Console()

def cmd(file: str = typer.Argument(..., help="Path to JSONL log file")) -> None:
    """
    Analyze and summarize agent logs.
    
    Computes statistics about runs, LLM calls, tool calls, and costs.
    """
    filepath = Path(file)
    
    if not filepath.exists():
        typer.echo(f"❌ File not found: {file}", err=True)
        raise typer.Exit(1)
    
    # Statistics
    runs: set[str] = set()
    llm_calls = 0
    tool_calls = 0
    total_tokens = 0
    total_cost = 0.0
    errors = 0
    tool_stats: DefaultDict[str, int] = defaultdict(int)
    error_stats: DefaultDict[str, int] = defaultdict(int)
    
    # Read JSONL
    event_count = 0
    try:
        with open(filepath) as f:
            for line in f:
                if not line.strip():
                    continue
                
                event_count += 1
                event: dict[str, Any] = json.loads(line)
                
                # Track run IDs
                run_id: Any = event.get('run_id')
                if run_id is not None:
                    runs.add(str(run_id))
                
                # Count event types
                schema_type: Any = event.get('schema_type')
                if schema_type == 'LLM_CALL':
                    llm_calls += 1
                    llm_data: Any = event.get('llm')
                    if llm_data is not None:
                        tokens: Any = llm_data.get('total_tokens')
                        cost: Any = llm_data.get('cost_usd')
                        if tokens is not None:
                            total_tokens += int(tokens)
                        if cost is not None:
                            total_cost += float(cost)
                
                elif schema_type == 'TOOL_CALL':
                    tool_calls += 1
                    tool_data: Any = event.get('tool')
                    if tool_data is not None:
                        tool_name: Any = tool_data.get('name')
                        if tool_name is not None:
                            tool_stats[str(tool_name)] += 1
                
                elif schema_type == 'ERROR':
                    errors += 1
                    error_data: Any = event.get('error')
                    if error_data is not None:
                        error_code: Any = error_data.get('code')
                        if error_code is not None:
                            error_stats[str(error_code)] += 1
    
    except json.JSONDecodeError as e:
        typer.echo(f"❌ Invalid JSON in log file: {e}", err=True)
        raise typer.Exit(1)
    
    # Display results
    console.print(f"\n[bold cyan]AgentLens Log Analysis[/bold cyan]")
    console.print(f"File: {file}\n")
    
    # Overview table
    table = Table(title="Overview")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")
    table.add_row("Total Events", str(event_count))
    table.add_row("Total Runs", str(len(runs)))
    table.add_row("LLM Calls", str(llm_calls))
    table.add_row("Tool Calls", str(tool_calls))
    table.add_row("Errors", str(errors))
    table.add_row("Total Tokens", str(total_tokens))
    table.add_row("Total Cost (USD)", f"${total_cost:.4f}")
    console.print(table)
    
    # Top tools
    if tool_stats:
        console.print(f"\n[bold]Top Tools[/bold]")
        for tool, count in sorted(tool_stats.items(), key=lambda x: x[1], reverse=True)[:5]:
            console.print(f"  {tool}: {count} calls")
    
    # Error types
    if error_stats:
        console.print(f"\n[bold]Error Types[/bold]")
        for error_code, count in sorted(error_stats.items(), key=lambda x: x[1], reverse=True):
            console.print(f"  {error_code}: {count} errors")
    
    console.print()
