"use client";

import { useMemo, useState } from "react";

type Command = {
  command: string;
  label: string;
  description: string;
  note?: string;
  tags: string[];
};

type Section = { id: string; kicker: string; title: string; description: string; commands: Command[] };

const sections: Section[] = [
  {
    id: "first-look",
    kicker: "01 — first look",
    title: "Cluster state & installation",
    description: "Start here. Establish whether Cilium is healthy, complete, and talking to Kubernetes before touching the datapath.",
    commands: [
      { label: "Wait for Cilium to become ready", command: "cilium status --wait", description: "Blocks until the agent, operator, and core dependencies report ready.", tags: ["status", "install"] },
      { label: "Inspect detailed health", command: "cilium status --verbose", description: "Shows per-component health, daemonset coverage, IPAM, and feature state.", tags: ["status", "health"] },
      { label: "Check CLI and cluster versions", command: "cilium version", description: "Confirms the local CLI version and the Cilium image running in the cluster.", tags: ["status", "version"] },
      { label: "Run the connectivity test", command: "cilium connectivity test", description: "Exercises common pod, service, DNS, policy, and external connectivity paths.", note: "Creates temporary test workloads. Use a disposable or approved test namespace.", tags: ["test", "install"] },
      { label: "List Cilium components", command: "kubectl -n kube-system get pods -l k8s-app=cilium -o wide", description: "Quickly confirm agent placement, readiness, restarts, and the node each agent runs on.", tags: ["kubectl", "status"] },
      { label: "Install or upgrade", command: "cilium install --version <version> --set kubeProxyReplacement=true", description: "Installs Cilium with explicit settings. Treat values as an example—use your platform’s reviewed configuration.", note: "For production, prefer the organisation’s Helm/GitOps path and pin the reviewed version.", tags: ["install", "upgrade"] },
      { label: "Inspect the active configuration", command: "cilium config view", description: "Prints the ConfigMap-backed configuration Cilium is currently using.", tags: ["config", "status"] },
      { label: "Check agent rollout progress", command: "kubectl -n kube-system rollout status ds/cilium", description: "Confirms every agent pod has rolled out after an upgrade or configuration change.", tags: ["upgrade", "kubectl"] },
      { label: "Inspect CiliumNode state", command: "kubectl get ciliumnodes -o wide", description: "Shows node-scoped Cilium resources, particularly useful for IPAM and addressing investigations.", tags: ["ipam", "kubectl"] },
    ],
  },
  {
    id: "observe",
    kicker: "02 — observe traffic",
    title: "Flows, DNS & service reachability",
    description: "Use Hubble to see the decision Cilium made about real traffic. Add filters before drawing conclusions from a busy cluster.",
    commands: [
      { label: "Check Hubble connectivity", command: "hubble status -P", description: "Verifies the local Hubble client can reach Relay and reports connected nodes.", tags: ["hubble", "health"] },
      { label: "Watch denied flows", command: "hubble observe --verdict DROPPED --follow", description: "Streams packets or connections Cilium dropped, including the drop reason when available.", tags: ["hubble", "drops"] },
      { label: "Watch one workload", command: "hubble observe --pod <namespace>/<pod> --follow", description: "Follows ingress and egress flows associated with a workload.", tags: ["hubble", "pod"] },
      { label: "Find DNS failures", command: "hubble observe --protocol dns --verdict DROPPED --follow", description: "Focuses on DNS traffic denied by policy or otherwise dropped in the observed path.", tags: ["hubble", "dns"] },
      { label: "Inspect a Service", command: "kubectl get svc -n <namespace> <service> -o wide && kubectl get endpointslice -n <namespace> -l k8s.io/service-name=<service>", description: "Checks the frontend and the EndpointSlices supplying its backends.", tags: ["service", "kubectl"] },
      { label: "Check local Hubble in an agent", command: "kubectl -n kube-system exec ds/cilium -- hubble status", description: "Useful when Relay is unavailable or you need to confirm per-node flow visibility.", tags: ["hubble", "agent"] },
      { label: "Observe HTTP responses", command: "hubble observe --protocol http --follow", description: "Streams decoded HTTP requests and responses when L7 visibility is enabled.", note: "Feature-dependent: L7 visibility or proxy redirection must be configured for the traffic.", tags: ["hubble", "http"] },
      { label: "Find failed HTTP requests", command: "hubble observe --protocol http --http-status 5+ --follow", description: "Filters observed HTTP server errors to narrow an application-path investigation.", tags: ["hubble", "http"] },
      { label: "Limit the time window", command: "hubble observe --since 10m --verdict DROPPED", description: "Queries recent drops instead of tailing indefinitely.", tags: ["hubble", "drops"] },
      { label: "Trace workload-to-workload traffic", command: "hubble observe --from-pod <ns>/<source> --to-pod <ns>/<destination> --follow", description: "Follows the exact flow between two named workloads.", tags: ["hubble", "pod"] },
      { label: "Export flows for a case", command: "hubble observe --output jsonpb --since 15m > hubble-flows.json", description: "Writes structured flow records for later filtering or attachment to an incident.", note: "Treat flow exports as operational data; retain and share them according to policy.", tags: ["hubble", "incident"] },
    ],
  },
  {
    id: "debug",
    kicker: "03 — debug the datapath",
    title: "Network debugging",
    description: "Work from the workload outward: endpoint identity, routes, service translation, then packet or connection state.",
    commands: [
      { label: "List endpoints on an agent", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg endpoint list", description: "Shows local endpoints, identities, policy mode, IPs, and health state.", tags: ["endpoint", "agent"] },
      { label: "Inspect one endpoint", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg endpoint get <endpoint-id>", description: "Displays labels, identity, policy revision, interfaces, and allowed identities for one endpoint.", tags: ["endpoint", "policy"] },
      { label: "Check agent diagnostics", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg status --verbose", description: "Reads the node-local view of Kubernetes, IPAM, masquerading, proxy, and controller state.", tags: ["agent", "status"] },
      { label: "List nodes and routes", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg node list", description: "Shows Cilium’s node addressing, tunnel endpoint, and health addressing view.", tags: ["routing", "node"] },
      { label: "Collect a safe support bundle", command: "cilium sysdump --output-filename cilium-sysdump.zip", description: "Packages logs, status, configuration, and selected cluster diagnostics for offline analysis.", note: "Review and handle the archive under your incident-data policy; it may contain sensitive metadata.", tags: ["sysdump", "support"] },
      { label: "Read the agent logs", command: "kubectl -n kube-system logs ds/cilium -c cilium-agent --since=15m", description: "Looks for CNI, policy, service, BGP, or controller errors close to the incident window.", tags: ["logs", "agent"] },
      { label: "Watch live datapath events", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg monitor --type drop", description: "Shows live datapath drops observed on one node and their reason codes.", note: "Use briefly and on the relevant node—this can be noisy on a busy cluster.", tags: ["monitor", "drops"] },
      { label: "Check node health probes", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg health status", description: "Reports Cilium’s node-to-node ICMP and HTTP health path, where that subsystem is enabled.", tags: ["health", "node"] },
      { label: "Inspect the IP cache", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg ipcache list", description: "Maps observed IPs to Cilium identities and metadata on the local agent.", tags: ["identity", "ipcache"] },
      { label: "List failing controllers", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg status --verbose | sed -n '/Controllers:/,/Health:/p'", description: "Pulls the controller portion of verbose status to spot repeated reconciliation failures.", tags: ["controller", "agent"] },
    ],
  },
  {
    id: "policy",
    kicker: "04 — policy & identity",
    title: "Current network rules",
    description: "Compare Kubernetes intent with the policy actually compiled into the endpoint. Cilium policy is identity-based, not simply IP-based.",
    commands: [
      { label: "List declared Cilium policies", command: "kubectl get ciliumnetworkpolicies,ciliumclusterwidenetworkpolicies -A", description: "Shows CiliumNetworkPolicy and CiliumClusterwideNetworkPolicy resources currently configured.", tags: ["policy", "kubectl"] },
      { label: "Get effective local policy", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg policy get", description: "Dumps the policy map programmed on that agent.", note: "Can be verbose on large clusters; scope investigation to the relevant node.", tags: ["policy", "ebpf"] },
      { label: "Check endpoint policy enforcement", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg endpoint list -o json | jq '.[] | {id, status: .status.policy}'", description: "Finds endpoints and their ingress/egress policy enforcement state.", tags: ["endpoint", "policy"] },
      { label: "Find an identity by label", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg identity list | grep '<label-fragment>'", description: "Locates the numeric Cilium identity associated with workload labels.", tags: ["identity", "policy"] },
      { label: "View Kubernetes NetworkPolicies", command: "kubectl get networkpolicy -A", description: "Lists standard Kubernetes NetworkPolicy resources that Cilium also enforces.", tags: ["policy", "kubectl"] },
      { label: "Inspect policy selectors", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg policy selectors", description: "Shows selector cache state and identities matched by policy selectors on that agent.", tags: ["policy", "identity"] },
      { label: "Inspect FQDN policy cache", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg fqdn cache list", description: "Lists DNS-derived IP entries used by toFQDNs policy enforcement.", note: "Feature-dependent: useful when Cilium FQDN policies are in use.", tags: ["policy", "fqdn"] },
      { label: "Check policy revision convergence", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg endpoint list | column -t", description: "Compares endpoint policy revisions and state on one agent after a policy rollout.", tags: ["policy", "endpoint"] },
    ],
  },
  {
    id: "ebpf",
    kicker: "05 — eBPF & load balancing",
    title: "Services, maps & connection state",
    description: "Use these lower-level checks after confirming the workload and policy layers. Map contents change continuously on active nodes.",
    commands: [
      { label: "List Cilium services", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg service list", description: "Shows service frontends and selected backend mappings known to the local agent.", tags: ["service", "ebpf"] },
      { label: "Inspect LB maps", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg bpf lb list", description: "Reads eBPF load-balancer entries used for service translation.", tags: ["service", "ebpf"] },
      { label: "Inspect global conntrack", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg bpf ct list global", description: "Shows active connection-tracking entries maintained by Cilium.", note: "Potentially large and sensitive; filter or capture only during an approved investigation.", tags: ["conntrack", "ebpf"] },
      { label: "List BPF programs and maps", command: "kubectl -n kube-system exec <cilium-pod> -- bpftool prog show && kubectl -n kube-system exec <cilium-pod> -- bpftool map show", description: "Confirms programs and maps visible inside the agent’s host network/mount context.", tags: ["ebpf", "bpftool"] },
      { label: "Inspect NAT entries", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg bpf nat list", description: "Shows NAT translation entries used for egress or service-related paths on the node.", tags: ["nat", "ebpf"] },
      { label: "Inspect endpoint BPF state", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg bpf endpoint list", description: "Reads the eBPF endpoint map, which ties endpoint IDs, interfaces, and identities together.", tags: ["endpoint", "ebpf"] },
      { label: "Inspect tunnel mappings", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg bpf tunnel list", description: "Displays tunnel endpoint map entries when overlay encapsulation is used.", note: "Feature-dependent: not meaningful for every native-routing deployment.", tags: ["routing", "tunnel"] },
    ],
  },
  {
    id: "ipam-routing",
    kicker: "06 — address & route control plane",
    title: "IPAM, BGP & LoadBalancer reachability",
    description: "Separate address allocation from network reachability. An allocated pod or LoadBalancer IP is not automatically advertised or routable.",
    commands: [
      { label: "Inspect Cilium IPAM state", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg ipam", description: "Shows local allocation ranges, used addresses, and available capacity from the agent’s view.", tags: ["ipam", "capacity"] },
      { label: "Read CiliumNode IPAM details", command: "kubectl get ciliumnode <node> -o yaml", description: "Examines allocation state and addresses recorded in the Kubernetes API for a node.", tags: ["ipam", "kubectl"] },
      { label: "List BGP peers", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg bgp peers", description: "Shows local BGP peer sessions, including state and negotiated information.", note: "Feature-dependent: requires Cilium BGP control plane.", tags: ["bgp", "routing"] },
      { label: "Inspect advertised BGP routes", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg bgp routes available", description: "Lists routes available to advertise from the selected agent.", note: "Feature-dependent; exact subcommands can vary across Cilium releases.", tags: ["bgp", "routing"] },
      { label: "List LB IP pools", command: "kubectl get ciliumloadbalancerippools -o wide", description: "Shows Cilium LoadBalancer IP address pools and their allocation policy.", tags: ["loadbalancer", "ipam"] },
      { label: "Check L2 announcement leases", command: "kubectl -n kube-system get lease -l io.cilium/l2-announcement -o wide", description: "Shows Kubernetes Leases used to coordinate which node announces a Service IP on L2.", note: "Feature-dependent: requires L2 announcements.", tags: ["l2", "loadbalancer"] },
      { label: "Check Service VIP assignment", command: "kubectl get svc -A -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name,TYPE:.spec.type,LBIP:.status.loadBalancer.ingress[*].ip", description: "Lists LoadBalancer Services and the IPs Cilium or another controller assigned.", tags: ["service", "loadbalancer"] },
    ],
  },
  {
    id: "security",
    kicker: "07 — security & encryption",
    title: "Wire encryption, DNS & workload identity",
    description: "Validate the feature you rely on: identity-aware policy, node-to-node encryption, and application-layer DNS/L7 observations solve distinct problems.",
    commands: [
      { label: "Check encryption state", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg encrypt status", description: "Reports node-level encryption status and peers where IPsec or WireGuard encryption is enabled.", note: "Feature-dependent: output depends on the chosen encryption mode.", tags: ["encryption", "security"] },
      { label: "Inspect encryption keys", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg encrypt key-status", description: "Checks key availability and rotation state for the encryption subsystem.", tags: ["encryption", "security"] },
      { label: "Resolve an identity", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg identity get <identity-id>", description: "Retrieves the label set behind a numeric identity referenced in a flow or policy dump.", tags: ["identity", "security"] },
      { label: "Inspect DNS proxy state", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg proxy get", description: "Shows local proxy listeners and redirects that provide DNS or L7 visibility/enforcement.", tags: ["dns", "proxy"] },
      { label: "Check certificate-backed connectivity", command: "hubble observe --protocol tls --follow", description: "Observes TLS flows when TLS metadata visibility is available in the configured datapath.", note: "Feature-dependent; this is visibility, not proof of end-to-end workload authentication.", tags: ["hubble", "tls"] },
    ],
  },
  {
    id: "l7-ingress",
    kicker: "08 — L7, Gateway & Ingress",
    title: "Proxy paths & application traffic",
    description: "When a request is redirected through Envoy, inspect both the Kubernetes object and the local proxy/flow view before blaming the upstream workload.",
    commands: [
      { label: "List Gateway API resources", command: "kubectl get gateway,httproute,grpcroute,tcproute,referencegrant -A", description: "Lists the routing objects that may control Cilium Gateway API traffic.", tags: ["gateway", "kubectl"] },
      { label: "List Cilium Envoy config", command: "kubectl get ciliumenvoyconfig,ciliumclusterwideenvoyconfig -A", description: "Shows Cilium-managed Envoy configuration resources when they are used.", tags: ["envoy", "l7"] },
      { label: "Find proxy redirects", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg endpoint get <endpoint-id> | grep -i proxy", description: "Checks whether an endpoint has traffic redirected to the local proxy for L7 policy or visibility.", tags: ["proxy", "endpoint"] },
      { label: "Watch gRPC calls", command: "hubble observe --protocol grpc --follow", description: "Streams observed gRPC request metadata and status when L7 visibility is enabled.", tags: ["hubble", "grpc"] },
      { label: "Read Envoy logs", command: "kubectl -n kube-system logs -l k8s-app=cilium-envoy --all-containers --since=15m", description: "Looks for listener, route, upstream, or TLS errors in a deployment using a separate Cilium Envoy workload.", note: "Feature-dependent: naming and placement vary with the enabled Cilium feature.", tags: ["envoy", "logs"] },
    ],
  },
  {
    id: "performance",
    kicker: "09 — capacity & incident hygiene",
    title: "Scale, pressure & evidence collection",
    description: "Use bounded investigations. Large BPF/conntrack dumps and unfiltered flow tails can add load and expose metadata on a busy cluster.",
    commands: [
      { label: "Review agent Prometheus metrics", command: "kubectl -n kube-system port-forward ds/cilium 9962:9962", description: "Temporarily exposes the local agent metrics endpoint for an approved metrics inspection.", note: "Use your standard observability system for sustained monitoring; stop the port-forward when done.", tags: ["metrics", "agent"] },
      { label: "Check conntrack map pressure", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg bpf ct list global | wc -l", description: "Uses a rough entry count as an investigation aid for connection-tracking growth.", note: "A full dump can be expensive; prefer platform metrics where available.", tags: ["conntrack", "capacity"] },
      { label: "Review endpoint count", command: "kubectl -n kube-system exec <cilium-pod> -- cilium-dbg endpoint list | wc -l", description: "Gives a quick local indication of endpoint cardinality on an agent.", tags: ["endpoint", "capacity"] },
      { label: "Collect a targeted sysdump", command: "cilium sysdump --node-list <node1,node2> --output-filename cilium-targeted-sysdump.zip", description: "Collects diagnostics from the relevant node set instead of the entire cluster when triaging an incident.", note: "Verify supported flags in your CLI release and handle the archive as sensitive operational data.", tags: ["sysdump", "incident"] },
    ],
  },
];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
  return <button className="copy" onClick={copy} aria-label={`Copy ${value}`}>{copied ? "Copied" : "Copy"}</button>;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const visible = useMemo(() => sections.map(section => ({ ...section, commands: section.commands.filter(item => !normalized || `${item.label} ${item.command} ${item.description} ${item.tags.join(" ")}`.toLowerCase().includes(normalized)) })).filter(section => section.commands.length), [normalized]);
  return <main>
    <nav className="topbar"><a className="brand" href="#top"><span className="brand-mark">↯</span> Cilium <em>CLI field guide</em></a><div className="navlinks"><a href="#first-look">Start</a><a href="#debug">Debug</a><a href="#policy">Policy</a></div></nav>
    <header id="top" className="hero">
      <div className="eyebrow"><span></span> Cilium command reference</div>
      <h1>Know where<br /><i>the packet went.</i></h1>
      <p>Practical Cilium CLI and <code>cilium-dbg</code> commands, organised by the question you need to answer—not by a manual’s table of contents.</p>
      <div className="hero-meta"><span><b>9</b> operational paths</span><span><b>67</b> copy-ready commands</span><span className="pill">Cilium 1.19+ mindset</span></div>
    </header>
    <section className="tool-row" aria-label="Search commands"><label htmlFor="search">⌕</label><input id="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search: dropped flows, endpoints, BGP, service..." /><span>{visible.reduce((count, section) => count + section.commands.length, 0)} results</span></section>
    <div className="quicklinks">{sections.map(section => <a href={`#${section.id}`} key={section.id}>{section.title}</a>)}</div>
    <section className="principle"><span>Operating principle</span><p>Start broad with <code>cilium status</code>, observe a real flow with Hubble, then narrow to the affected agent’s endpoint, policy, service, or eBPF state.</p></section>
    <div className="sections">
      {visible.map(section => <section className="command-section" id={section.id} key={section.id}>
        <div className="section-heading"><div><span className="kicker">{section.kicker}</span><h2>{section.title}</h2></div><p>{section.description}</p></div>
        <div className="command-grid">{section.commands.map(item => <article className="command-card" key={item.command}>
          <div className="card-top"><span className="tags">{item.tags.map(tag => <small key={tag}>{tag}</small>)}</span><CopyButton value={item.command} /></div>
          <h3>{item.label}</h3><p>{item.description}</p>
          <div className="terminal"><code>$ {item.command}</code></div>
          {item.note && <div className="note"><b>Heads up</b> {item.note}</div>}
        </article>)}</div>
      </section>)}
      {!visible.length && <div className="empty">No commands match “{query}”. Try a broader term like <button onClick={() => setQuery("policy")}>policy</button> or <button onClick={() => setQuery("service")}>service</button>.</div>}
    </div>
    <footer><span>Built for faster incident triage.</span><span>Replace <code>&lt;cilium-pod&gt;</code>, <code>&lt;namespace&gt;</code>, and other placeholders before running.</span></footer>
  </main>;
}
