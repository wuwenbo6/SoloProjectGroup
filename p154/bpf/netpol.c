#include <linux/bpf.h>
#include <linux/if_ether.h>
#include <linux/ip.h>
#include <linux/tcp.h>
#include <linux/in.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_endian.h>
#include "netpol.h"

char LICENSE[] SEC("license") = "GPL";

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, MAX_RULES);
    __type(key, struct l7_key);
    __type(value, struct l7_rule);
} l7_rules SEC(".maps");

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 65536);
    __type(key, struct l7_key);
    __type(value, struct conn_state);
} conn_states SEC(".maps");

struct {
    __uint(type, BPF_MAP_TYPE_PERF_EVENT_ARRAY);
    __uint(key_size, sizeof(__u32));
    __uint(value_size, sizeof(__u32));
} events SEC(".maps");

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 1);
    __type(key, __u32);
    __type(value, struct mirror_config);
} mirror_cfg SEC(".maps");

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 1024);
    __type(key, struct rate_limit_key);
    __type(value, struct rate_limit_rule);
} rate_limits SEC(".maps");

struct {
    __uint(type, BPF_MAP_TYPE_PERF_EVENT_ARRAY);
    __uint(key_size, sizeof(__u32));
    __uint(value_size, sizeof(__u32));
} conn_log_events SEC(".maps");

static inline __u64 bpf_ktime_get_ns(void) __attribute__((weak));

static inline char hex_to_char(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    return 0;
}

static inline void url_decode(char *dst, const char *src, int len) {
    int i = 0, j = 0;
    while (i < len && j < MAX_PATH_LEN - 1) {
        if (src[i] == '%' && i + 2 < len) {
            char high = hex_to_char(src[i + 1]);
            char low = hex_to_char(src[i + 2]);
            dst[j++] = (high << 4) | low;
            i += 3;
        } else {
            dst[j++] = src[i++];
        }
    }
    dst[j] = '\0';
}

static inline int is_http_method(const char *data, int len) {
    if (len < 3) return 0;
    if (__builtin_memcmp(data, "GET", 3) == 0) return 1;
    if (__builtin_memcmp(data, "POST", 4) == 0) return 1;
    if (__builtin_memcmp(data, "PUT", 3) == 0) return 1;
    if (__builtin_memcmp(data, "DELETE", 6) == 0) return 1;
    if (__builtin_memcmp(data, "PATCH", 5) == 0) return 1;
    if (__builtin_memcmp(data, "HEAD", 4) == 0) return 1;
    if (__builtin_memcmp(data, "OPTIONS", 7) == 0) return 1;
    return 0;
}

static inline int parse_http_path(const char *data, int len, char *path, int path_len, char *method, int method_len) {
    int i = 0, j = 0;
    
    while (i < len && data[i] != ' ' && i < method_len - 1) {
        method[i] = data[i];
        i++;
    }
    method[i] = '\0';
    
    if (!is_http_method(method, i)) return -1;
    
    i++;
    while (i < len && data[i] == ' ') i++;
    
    j = 0;
    while (i < len && data[i] != ' ' && j < path_len - 1) {
        path[j++] = data[i++];
    }
    path[j] = '\0';
    
    return 0;
}

static inline int check_rate_limit(__u32 pod_ip, __u32 pkt_len) {
    struct rate_limit_key key = {.pod_ip = pod_ip};
    struct rate_limit_rule *rule;
    __u64 now;
    
    rule = bpf_map_lookup_elem(&rate_limits, &key);
    if (!rule || !rule->enabled) {
        return 0;
    }
    
    now = bpf_ktime_get_ns() / 1000000000;
    
    if (now > rule->last_update) {
        rule->bytes_used = 0;
        rule->packets_used = 0;
        rule->last_update = now;
    }
    
    if (rule->bytes_per_second > 0 && rule->bytes_used + pkt_len > rule->bytes_per_second) {
        return 1;
    }
    
    if (rule->packets_per_second > 0 && rule->packets_used + 1 > rule->packets_per_second) {
        return 1;
    }
    
    rule->bytes_used += pkt_len;
    rule->packets_used++;
    
    return 0;
}

static inline void update_conn_stats(__u32 src_ip, __u32 dst_ip, __u16 dst_port, __u8 proto, __u32 pkt_len, __u8 is_tx) {
    struct l7_key key = {
        .src_ip = src_ip,
        .dst_ip = dst_ip,
        .dst_port = dst_port,
        .proto = proto,
    };
    
    struct conn_state *state;
    state = bpf_map_lookup_elem(&conn_states, &key);
    if (!state) {
        struct conn_state new_state = {0};
        new_state.ts_start = bpf_ktime_get_ns() / 1000000;
        if (is_tx) {
            new_state.bytes_tx = pkt_len;
            new_state.packets_tx = 1;
        } else {
            new_state.bytes_rx = pkt_len;
            new_state.packets_rx = 1;
        }
        bpf_map_update_elem(&conn_states, &key, &new_state, BPF_ANY);
    } else {
        if (is_tx) {
            state->bytes_tx += pkt_len;
            state->packets_tx++;
        } else {
            state->bytes_rx += pkt_len;
            state->packets_rx++;
        }
    }
}

static inline int is_grpc_packet(const char *data, int len) {
    if (len < 5) return 0;
    return (data[0] == 0x00 || data[0] == 0x01);
}

static inline int path_match(const char *rule_path, const char *req_path) {
    int i = 0;
    while (rule_path[i] && req_path[i]) {
        if (rule_path[i] == '*') {
            return 1;
        }
        if (rule_path[i] != req_path[i]) {
            return 0;
        }
        i++;
    }
    return (rule_path[i] == '\0' || rule_path[i] == '*');
}

static inline int method_match(const char *rule_method, const char *req_method) {
    if (rule_method[0] == '*' && rule_method[1] == '\0') {
        return 1;
    }
    return __builtin_memcmp(rule_method, req_method, MAX_METHOD_LEN) == 0;
}

SEC("tc")
int netpol_egress(struct __sk_buff *skb) {
    void *data_end = (void *)(long)skb->data_end;
    void *data = (void *)(long)skb->data;
    
    struct ethhdr *eth = data;
    if ((void *)(eth + 1) > data_end) {
        return TC_ACT_OK;
    }
    
    if (eth->h_proto != bpf_htons(ETH_P_IP)) {
        return TC_ACT_OK;
    }
    
    struct iphdr *ip = (void *)(eth + 1);
    if ((void *)(ip + 1) > data_end) {
        return TC_ACT_OK;
    }
    
    if (ip->protocol != IPPROTO_TCP && ip->protocol != IPPROTO_UDP) {
        return TC_ACT_OK;
    }
    
    __u16 dst_port = 0;
    __u8 tcp_flags = 0;
    __u16 src_port = 0;
    
    if (ip->protocol == IPPROTO_TCP) {
        struct tcphdr *tcp = (void *)ip + (ip->ihl << 2);
        if ((void *)(tcp + 1) > data_end) {
            return TC_ACT_OK;
        }
        dst_port = tcp->dest;
        src_port = tcp->source;
        tcp_flags = tcp->syn << 1 | tcp->fin << 2 | tcp->rst << 3;
    } else if (ip->protocol == IPPROTO_UDP) {
        struct udphdr *udp = (void *)ip + (ip->ihl << 2);
        if ((void *)(udp + 1) > data_end) {
            return TC_ACT_OK;
        }
        dst_port = udp->dest;
        src_port = udp->source;
    }
    
    __u32 pkt_len = data_end - data;
    update_conn_stats(ip->saddr, ip->daddr, dst_port, ip->protocol, pkt_len, 1);
    
    if (check_rate_limit(ip->saddr, pkt_len)) {
        struct conn_log_event log_evt = {
            .src_ip = ip->saddr,
            .dst_ip = ip->daddr,
            .src_port = src_port,
            .dst_port = dst_port,
            .proto = ip->protocol,
            .tcp_flags = tcp_flags,
            .action = 2,
            .timestamp = bpf_ktime_get_ns() / 1000000,
        };
        bpf_perf_event_output(skb, &conn_log_events, BPF_F_CURRENT_CPU, &log_evt, sizeof(log_evt));
        return TC_ACT_SHOT;
    }
    
    struct l7_key key = {
        .src_ip = ip->saddr,
        .dst_ip = ip->daddr,
        .dst_port = dst_port,
        .proto = ip->protocol,
    };
    
    struct l7_rule *rule = bpf_map_lookup_elem(&l7_rules, &key);
    if (!rule) {
        return TC_ACT_OK;
    }
    
    char raw_path[MAX_PATH_LEN] = {0};
    char decoded_path[MAX_PATH_LEN] = {0};
    char method[MAX_METHOD_LEN] = {0};
    __u8 type = 0;
    __u8 action = 1;
    
    if (ip->protocol == IPPROTO_TCP) {
        struct tcphdr *tcp = (void *)ip + (ip->ihl << 2);
        char *payload = (void *)tcp + (tcp->doff << 2);
        int payload_len = data_end - (void *)payload;
        
        if (payload_len > 0) {
            if (payload_len >= 10 && parse_http_path(payload, payload_len, raw_path, MAX_PATH_LEN, method, MAX_METHOD_LEN) == 0) {
                type = HTTP_TYPE;
                url_decode(decoded_path, raw_path, MAX_PATH_LEN);
            } else if (is_grpc_packet(payload, payload_len)) {
                type = GRPC_TYPE;
                __builtin_memcpy(decoded_path, "/grpc", 5);
                __builtin_memcpy(method, "POST", 4);
            }
        }
    }
    
    if (type > 0 && rule->type == type) {
        int match = 0;
        if (type == HTTP_TYPE) {
            match = path_match(rule->path, decoded_path) && method_match(rule->method, method);
        } else if (type == GRPC_TYPE) {
            match = path_match(rule->path, decoded_path);
        }
        
        action = match ? rule->action : 1;
        
        struct event evt = {
            .src_ip = ip->saddr,
            .dst_ip = ip->daddr,
            .dst_port = dst_port,
            .proto = ip->protocol,
            .action = action,
            .type = type,
        };
        __builtin_memcpy(evt.path, decoded_path, MAX_PATH_LEN);
        __builtin_memcpy(evt.method, method, MAX_METHOD_LEN);
        
        bpf_perf_event_output(skb, &events, BPF_F_CURRENT_CPU, &evt, sizeof(evt));
    }
    
    struct conn_state *state = bpf_map_lookup_elem(&conn_states, &key);
    if (state && (tcp_flags & (1 << 2 | 1 << 3))) {
        struct conn_log_event log_evt = {
            .src_ip = ip->saddr,
            .dst_ip = ip->daddr,
            .src_port = src_port,
            .dst_port = dst_port,
            .proto = ip->protocol,
            .tcp_flags = tcp_flags,
            .bytes_tx = state->bytes_tx,
            .bytes_rx = state->bytes_rx,
            .packets_tx = state->packets_tx,
            .packets_rx = state->packets_rx,
            .duration_ms = (bpf_ktime_get_ns() / 1000000) - state->ts_start,
            .timestamp = bpf_ktime_get_ns() / 1000000,
            .action = action,
        };
        bpf_perf_event_output(skb, &conn_log_events, BPF_F_CURRENT_CPU, &log_evt, sizeof(log_evt));
        bpf_map_delete_elem(&conn_states, &key);
    }
    
    if (action == 0) {
        return TC_ACT_SHOT;
    }
    
    return TC_ACT_OK;
}

SEC("tc")
int netpol_ingress(struct __sk_buff *skb) {
    return netpol_egress(skb);
}
