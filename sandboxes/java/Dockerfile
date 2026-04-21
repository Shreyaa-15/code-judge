FROM eclipse-temurin:21-jdk-alpine

RUN adduser -D -u 1000 sandbox

WORKDIR /code

USER sandbox

CMD ["/bin/sh", "-c", "javac solution.java && java solution"]
