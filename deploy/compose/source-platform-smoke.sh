#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
REPORT_DIR="${AIBIZ_REPORT_DIR:-${SCRIPT_DIR}/.artifacts/source-platform-smoke/${TIMESTAMP}}"
SUMMARY_FILE="${REPORT_DIR}/summary.txt"
CHECKS_FILE="${REPORT_DIR}/checks.jsonl"

ALLINONE_URL="${AIBIZ_ALLINONE_URL:-http://127.0.0.1:${AIBIZ_ALLINONE_PORT:-30000}}"
GATEWAY_URL="${AIBIZ_GATEWAY_URL:-http://127.0.0.1:${AIBIZ_GATEWAY_PORT:-30086}}"
ALLINONE_URL="${ALLINONE_URL%/}"
GATEWAY_URL="${GATEWAY_URL%/}"
LOGINNAME="${AIBIZ_LOGINNAME:-aibizhi}"
PASSWORD="${AIBIZ_PASSWORD:-123456}"
ROUTE_PATH="${AIBIZ_GATEWAY_ROUTE_PATH:-/ibizplm__plmweb/dictionaries/codelist/SysOperator}"
REQUEST_TIMEOUT="${AIBIZ_REQUEST_TIMEOUT:-10}"

FAILED=0
TOKEN=""
TEMP_FILES=()

mkdir -p "${REPORT_DIR}"
: >"${SUMMARY_FILE}"
: >"${CHECKS_FILE}"

record() {
    printf '%s\n' "$*" | tee -a "${SUMMARY_FILE}"
}

record_check() {
    local status="$1"
    local check="$2"
    local detail="$3"
    [[ "${status}" == "PASS" ]] || FAILED=1
    printf '%s %s %s\n' "${status}" "${check}" "${detail}" | tee -a "${SUMMARY_FILE}"
    jq -cn --arg status "${status}" --arg check "${check}" --arg detail "${detail}" \
        '{status: $status, check: $check, detail: $detail}' >>"${CHECKS_FILE}"
}

cleanup() {
    local file
    for file in "${TEMP_FILES[@]}"; do
        rm -f "${file}"
    done
}
trap cleanup EXIT

request() {
    local method="$1"
    local url="$2"
    local body_file
    local header_file
    local error_file
    local payload="${3:-}"
    local auth_header="${4:-}"
    local code
    local curl_exit=0
    local -a args

    body_file="$(mktemp "${TMPDIR:-/tmp}/aibiz-source-smoke-body.XXXXXX")"
    header_file="$(mktemp "${TMPDIR:-/tmp}/aibiz-source-smoke-header.XXXXXX")"
    error_file="$(mktemp "${TMPDIR:-/tmp}/aibiz-source-smoke-error.XXXXXX")"
    TEMP_FILES+=("${body_file}" "${header_file}" "${error_file}")
    args=(
        -sS -D "${header_file}" -o "${body_file}" -w '%{http_code}'
        --connect-timeout 3 --max-time "${REQUEST_TIMEOUT}"
        --noproxy '*'
        -H 'Accept: application/json'
    )
    [[ -n "${auth_header}" ]] && args+=(-H "${auth_header}")
    if [[ "${method}" == "POST" ]]; then
        args+=(-H 'Content-Type: application/json' --data-binary "${payload}")
    fi
    code="$(curl -X "${method}" "${args[@]}" "${url}" 2>"${error_file}")" || curl_exit=$?
    REQUEST_CODE="${code:-000}"
    REQUEST_EXIT="${curl_exit}"
    REQUEST_BODY="${body_file}"
    REQUEST_ERROR="${error_file}"
}

valid_http_response() {
    [[ "$1" =~ ^[1-5][0-9][0-9]$ ]]
}

check_http() {
    local label="$1"
    local method="$2"
    local url="$3"
    local allowed="$4"
    local payload="${5:-}"
    local auth_header="${6:-}"
    local code

    request "${method}" "${url}" "${payload}" "${auth_header}"
    code="${REQUEST_CODE}"
    if [[ "${REQUEST_EXIT}" -ne 0 ]]; then
        record_check FAIL "${label}" "curl_exit=${REQUEST_EXIT} http=${code}"
        return
    fi
    if ! valid_http_response "${code}"; then
        record_check FAIL "${label}" "curl_exit=0 http=${code}"
        return
    fi
    case ",${allowed}," in
        *,"${code}",*)
            record_check PASS "${label}" "http=${code}"
            ;;
        *)
            record_check FAIL "${label}" "http=${code} expected=${allowed}"
            ;;
    esac
}

login() {
    local payload
    local token

    payload="$(jq -cn --arg loginname "${LOGINNAME}" --arg password "${PASSWORD}" \
        '{loginname: $loginname, password: $password}')"
    request POST "${ALLINONE_URL}/v7/login" "${payload}"
    if [[ "${REQUEST_EXIT}" -ne 0 || ! "${REQUEST_CODE}" =~ ^2[0-9][0-9]$ ]]; then
        record_check FAIL "allinone POST /v7/login" \
            "curl_exit=${REQUEST_EXIT} http=${REQUEST_CODE}"
        return
    fi
    token="$(jq -er '(.token // .access_token // .data.token // .data.access_token) | strings | select(length > 0)' \
        "${REQUEST_BODY}" 2>/dev/null || true)"
    if [[ -z "${token}" ]]; then
        record_check FAIL "allinone POST /v7/login" "http=${REQUEST_CODE} token_present=false"
        return
    fi
    TOKEN="${token}"
    record_check PASS "allinone POST /v7/login" "http=${REQUEST_CODE} token_present=true"
}

record "source-platform-smoke allinone=${ALLINONE_URL} gateway=${GATEWAY_URL}"
if ! command -v curl >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
    record_check FAIL dependencies "curl_and_jq_required"
    exit "${FAILED}"
fi

check_http "allinone GET /" GET "${ALLINONE_URL}/" "200,301,302,401,403,404"
check_http "allinone protected API without token" GET \
    "${ALLINONE_URL}/dictionaries/codelist/SysOperator" "401,403"
login

if [[ -n "${TOKEN}" ]]; then
    check_http "allinone protected API with token" GET \
        "${ALLINONE_URL}/dictionaries/codelist/SysOperator" "200,201,204" \
        "" "Authorization: Bearer ${TOKEN}"
else
    record_check FAIL "allinone protected API with token" "login_failed"
fi

check_http "gateway GET /" GET "${GATEWAY_URL}/" "200,301,302,401,403,404"
check_http "gateway routed API without token" GET \
    "${GATEWAY_URL}${ROUTE_PATH}" "401,403"
if [[ -n "${TOKEN}" ]]; then
    check_http "gateway routed API with token" GET \
        "${GATEWAY_URL}${ROUTE_PATH}" "200,201,204" \
        "" "Authorization: Bearer ${TOKEN}"
else
    record_check FAIL "gateway routed API with token" "login_failed"
fi

record "result=$([[ "${FAILED}" -eq 0 ]] && printf PASS || printf FAIL)"
exit "${FAILED}"
