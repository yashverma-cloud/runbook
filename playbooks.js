// Cloud runbook: playbooks. Each is an ordered list of steps for one situation.
// A step has text, and either cmd (the id of an entry in commands.js) or run
// (a one-off command used only here). Placeholders work as in commands.js.

export const playbooks = [
  {
    id: "crashloop",
    title: "Pod in CrashLoopBackOff",
    summary: "A container keeps exiting and Kubernetes keeps restarting it with a growing delay.",
    steps: [
      { text: "See the restart count and the reason for the last exit. Look at Last State under each container, and at the events at the bottom.", cmd: "k8s-describe-pod" },
      { text: "Read the logs of the run that crashed, not the one that is starting now.", cmd: "k8s-logs-previous" },
      { text: "If the reason is OOMKilled, compare the pod's memory with its limit, then raise the limit or fix the leak.", cmd: "mon-promql-pod-memory" },
      { text: "If the exit code is 1 or 2 straight after start, it is usually configuration: a missing environment variable, secret or config file. Check what the pod actually received.", cmd: "k8s-get-yaml" },
      { text: "If the crashes began with a new release, roll back first and investigate after.", cmd: "k8s-rollout-undo" },
    ],
  },
  {
    id: "node-not-ready",
    title: "Node NotReady or needing replacement",
    summary: "A node stops reporting, or you need to take one out for maintenance without dropping traffic.",
    steps: [
      { text: "List nodes with their status, version and IP addresses.", run: "kubectl get nodes -o wide" },
      { text: "Check the node's conditions (MemoryPressure, DiskPressure, PIDPressure, Ready) and recent events.", run: "kubectl describe node <node-name>" },
      { text: "Stop new pods landing on it.", cmd: "k8s-cordon" },
      { text: "Move its pods elsewhere. PodDisruptionBudgets can make this wait; that is them doing their job.", cmd: "k8s-drain-node" },
      { text: "With Karpenter, delete the node's NodeClaim instead: Karpenter drains the node and provisions a replacement.", run: "kubectl delete nodeclaim <nodeclaim-name>" },
      { text: "Watch the replacement come up.", cmd: "karpenter-watch-nodeclaims" },
    ],
  },
  {
    id: "disk-full",
    title: "Disk full on a Linux host",
    summary: "A filesystem is at or near 100% and writes are starting to fail.",
    steps: [
      { text: "Find which filesystem is full.", cmd: "linux-df" },
      { text: "Find the biggest files on it.", cmd: "linux-find-large-files" },
      { text: "From the full mount point, walk down the largest directories.", cmd: "linux-find-large" },
      { text: "If df says full but du doesn't add up, a process is holding deleted files open. Restart that process to free the space.", cmd: "debug-deleted-open-files" },
      { text: "Trim the systemd journal to 500 MB.", run: "sudo journalctl --vacuum-size=500M", warn: "Deletes the oldest journal entries for good." },
      { text: "On Docker hosts, see how much space images, containers, volumes and build cache use.", run: "docker system df" },
      { text: "Remove dangling images.", cmd: "docker-dangling" },
      { text: "Delete old rotated logs, after checking the list.", cmd: "linux-delete-old-logs" },
    ],
  },
  {
    id: "terraform-lock",
    title: "Terraform state is locked",
    summary: "A plan or apply fails with \"Error acquiring the state lock\".",
    steps: [
      { text: "Read the error: it shows the lock ID, who holds it and when it was taken. If a CI job or a colleague is mid-apply, wait for it." },
      { text: "Only when you are sure the run that holds it has died, release the lock with that ID.", cmd: "tf-force-unlock" },
      { text: "Run a fresh plan to confirm the state matches what you expect before you apply anything.", cmd: "tf-plan-out" },
    ],
  },
  {
    id: "bad-release",
    title: "Roll back a bad release",
    summary: "A deployment went out and errors or latency went up.",
    steps: [
      { text: "Confirm it is the release: compare the error rate before and after the deploy time.", cmd: "mon-promql-error-rate" },
      { text: "For a plain Deployment, list the revisions.", cmd: "k8s-rollout-history" },
      { text: "Go back to the previous revision.", cmd: "k8s-rollout-undo" },
      { text: "Wait until the rollback has finished.", cmd: "k8s-rollout-status" },
      { text: "For a Helm release, list its revisions instead.", cmd: "helm-history" },
      { text: "Roll back to the last good revision.", cmd: "helm-rollback" },
    ],
  },
  {
    id: "slow-endpoint",
    title: "Slow or failing HTTP endpoint",
    summary: "Requests to a service are slow or time out, and you need to find where the time goes.",
    steps: [
      { text: "Split one request into DNS, connect, TLS and total time. The slowest phase tells you where to look.", cmd: "debug-curl-timing" },
      { text: "If DNS is slow or wrong, follow the resolution path.", cmd: "net-dns-trace" },
      { text: "If connect is slow or fails, check the port is reachable.", cmd: "net-test-port" },
      { text: "Check whether it affects everyone, starting with p99 latency.", cmd: "mon-promql-p99-latency" },
      { text: "Then the share of requests failing with 5xx.", cmd: "mon-promql-error-rate" },
      { text: "On the server, count connections by state. A pile of TIME_WAIT or SYN_RECV points at connection handling.", cmd: "debug-tcp-states" },
    ],
  },
  {
    id: "tls-expiry",
    title: "TLS certificate about to expire",
    summary: "A certificate needs renewing before browsers and clients start rejecting it.",
    steps: [
      { text: "Check the dates on the certificate the server is actually serving.", cmd: "net-ssl-cert" },
      { text: "Create a new key and certificate signing request for your CA.", cmd: "ssl-generate-csr" },
      { text: "Check the new certificate's subject, alternative names and dates.", cmd: "ssl-check-cert" },
      { text: "After installing it, test the Nginx configuration.", cmd: "nginx-test-config" },
      { text: "Reload Nginx without dropping connections, then check the served dates again.", cmd: "nginx-reload" },
    ],
  },
];
