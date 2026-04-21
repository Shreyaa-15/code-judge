import docker
import uuid
import base64

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

    volume_name = f"judge-job-{uuid.uuid4().hex}"
    filename = config["filename"]

    # Base64 encode the code so special characters don't break the shell command
    encoded = base64.b64encode(code.encode("utf-8")).decode("utf-8")

    try:
        # Step 1 — Create a temporary Docker volume
        client.volumes.create(name=volume_name)

        # Step 2 — Write code into the volume via base64 decode
        client.containers.run(
            image="busybox",
            command=f'sh -c "echo {encoded} | base64 -d > /code/{filename}"',
            volumes={volume_name: {"bind": "/code", "mode": "rw"}},
            remove=True,
        )

        # Step 3 — Run the sandbox container
        container = client.containers.run(
            image=config["image"],
            volumes={volume_name: {"bind": "/code", "mode": "ro"}},
            mem_limit="128m",
            cpu_period=100000,
            cpu_quota=50000,
            network_disabled=True,
            remove=True,
            detach=False,
        )

        stdout = container.decode("utf-8") if container else ""
        return {"status": "success", "stdout": stdout, "stderr": ""}

    except docker.errors.ContainerError as e:
        stderr = e.stderr.decode("utf-8") if e.stderr else str(e)
        return {"status": "runtime_error", "stdout": "", "stderr": stderr}

    except Exception as e:
        return {"status": "error", "stdout": "", "stderr": str(e)}

    finally:
        try:
            client.volumes.get(volume_name).remove(force=True)
        except Exception:
            pass