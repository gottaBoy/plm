#!/usr/bin/env bash
set -euo pipefail

export CUSTOM_SEARCH_NAMES="application,custom"
export CUSTOM_SEARCH_LOCATIONS="${BASE_DIR}/init.d/,file:${BASE_DIR}/conf/"
export MEMBER_LIST=""

JAVA_OPT="${JAVA_OPT:-}"

if [[ "${SPRING_DATASOURCE_PLATFORM:-}" == "mysql" ]]; then
  db_host="${MYSQL_SERVICE_HOST:?MYSQL_SERVICE_HOST is required}"
  db_port="${MYSQL_SERVICE_PORT:-3306}"
  until (echo >"/dev/tcp/${db_host}/${db_port}") >/dev/null 2>&1; do
    sleep 2
  done
fi

if [[ "${MODE:-standalone}" == "standalone" ]]; then
  JAVA_OPT+=" -Xms${JVM_XMS:-64m} -Xmx${JVM_XMX:-256m} -Xmn${JVM_XMN:-128m}"
  JAVA_OPT+=" -Dnacos.standalone=true"
else
  JAVA_OPT+=" -server -Xms${JVM_XMS:-1g} -Xmx${JVM_XMX:-1g} -Xmn${JVM_XMN:-512m}"
  JAVA_OPT+=" -XX:MetaspaceSize=${JVM_MS:-128m} -XX:MaxMetaspaceSize=${JVM_MMS:-320m}"
fi

if [[ "${PREFER_HOST_MODE:-}" == "hostname" ]]; then
  JAVA_OPT+=" -Dnacos.preferHostnameOverIp=true"
fi

JAVA_OPT+=" -Dnacos.member.list="
JAVA_OPT+=" -Dnacos.home=${BASE_DIR}"
JAVA_OPT+=" -Xlog:gc*:file=${BASE_DIR}/logs/nacos_gc.log:time,tags:filecount=10,filesize=100M"
JAVA_OPT+=" ${JAVA_OPT_EXT:-}"
JAVA_OPT+=" -jar ${BASE_DIR}/target/nacos-server.jar"
JAVA_OPT+=" --spring.config.additional-location=${CUSTOM_SEARCH_LOCATIONS}"
JAVA_OPT+=" --spring.config.name=${CUSTOM_SEARCH_NAMES}"
JAVA_OPT+=" --logging.config=${BASE_DIR}/conf/nacos-logback.xml"
JAVA_OPT+=" --server.max-http-header-size=524288"

exec ${JAVA:-java} ${JAVA_OPT}
