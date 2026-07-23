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
      <div className="hero-meta"><span><b>5</b> operational paths</span><span><b>27</b> copy-ready commands</span><span className="pill">Cilium 1.19+ mindset</span></div>
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
