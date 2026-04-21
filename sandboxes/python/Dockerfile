FROM python:3.12-slim

RUN useradd -m -u 1000 sandbox

RUN rm -rf /usr/local/lib/python3.12/site-packages/pip

WORKDIR /code

USER sandbox

CMD ["python3", "solution.py"]
