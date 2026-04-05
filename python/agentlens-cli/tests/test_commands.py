"""Tests for CLI commands."""

import json
import tempfile
from pathlib import Path
from typer.testing import CliRunner

from agentlens_cli.main import app

runner = CliRunner()


class TestInitCommand:
    """Test init command."""

    def test_init_creates_config(self) -> None:
        """Init command creates agentlens_config.py."""
        with tempfile.TemporaryDirectory() as tmpdir:
            original_cwd = Path.cwd()
            try:
                import os
                os.chdir(tmpdir)
                
                result = runner.invoke(app, ["init", "--name", "TestAgent"])
                
                assert result.exit_code == 0
                assert Path("agentlens_config.py").exists()
                
                config_content = Path("agentlens_config.py").read_text()
                assert "TestAgent" in config_content
                assert "AgentLens" in config_content
            finally:
                import os
                os.chdir(original_cwd)

    def test_init_fails_if_exists(self) -> None:
        """Init command fails if config already exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            original_cwd = Path.cwd()
            try:
                import os
                os.chdir(tmpdir)
                
                # Create config file
                Path("agentlens_config.py").write_text("# existing")
                
                result = runner.invoke(app, ["init"])
                
                assert result.exit_code != 0
            finally:
                import os
                os.chdir(original_cwd)


class TestAnalyzeCommand:
    """Test analyze command."""

    def test_analyze_nonexistent_file(self) -> None:
        """Analyze fails if file doesn't exist."""
        result = runner.invoke(app, ["analyze", "nonexistent.log"])
        assert result.exit_code != 0

    def test_analyze_empty_file(self) -> None:
        """Analyze handles empty log file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = Path(tmpdir) / "empty.log"
            filepath.write_text("")
            
            result = runner.invoke(app, ["analyze", str(filepath)])
            assert result.exit_code == 0

    def test_analyze_with_events(self) -> None:
        """Analyze processes JSONL events."""
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = Path(tmpdir) / "test.log"
            
            # Create test events
            events = [
                {
                    "schema_type": "LLM_CALL",
                    "run_id": "run_123",
                    "llm": {
                        "total_tokens": 100,
                        "cost_usd": 0.001,
                    },
                },
                {
                    "schema_type": "TOOL_CALL",
                    "run_id": "run_123",
                    "tool": {
                        "name": "search",
                    },
                },
            ]
            
            with open(filepath, "w") as f:
                for event in events:
                    f.write(json.dumps(event) + "\n")
            
            result = runner.invoke(app, ["analyze", str(filepath)])
            
            assert result.exit_code == 0
            assert "LLM Calls" in result.stdout
            assert "Tool Calls" in result.stdout


class TestTraceCommand:
    """Test trace command."""

    def test_trace_nonexistent_file(self) -> None:
        """Trace fails if file doesn't exist."""
        result = runner.invoke(app, ["trace", "run_123", "nonexistent.log"])
        assert result.exit_code != 0

    def test_trace_not_found(self) -> None:
        """Trace fails if run_id not found."""
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = Path(tmpdir) / "test.log"
            filepath.write_text("{}\n")
            
            result = runner.invoke(app, ["trace", "nonexistent_run", str(filepath)])
            assert result.exit_code != 0

    def test_trace_run(self) -> None:
        """Trace displays events for run."""
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = Path(tmpdir) / "test.log"
            
            events = [
                {
                    "schema_type": "AGENT_START",
                    "run_id": "run_123",
                    "timestamp": "2025-01-01T00:00:00Z",
                },
                {
                    "schema_type": "AGENT_END",
                    "run_id": "run_123",
                    "timestamp": "2025-01-01T00:00:01Z",
                },
            ]
            
            with open(filepath, "w") as f:
                for event in events:
                    f.write(json.dumps(event) + "\n")
            
            result = runner.invoke(app, ["trace", "run_123", str(filepath)])
            
            assert result.exit_code == 0
            assert "run_123" in result.stdout
