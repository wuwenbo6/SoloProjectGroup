#pragma once

#include <stdint.h>

#define TASK_COMM_LEN 16

#define PROTOCOL_HTTP 1
#define PROTOCOL_GRPC 2
#define PROTOCOL_MYSQL 3

struct event {
    uint32_t pid;
    uint32_t tgid;
    uint64_t request_ts;
    uint64_t response_ts;
    uint64_t latency_ns;
    char comm[TASK_COMM_LEN];
    uint16_t sport;
    uint16_t dport;
    uint32_t saddr;
    uint32_t daddr;
    uint8_t protocol;
    uint8_t is_request;
    uint8_t is_response;
};
