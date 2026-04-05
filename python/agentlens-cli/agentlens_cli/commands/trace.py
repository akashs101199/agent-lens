"""
Visualize a specific run from JSONL logs.

Displays a formatted view of all events in a run.
"""

import json
from pathlib import Path
from typing import Any
import typer
from rich.console import Console

console = Console()

def cmd(
    run_id: str = typer.Argument(..., help="Run ID to visualize"),
    file: str = typer.Argument(..., help="Path to JSONL log file"),
) -> None:
    """
    Visualize a specific run from a log file.
    
    Displays all events for the given run_id in a formatted tree view.
    """
    filepath = Path(file)
    
    if not filepath.exists():
        typer.echo(f"❌ File not found: {file}", err=True)
        raise typer.Exit(1)
    
    events: list[dict[str, Any]] = []
    
    # Read JSONL and filter by run_id
    try:
        with open(filepath) as f:
            for line in f:
                if not line.strip():
                    continue
                event_dict: dict[str, Any] = json.loads(line)
                event_run_id: Any = event_dict.get('run_id')
                if event_run_id == run_id:
                    events.append(event_dict)
    except json.JSONDecodeError as e:
        typer.echo(f"❌ Invalid JSON in log file: {e}", err=True)
        raise typer.Exit(1)
    
    if not events:
        typer.echo(f"❌ No events found for run_id: {run_id}", err=True)
        raise typer.Exit(1)
    
    # Display run
    console.print(f"\n[bold]Run: {run_id}[/bold]")
    
    # Show each event
    for event_dict in events:
        try:
            console.print(f"\n[dim]{json.dumps(event_dict, indent=2)}[/dim]")
        except Exception as e:
            console.print(f"[red]Error rendering event: {e}[/red]")
    
    # Summary stats
    if events:
        console.print(f"\n[bold cyan]Summary[/bold cyan]")
        console.print(f"  Total events: {len(events)}")
        first_timestamp: Any = events[0].get('timestamp')
        last_timestamp: Any = events[-1].get('timestamp')
        console.print(f"  First event: {first_timestamp}")
        console.print(f"  Last event: {last_timestamp}")
