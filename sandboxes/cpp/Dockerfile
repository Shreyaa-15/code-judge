FROM gcc:13

RUN useradd -m -u 1000 sandbox

WORKDIR /tmp

USER sandbox

CMD ["/bin/sh", "-c", "g++ -o /tmp/solution /code/solution.cpp && /tmp/solution"]
