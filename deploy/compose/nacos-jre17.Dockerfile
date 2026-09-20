FROM eclipse-temurin:17-jre

COPY --from=swr.ap-southeast-1.myhuaweicloud.com/find1024/nacos-server:v2.0.3 /home/nacos /home/nacos
COPY nacos-jre17-startup.sh /usr/local/bin/nacos-jre17-startup.sh

RUN chmod +x /usr/local/bin/nacos-jre17-startup.sh

ENV BASE_DIR=/home/nacos \
    CLASSPATH=.:/home/nacos/conf: \
    CLUSTER_CONF=/home/nacos/conf/cluster.conf \
    FUNCTION_MODE=all \
    JVM_MS=128m \
    JVM_MMS=320m \
    JVM_XMN=128m \
    JVM_XMS=64m \
    JVM_XMX=256m \
    MODE=standalone \
    NACOS_DEBUG=n \
    NACOS_USER=nacos \
    PREFER_HOST_MODE=hostname \
    TOMCAT_ACCESSLOG_ENABLED=false \
    TZ=Asia/Shanghai

ENTRYPOINT ["/usr/local/bin/nacos-jre17-startup.sh"]
