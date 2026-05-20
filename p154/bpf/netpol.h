#ifndef __NETPOL_H
#define __NETPOL_H

#include <linux/types.h>
#include <linux/if_ether.h>
#include <linux/ip.h>
#include <linux/tcp.h>
#include <linux/udp.h>

#define ETH_ALEN 6
#define ETH_P_IP 0x0800
#define IP_MF 0x2000
#define IP_OFFSET 0x1FFF

#define IPPROTO_TCP 6
#define IPPROTO_UDP 17

#define TC_ACT_OK 0
#define TC_ACT_SHOT 2

#define MAX_RULES 1024
#define MAX_PATH_LEN 64
#define MAX_METHOD_LEN 32

#define HTTP_TYPE 1
#define GRPC_TYPE 2

#define MAX_LABEL_LEN 64
#define MAX_MIRROR_PORTS 8

struct l7_key {
    __u32 src_ip;
    __u32 dst_ip;
    __u16 dst_port;
    __u8 proto;
} __attribute__((packed));

struct l7_rule {
    __u8 type;
    __u8 action;
    char path[MAX_PATH_LEN];
    char method[MAX_METHOD_LEN];
} __attribute__((packed));

struct conn_state {
    __u32 seq;
    __u32 ack;
    __u8 http_parsed;
    __u8 grpc_parsed;
    __u64 bytes_tx;
    __u64 bytes_rx;
    __u64 packets_tx;
    __u64 packets_rx;
    __u64 ts_start;
} __attribute__((packed));

struct event {
    __u32 src_ip;
    __u32 dst_ip;
    __u16 dst_port;
    __u8 proto;
    __u8 action;
    __u8 type;
    char path[MAX_PATH_LEN];
    char method[MAX_METHOD_LEN];
} __attribute__((packed));

struct mirror_config {
    __u32 enabled;
    __u32 target_ip;
    __u16 target_port;
    __u8 mirror_ingress;
    __u8 mirror_egress;
} __attribute__((packed));

struct rate_limit_key {
    __u32 pod_ip;
} __attribute__((packed));

struct rate_limit_rule {
    __u64 bytes_per_second;
    __u64 packets_per_second;
    __u64 last_update;
    __u64 bytes_used;
    __u64 packets_used;
    char pod_label[MAX_LABEL_LEN];
    __u8 enabled;
} __attribute__((packed));

struct conn_log_event {
    __u32 src_ip;
    __u32 dst_ip;
    __u16 src_port;
    __u16 dst_port;
    __u8 proto;
    __u8 tcp_flags;
    __u64 bytes_tx;
    __u64 bytes_rx;
    __u64 packets_tx;
    __u64 packets_rx;
    __u64 duration_ms;
    __u64 timestamp;
    __u8 action;
} __attribute__((packed));

#endif
