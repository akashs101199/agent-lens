"""
Initialize AgentLens configuration in a project.

Scaffolds an agentlens_config.py file with example setup code.
"""

from pathlib import Path
import typer

def cmd(name: str = typer.Option("MyAgent", help="Agent name")) -> None:
    """
    Scaffold an AgentLens configuration file.
    
    Creates agentlens_config.py with example setup code
    for your AI agent.
    """
    config_file = Path("agentlens_config.py")
    
    if config_file.exists():
        typer.echo(f"❌ {config_file} already exists", err=True)
        raise typer.Exit(1)
    
    config_content = f'''"""
AgentLens configuration for {name}.

Initialize this module in your agent to start logging.
"""

from agentlens import AgentLens, AgentLensConfig

config = AgentLensConfig(
    agent="{name}",
    mode="human",  # Options: 'human', 'ai', 'both'
    transport="file",  # Options: 'console', 'file'
    file_path="agentlens.log",
    privacy_enabled=True,
    redaction_mode="MASK",
)

lens = AgentLens(config)

# Wrap your SDK client:
# from anthropic import Anthropic
# client = lens.wrap(Anthropic())

# Or wrap your tools:
# @lens.wrap_tool("search")
# async def search(query: str) -> list[str]:
#     ...

# Don't forget to close when done:
# await lens.close()
'''
    
    config_file.write_text(config_content)
    
    typer.echo(f"✅ Created {config_file}")
    typer.echo(f"\nQuick start:")
    typer.echo(f"  1. Edit agentlens_config.py with your settings")
    typer.echo(f"  2. Import it: from agentlens_config import lens")
    typer.echo(f"  3. Wrap your clients: client = lens.wrap(Anthropic())")
    typer.echo(f"  4. Run your agent normally — events are logged automatically")
