FROM eclipse-temurin:21-jdk-alpine

RUN adduser -D -u 1000 sandbox

WORKDIR /tmp

USER sandbox

CMD ["/bin/sh", "-c", "cp /code/solution.java /tmp/solution.java && javac /tmp/solution.java && java -cp /tmp solution"]
