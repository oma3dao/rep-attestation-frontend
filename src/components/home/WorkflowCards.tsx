import { HOME_WORKFLOWS } from "@/config/home-workflows"
import { WorkflowCard } from "./WorkflowCard"

export function WorkflowCards() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {HOME_WORKFLOWS.map((workflow) => (
        <WorkflowCard key={workflow.id} workflow={workflow} />
      ))}
    </div>
  )
}
