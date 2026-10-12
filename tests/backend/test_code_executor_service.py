import pytest

from app.services.code_executor_service import CodeExecutorService


@pytest.mark.asyncio
async def test_code_executor_runs_python_without_blocking_call_shape():
    result = await CodeExecutorService().execute("print('ok')", "python")

    assert result["output"].replace("\r\n", "\n") == "ok\n"
    assert result["errors"] == []


@pytest.mark.asyncio
async def test_code_executor_rejects_unsupported_languages():
    result = await CodeExecutorService().execute("print('ok')", "javascript")

    assert result["output"] == ""
    assert "only python" in result["errors"][0].lower()
