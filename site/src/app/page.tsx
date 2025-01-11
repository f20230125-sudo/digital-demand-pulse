import { Pulse } from "@/components/Pulse";
import { loadPulse } from "@/lib/load";

export default function Page() {
  return <Pulse r={loadPulse()} repoUrl={process.env.NEXT_PUBLIC_REPO_URL} />;
}
