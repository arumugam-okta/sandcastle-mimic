import { Workbench } from "@/components/workbench";
import { loadTemplates } from "@/lib/templates";

export default function Home() {
  return <Workbench templates={loadTemplates()} />;
}
