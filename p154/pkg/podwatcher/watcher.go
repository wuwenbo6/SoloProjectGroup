package podwatcher

import (
	"context"
	"fmt"
	"log"
	"net"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"

	"github.com/ebpf-cni/netpol-ebpf/pkg/ebpf"
)

type RateLimitPolicy struct {
	LabelSelector   map[string]string
	BytesPerSecond  uint64
	PacketsPerSecond uint64
}

type Watcher struct {
	client       *kubernetes.Clientset
	ebpfManager  *ebpf.Manager
	policies     []RateLimitPolicy
	podIPCache  map[string]string
	ctx          context.Context
	cancel       context.CancelFunc
}

func NewWatcher(client *kubernetes.Clientset, ebpfManager *ebpf.Manager) *Watcher {
	ctx, cancel := context.WithCancel(context.Background())
	return &Watcher{
		client:      client,
		ebpfManager: ebpfManager,
		policies:    make([]RateLimitPolicy, 0),
		podIPCache:  make(map[string]string),
		ctx:         ctx,
		cancel:      cancel,
	}
}

func (w *Watcher) AddPolicy(policy RateLimitPolicy) {
	w.policies = append(w.policies, policy)
}

func (w *Watcher) Start() error {
	watchlist := cache.NewListWatchFromClient(
		w.client.CoreV1().RESTClient(),
		"pods",
		corev1.NamespaceAll,
		fields.Everything(),
	)

	_, controller := cache.NewInformer(
		watchlist,
		&corev1.Pod{},
		time.Minute*5,
		cache.ResourceEventHandlerFuncs{
			AddFunc: func(obj interface{}) {
				pod := obj.(*corev1.Pod)
				w.handlePodAdd(pod)
			},
			UpdateFunc: func(oldObj, newObj interface{}) {
				oldPod := oldObj.(*corev1.Pod)
				newPod := newObj.(*corev1.Pod)
				w.handlePodUpdate(oldPod, newPod)
			},
			DeleteFunc: func(obj interface{}) {
				pod := obj.(*corev1.Pod)
				w.handlePodDelete(pod)
			},
		},
	)

	go controller.Run(w.ctx.Done())

	log.Println("Pod watcher started")
	return nil
}

func (w *Watcher) Stop() {
	w.cancel()
}

func (w *Watcher) handlePodAdd(pod *corev1.Pod) {
	if pod.Status.PodIP == "" {
		return
	}

	podKey := fmt.Sprintf("%s/%s", pod.Namespace, pod.Name)
	w.podIPCache[podKey] = pod.Status.PodIP

	w.applyPoliciesToPod(pod)
}

func (w *Watcher) handlePodUpdate(oldPod, newPod *corev1.Pod) {
	podKey := fmt.Sprintf("%s/%s", newPod.Namespace, newPod.Name)
	
	oldIP := w.podIPCache[podKey]
	
	if newPod.Status.PodIP != "" && oldIP != newPod.Status.PodIP {
		if oldIP != "" {
			w.removePodRateLimit(oldIP)
		}
		w.podIPCache[podKey] = newPod.Status.PodIP
		w.applyPoliciesToPod(newPod)
		return
	}
	
	if !labelsEqual(oldPod.Labels, newPod.Labels) && newPod.Status.PodIP != "" {
		w.applyPoliciesToPod(newPod)
	}
}

func (w *Watcher) handlePodDelete(pod *corev1.Pod) {
	podKey := fmt.Sprintf("%s/%s", pod.Namespace, pod.Name)
	if ip, exists := w.podIPCache[podKey]; exists {
		w.removePodRateLimit(ip)
		delete(w.podIPCache, podKey)
	}
}

func (w *Watcher) applyPoliciesToPod(pod *corev1.Pod) {
	for _, policy := range w.policies {
		if matchesLabels(pod.Labels, policy.LabelSelector) {
			ip := pod.Status.PodIP
			labelStr := formatLabels(policy.LabelSelector)
			
			err := w.ebpfManager.AddRateLimitRule(
				parseIP(ip),
				policy.BytesPerSecond,
				policy.PacketsPerSecond,
				labelStr,
			)
			if err != nil {
				log.Printf("Failed to add rate limit for pod %s/%s: %v", pod.Namespace, pod.Name, err)
			} else {
				log.Printf("Applied rate limit to pod %s/%s (%s): %d B/s, %d pps",
					pod.Namespace, pod.Name, ip, policy.BytesPerSecond, policy.PacketsPerSecond)
			}
			return
		}
	}
}

func (w *Watcher) removePodRateLimit(ip string) {
	if ip == "" {
		return
	}
	
	err := w.ebpfManager.DeleteRateLimitRule(parseIP(ip))
	if err != nil {
		log.Printf("Failed to delete rate limit for IP %s: %v", ip, err)
	}
}

func labelsEqual(a, b map[string]string) bool {
	if len(a) != len(b) {
		return false
	}
	for k, v := range a {
		if b[k] != v {
			return false
		}
	}
	return true
}

func matchesLabels(podLabels, selector map[string]string) bool {
	for k, v := range selector {
		if podLabels[k] != v {
			return false
		}
	}
	return true
}

func formatLabels(labels map[string]string) string {
	parts := make([]string, 0, len(labels))
	for k, v := range labels {
		parts = append(parts, fmt.Sprintf("%s=%s", k, v))
	}
	return strings.Join(parts, ",")
}

func parseIP(ip string) net.IP {
	return net.ParseIP(ip)
}
