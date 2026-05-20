#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>
#include <bpf/bpf_core_read.h>

#define TASK_COMM_LEN 16
#define MAX_ENTRIES 10240

#define PROTOCOL_HTTP 1
#define PROTOCOL_GRPC 2
#define PROTOCOL_MYSQL 3

char LICENSE[] SEC("license") = "Dual BSD/GPL";

struct event {
    __u32 pid;
    __u32 tgid;
    __u64 request_ts;
    __u64 response_ts;
    __u64 latency_ns;
    char comm[TASK_COMM_LEN];
    __u16 sport;
    __u16 dport;
    __u32 saddr;
    __u32 daddr;
    __u8 protocol;
    __u8 is_request;
    __u8 is_response;
};

struct connection_key {
    __u32 tgid;
    __u64 sock_ptr;
};

struct connection_info {
    __u64 last_request_ts;
    __u64 accept_ts;
    __u16 sport;
    __u16 dport;
    __u32 saddr;
    __u32 daddr;
    __u8 protocol;
};

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, MAX_ENTRIES);
    __type(key, struct connection_key);
    __type(value, struct connection_info);
} connections SEC(".maps");

struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 1 << 24);
} events SEC(".maps");

static __always_inline bool is_http_request_data(const char *data, __u32 len) {
    if (len < 4) return false;
    const char *methods[] = {"GET ", "POST", "PUT ", "DELE", "HEAD", "OPTI", "PATC", "TRAC", "CONN"};
    for (int i = 0; i < 9; i++) {
        if (__builtin_memcmp(data, methods[i], 4) == 0) {
            return true;
        }
    }
    return false;
}

static __always_inline bool is_http_response_data(const char *data, __u32 len) {
    if (len < 4) return false;
    return __builtin_memcmp(data, "HTTP", 4) == 0;
}

static __always_inline bool is_grpc_data(const char *data, __u32 len) {
    if (len < 5) return false;
    return (__builtin_memcmp(data, "\x00\x00\x00", 3) == 0 && data[4] < 0x20);
}

static __always_inline bool is_mysql_query(const char *data, __u32 len) {
    if (len < 5) return false;
    if (data[4] == 0x03 && len > 6) {
        const char *keywords[] = {"SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP"};
        for (int i = 0; i < 7; i++) {
            if (__builtin_memcmp(data + 5, keywords[i], 6) == 0) {
                return true;
            }
        }
    }
    return false;
}

static __always_inline bool is_mysql_response(const char *data, __u32 len) {
    if (len < 5) return false;
    return (data[4] == 0x00 || data[4] == 0xFF);
}

static __always_inline void init_connection_info(struct connection_info *info, struct sock *sk, __u64 ts) {
    info->accept_ts = ts;
    info->last_request_ts = ts;
    info->sport = BPF_CORE_READ(sk, __sk_common.skc_num);
    info->dport = BPF_CORE_READ(sk, __sk_common.skc_dport);
    info->saddr = BPF_CORE_READ(sk, __sk_common.skc_rcv_saddr);
    info->daddr = BPF_CORE_READ(sk, __sk_common.skc_daddr);
    info->protocol = 0;
}

SEC("kprobe/inet_csk_accept")
int BPF_KPROBE(kprobe_inet_csk_accept, struct sock *sk) {
    __u32 tgid = bpf_get_current_pid_tgid() & 0xFFFFFFFF;
    
    struct connection_key key = {
        .tgid = tgid,
        .sock_ptr = (__u64)sk,
    };
    
    struct connection_info info = {0};
    init_connection_info(&info, sk, bpf_ktime_get_ns());
    
    bpf_map_update_elem(&connections, &key, &info, BPF_ANY);
    
    return 0;
}

SEC("kprobe/tcp_sendmsg")
int BPF_KPROBE(kprobe_tcp_sendmsg, struct sock *sk, struct msghdr *msg, size_t size) {
    __u32 pid = bpf_get_current_pid_tgid() >> 32;
    __u32 tgid = bpf_get_current_pid_tgid() & 0xFFFFFFFF;
    __u64 now = bpf_ktime_get_ns();
    
    struct connection_key key = {
        .tgid = tgid,
        .sock_ptr = (__u64)sk,
    };
    
    struct connection_info *info = bpf_map_lookup_elem(&connections, &key);
    if (!info) {
        struct connection_info new_info = {0};
        init_connection_info(&new_info, sk, now);
        bpf_map_update_elem(&connections, &key, &new_info, BPF_ANY);
        return 0;
    }
    
    struct event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (!e) {
        return 0;
    }
    
    e->pid = pid;
    e->tgid = tgid;
    e->request_ts = info->last_request_ts;
    e->response_ts = now;
    e->latency_ns = now - info->last_request_ts;
    e->sport = info->sport;
    e->dport = info->dport;
    e->saddr = info->saddr;
    e->daddr = info->daddr;
    e->protocol = info->protocol;
    e->is_request = 0;
    e->is_response = 0;
    
    bpf_get_current_comm(&e->comm, sizeof(e->comm));
    
    if (msg && size > 0) {
        char buf[32];
        struct iovec *iov = NULL;
        void *iov_base = NULL;
        
        if (bpf_core_field_exists(msg->msg_iter.iov)) {
            iov = (struct iovec *)BPF_CORE_READ(msg, msg_iter.iov);
        }
        
        if (iov && bpf_core_field_exists(iov->iov_base)) {
            iov_base = BPF_CORE_READ(iov, iov_base);
        }
        
        if (iov_base) {
            __u32 read_len = size < 32 ? size : 32;
            __builtin_memset(&buf, 0, sizeof(buf));
            bpf_probe_read(&buf, read_len, iov_base);
            
            if (is_http_response_data(buf, read_len)) {
                e->protocol = PROTOCOL_HTTP;
                e->is_response = 1;
                info->protocol = PROTOCOL_HTTP;
            } else if (is_http_request_data(buf, read_len)) {
                e->protocol = PROTOCOL_HTTP;
                e->is_request = 1;
                info->protocol = PROTOCOL_HTTP;
                info->last_request_ts = now;
            } else if (is_grpc_data(buf, read_len)) {
                e->protocol = PROTOCOL_GRPC;
                info->protocol = PROTOCOL_GRPC;
                if (info->last_request_ts != now) {
                    e->is_response = 1;
                }
            } else if (is_mysql_response(buf, read_len)) {
                e->protocol = PROTOCOL_MYSQL;
                e->is_response = 1;
                info->protocol = PROTOCOL_MYSQL;
            } else if (is_mysql_query(buf, read_len)) {
                e->protocol = PROTOCOL_MYSQL;
                e->is_request = 1;
                info->protocol = PROTOCOL_MYSQL;
                info->last_request_ts = now;
            }
        }
    }
    
    bpf_ringbuf_submit(e, 0);
    
    return 0;
}

SEC("kprobe/tcp_recvmsg")
int BPF_KPROBE(kprobe_tcp_recvmsg, struct sock *sk, struct msghdr *msg, size_t len, int flags) {
    __u32 tgid = bpf_get_current_pid_tgid() & 0xFFFFFFFF;
    __u64 now = bpf_ktime_get_ns();
    
    struct connection_key key = {
        .tgid = tgid,
        .sock_ptr = (__u64)sk,
    };
    
    struct connection_info *info = bpf_map_lookup_elem(&connections, &key);
    if (!info) {
        return 0;
    }
    
    if (msg && len > 0) {
        char buf[32];
        struct iovec *iov = NULL;
        void *iov_base = NULL;
        
        if (bpf_core_field_exists(msg->msg_iter.iov)) {
            iov = (struct iovec *)BPF_CORE_READ(msg, msg_iter.iov);
        }
        
        if (iov && bpf_core_field_exists(iov->iov_base)) {
            iov_base = BPF_CORE_READ(iov, iov_base);
        }
        
        if (iov_base) {
            __u32 read_len = len < 32 ? len : 32;
            __builtin_memset(&buf, 0, sizeof(buf));
            bpf_probe_read(&buf, read_len, iov_base);
            
            if (is_http_request_data(buf, read_len)) {
                info->protocol = PROTOCOL_HTTP;
                info->last_request_ts = now;
            } else if (is_mysql_query(buf, read_len)) {
                info->protocol = PROTOCOL_MYSQL;
                info->last_request_ts = now;
            } else if (is_grpc_data(buf, read_len)) {
                info->protocol = PROTOCOL_GRPC;
                info->last_request_ts = now;
            }
        }
    }
    
    return 0;
}
