"""
AgentLens CLI main entry point.

Provides subcommands for log management and analysis.
"""

import typer
from agentlens_cli.commands.init import cmd as init_cmd
from agentlens_cli.commands.trace import cmd as trace_cmd
from agentlens_cli.commands.analyze import cmd as analyze_cmd

app = typer.Typer(help="AgentLens — AI agent observability tools")

# Add subcommands
app.command(name="init")(init_cmd)
app.command(name="trace")(trace_cmd)
app.command(name="analyze")(analyze_cmd)


def main() -> None:
    """Run the CLI application."""
    app()


if __name__ == '__main__':
    main()
