# Build an executable Spring Boot JAR, then run it with a small Java 17 image.
FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /build/backend
COPY backend/pom.xml ./pom.xml
RUN mvn -B -DskipTests dependency:go-offline
COPY backend/src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app/backend
ENV PORT=8080 \
    WEB_ROOT=/var/data/site \
    DB_DIR=/var/data/db \
    SAMPLE_DATA=true \
    OTP_DEV_LOG=false \
    GOOGLE_CLIENT_ID=480770803476-s834au6ab8go1uasl0cm7akar6ge8n1e.apps.googleusercontent.com
COPY --from=build /build/backend/target/travel-4.0.0.jar /app/backend/app.jar
COPY frontend /opt/travel/frontend
COPY docker-entrypoint.sh /usr/local/bin/travel-entrypoint
RUN chmod +x /usr/local/bin/travel-entrypoint \
    && mkdir -p /var/data/site /var/data/db
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/travel-entrypoint"]
