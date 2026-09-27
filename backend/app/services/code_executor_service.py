import subprocess
import tempfile
import os
import logging

logger = logging.getLogger(__name__)

class CodeExecutorService:
    async def execute(self, code: str, language: str) -> dict:
        if language != "python":
            return {"output": "", "errors": ["Language not supported (only python supported for now)"]}
        
        # NOTE: This is a basic prototype executor. It is NOT secure for production use
        # and should be replaced with a sandboxed environment like Docker containers.
        with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False) as f:
            f.write(code)
            filename = f.name
        
        try:
            # Run with a 5-second timeout
            result = subprocess.run(
                ["python", filename],
                capture_output=True,
                text=True,
                timeout=5
            )
            return {
                "output": result.stdout,
                "errors": [result.stderr] if result.stderr else []
            }
        except subprocess.TimeoutExpired:
            return {"output": "", "errors": ["Execution timed out (5s limit)"]}
        except Exception as e:
            logger.error(f"Code execution error: {e}")
            return {"output": "", "errors": [str(e)]}
        finally:
            if os.path.exists(filename):
                os.remove(filename)
