package k8s

import (
	"context"
	"fmt"
	"log"
	"path/filepath"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
)

var (
	l7NetworkPolicyGVR = schema.GroupVersionResource{
		Group:    "netpol.ebpf.cni",
		Version:  "v1",
		Resource: "l7networkpolicies",
	}
)

type PolicyHandler func(policy *L7NetworkPolicy) error

type Watcher struct {
	client        dynamic.Interface
	informer      cache.SharedIndexInformer
	addHandler    PolicyHandler
	updateHandler PolicyHandler
	deleteHandler PolicyHandler
}

type L7NetworkPolicy struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec L7NetworkPolicySpec `json:"spec"`
}

type L7NetworkPolicySpec struct {
	PodSelector metav1.LabelSelector `json:"podSelector"`
	Ingress     []L7NetworkPolicyIngressRule `json:"ingress,omitempty"`
	Egress      []L7NetworkPolicyEgressRule  `json:"egress,omitempty"`
	PolicyTypes []string                     `json:"policyTypes,omitempty"`
}

type L7NetworkPolicyIngressRule struct {
	Ports []NetworkPolicyPort `json:"ports,omitempty"`
	From  []NetworkPolicyPeer `json:"from,omitempty"`
	HTTP  *HTTPRule           `json:"http,omitempty"`
	GRPC  *GRPCRule           `json:"grpc,omitempty"`
}

type L7NetworkPolicyEgressRule struct {
	Ports []NetworkPolicyPort `json:"ports,omitempty"`
	To    []NetworkPolicyPeer `json:"to,omitempty"`
	HTTP  *HTTPRule           `json:"http,omitempty"`
	GRPC  *GRPCRule           `json:"grpc,omitempty"`
}

type NetworkPolicyPort struct {
	Protocol *string `json:"protocol,omitempty"`
	Port     *int32  `json:"port,omitempty"`
}

type NetworkPolicyPeer struct {
	PodSelector       *metav1.LabelSelector `json:"podSelector,omitempty"`
	NamespaceSelector *metav1.LabelSelector `json:"namespaceSelector,omitempty"`
	IPBlock           *IPBlock              `json:"ipBlock,omitempty"`
}

type IPBlock struct {
	CIDR   string   `json:"cidr"`
	Except []string `json:"except,omitempty"`
}

type HTTPRule struct {
	Paths   []string `json:"paths"`
	Methods []string `json:"methods"`
}

type GRPCRule struct {
	Services []string `json:"services"`
	Methods  []string `json:"methods"`
}

func NewWatcher() (*Watcher, error) {
	config, err := rest.InClusterConfig()
	if err != nil {
		kubeconfig := filepath.Join(homedir.HomeDir(), ".kube", "config")
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return nil, fmt.Errorf("failed to get kubeconfig: %v", err)
		}
	}

	client, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %v", err)
	}

	return &Watcher{
		client: client,
	}, nil
}

func (w *Watcher) Start(ctx context.Context) error {
	factory := dynamicinformer.NewFilteredDynamicSharedInformerFactory(w.client, 0, metav1.NamespaceAll, nil)
	w.informer = factory.ForResource(l7NetworkPolicyGVR).Informer()

	w.informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			u := obj.(*unstructured.Unstructured)
			policy, err := convertToL7NetworkPolicy(u)
			if err != nil {
				log.Printf("Error converting policy: %v", err)
				return
			}
			if w.addHandler != nil {
				if err := w.addHandler(policy); err != nil {
					log.Printf("Error handling add policy: %v", err)
				}
			}
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			u := newObj.(*unstructured.Unstructured)
			policy, err := convertToL7NetworkPolicy(u)
			if err != nil {
				log.Printf("Error converting policy: %v", err)
				return
			}
			if w.updateHandler != nil {
				if err := w.updateHandler(policy); err != nil {
					log.Printf("Error handling update policy: %v", err)
				}
			}
		},
		DeleteFunc: func(obj interface{}) {
			u := obj.(*unstructured.Unstructured)
			policy, err := convertToL7NetworkPolicy(u)
			if err != nil {
				log.Printf("Error converting policy: %v", err)
				return
			}
			if w.deleteHandler != nil {
				if err := w.deleteHandler(policy); err != nil {
					log.Printf("Error handling delete policy: %v", err)
				}
			}
		},
	})

	go w.informer.Run(ctx.Done())

	if !cache.WaitForCacheSync(ctx.Done(), w.informer.HasSynced) {
		return fmt.Errorf("timed out waiting for caches to sync")
	}

	log.Println("K8s watcher started and synced")
	return nil
}

func (w *Watcher) OnAdd(handler PolicyHandler) {
	w.addHandler = handler
}

func (w *Watcher) OnUpdate(handler PolicyHandler) {
	w.updateHandler = handler
}

func (w *Watcher) OnDelete(handler PolicyHandler) {
	w.deleteHandler = handler
}

func convertToL7NetworkPolicy(u *unstructured.Unstructured) (*L7NetworkPolicy, error) {
	spec, ok := u.Object["spec"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid spec")
	}

	policy := &L7NetworkPolicy{
		TypeMeta: metav1.TypeMeta{
			Kind:       u.GetKind(),
			APIVersion: u.GetAPIVersion(),
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      u.GetName(),
			Namespace: u.GetNamespace(),
			Labels:    u.GetLabels(),
		},
	}

	if podSelector, ok := spec["podSelector"].(map[string]interface{}); ok {
		if matchLabels, ok := podSelector["matchLabels"].(map[string]interface{}); ok {
			labels := make(map[string]string)
			for k, v := range matchLabels {
				if s, ok := v.(string); ok {
					labels[k] = s
				}
			}
			policy.Spec.PodSelector.MatchLabels = labels
		}
	}

	if ingress, ok := spec["ingress"].([]interface{}); ok {
		for _, ing := range ingress {
			if ingMap, ok := ing.(map[string]interface{}); ok {
				rule := L7NetworkPolicyIngressRule{}
				
				if http, ok := ingMap["http"].(map[string]interface{}); ok {
					rule.HTTP = &HTTPRule{}
					if paths, ok := http["paths"].([]interface{}); ok {
						for _, p := range paths {
							if s, ok := p.(string); ok {
								rule.HTTP.Paths = append(rule.HTTP.Paths, s)
							}
						}
					}
					if methods, ok := http["methods"].([]interface{}); ok {
						for _, m := range methods {
							if s, ok := m.(string); ok {
								rule.HTTP.Methods = append(rule.HTTP.Methods, s)
							}
						}
					}
				}
				
				if grpc, ok := ingMap["grpc"].(map[string]interface{}); ok {
					rule.GRPC = &GRPCRule{}
					if services, ok := grpc["services"].([]interface{}); ok {
						for _, s := range services {
							if str, ok := s.(string); ok {
								rule.GRPC.Services = append(rule.GRPC.Services, str)
							}
						}
					}
					if methods, ok := grpc["methods"].([]interface{}); ok {
						for _, m := range methods {
							if s, ok := m.(string); ok {
								rule.GRPC.Methods = append(rule.GRPC.Methods, s)
							}
						}
					}
				}
				
				policy.Spec.Ingress = append(policy.Spec.Ingress, rule)
			}
		}
	}

	if egress, ok := spec["egress"].([]interface{}); ok {
		for _, eg := range egress {
			if egMap, ok := eg.(map[string]interface{}); ok {
				rule := L7NetworkPolicyEgressRule{}
				
				if http, ok := egMap["http"].(map[string]interface{}); ok {
					rule.HTTP = &HTTPRule{}
					if paths, ok := http["paths"].([]interface{}); ok {
						for _, p := range paths {
							if s, ok := p.(string); ok {
								rule.HTTP.Paths = append(rule.HTTP.Paths, s)
							}
						}
					}
					if methods, ok := http["methods"].([]interface{}); ok {
						for _, m := range methods {
							if s, ok := m.(string); ok {
								rule.HTTP.Methods = append(rule.HTTP.Methods, s)
							}
						}
					}
				}
				
				if grpc, ok := egMap["grpc"].(map[string]interface{}); ok {
					rule.GRPC = &GRPCRule{}
					if services, ok := grpc["services"].([]interface{}); ok {
						for _, s := range services {
							if str, ok := s.(string); ok {
								rule.GRPC.Services = append(rule.GRPC.Services, str)
							}
						}
					}
					if methods, ok := grpc["methods"].([]interface{}); ok {
						for _, m := range methods {
							if s, ok := m.(string); ok {
								rule.GRPC.Methods = append(rule.GRPC.Methods, s)
							}
						}
					}
				}
				
				policy.Spec.Egress = append(policy.Spec.Egress, rule)
			}
		}
	}

	return policy, nil
}
