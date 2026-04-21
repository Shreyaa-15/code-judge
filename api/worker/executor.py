import docker
import tempfile
import os
import uuid

client = docker.from_env()

LANGUAGE_CONFIG = {
    "python": {
        "image": "judge-python",
        "filename": "solution.py",
    },
    "cpp": {
        "image": "judge-cpp",
        "filename": "solution.cpp",
    },
    "java": {
        "image": "judge-java",
        "filename": "solution.java",
    },
}

def run_code(code: str, language: str, stdin: str = "") -> dict:
    config = LANGUAGE_CONFIG.get(language)
    if not config:
        return {"status": "error", "stderr": f"Unsupported language: {language}"}

    # Create a temp directory to hold the code file
    with tempfile.TemporaryDirectory() as tmpdir:
        code_file = os.path.join(tmpdir, config["filename"])
        with open(code_file, "w") as f:
            f.write(code)

        try:
            container = client.containers.run(
                image=config["image"],
                volumes={tmpdir: {"bind": "/code", "mode": "ro"}},
                mem_limit="128m",
                cpu_period=100000,
                cpu_quota=50000,        # 50% of one CPU
                network_disabled=True,  # no internet
                read_only=False,        # /tmp needs to be writable for cpp
                stdin_open=True,
                remove=True,
                detach=False,
                environment={"PYTHONDONTWRITEBYTECODE": "1"},
            )
            stdout = container.decode("utf-8") if container else ""
            return {
                "status": "success",
                "stdout": stdout,
                "stderr": "",
            }

        except docker.errors.ContainerError as e:
            stderr = e.stderr.decode("utf-8") if e.stderr else str(e)
            return {
                "status": "runtime_error",
                "stdout": "",
                "stderr": stderr,
            }

        except Exception as e:
            return {
                "status": "error",
                "stdout": "",
                "stderr": str(e),
            }