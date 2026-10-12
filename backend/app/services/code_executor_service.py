import asyncio
import logging
import os
import sys
import tempfile

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
            process = await asyncio.create_subprocess_exec(
                sys.executable,
                filename,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=5)
            except TimeoutError:
                process.kill()
                await process.communicate()
                return {"output": "", "errors": ["Execution timed out (5s limit)"]}

            return {
                "output": stdout.decode(errors="replace"),
                "errors": [stderr.decode(errors="replace")] if stderr else [],
            }
        except Exception as e:
            logger.exception("Code execution error: %s", e)
            return {"output": "", "errors": [str(e)]}
        finally:
            if os.path.exists(filename):
                os.remove(filename)
