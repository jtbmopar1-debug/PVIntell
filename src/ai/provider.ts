import type { Project } from "@/domain/models";
import type { SystemFinding, TelemetrySnapshot } from "@/telemetry/types";

export interface WattsonContext {
  project: Project;
  telemetry?: TelemetrySnapshot;
  findings?: SystemFinding[];
}

export interface AIProvider {
  sendMessage(message: string, context: WattsonContext): Promise<string>;
  analyzeSystem(context: WattsonContext): Promise<string>;
  diagnoseFault(context: WattsonContext): Promise<string>;
  explainRecommendation(topic: string, context: WattsonContext): Promise<string>;
  guideInstallation(stepId: string, context: WattsonContext): Promise<string>;
  guideCommissioning(recordId: string, context: WattsonContext): Promise<string>;
}

export class MockAIProvider implements AIProvider {
  async sendMessage(message: string, context: WattsonContext) {
    const lower = message.toLowerCase();
    if (/don't know|dont know|no idea|not sure/.test(lower)) {
      return "That’s completely fine. I’ll use a conservative household estimate and keep it marked as an assumption. A photo of the appliance rating label can confirm it later, but it won’t stop us designing a useful first version now.";
    }
    if (/why.*inverter|inverter.*why/.test(lower)) {
      return this.explainRecommendation("inverter", context);
    }
    if (/charge|fault|wrong|diagnos|problem/.test(lower)) {
      return this.diagnoseFault(context);
    }
    if (/fridge|pump|light|microwave|tv|computer|appliance/.test(lower)) {
      return "I’ve noted those loads. Next, tell me roughly how long each runs in a day—or say “I don’t know” and I’ll use clearly marked estimates. Which of them might run at the same time?";
    }
    return `I’m keeping this tied to ${context.project.name}. Tell me what you want the system to do in everyday language—what you want to power, where it is, and what matters most to you.`;
  }
  async analyzeSystem(context: WattsonContext) {
    return `${context.project.name} is configured as a ${context.project.systemVoltage} V ${context.project.projectType} system. The current design has ${context.project.loads.length} tracked loads and ${context.project.assumptions.length} visible assumptions.`;
  }
  async diagnoseFault(context: WattsonContext) {
    const finding = context.findings?.[0];
    return finding
      ? `${finding.title}. ${finding.explanation} My recommended next check: ${finding.nextStep}`
      : "I don’t see an active fault in the available data. I’d first confirm current PV power, battery voltage, load power, and inverter state.";
  }
  async explainRecommendation(topic: string, context: WattsonContext) {
    return topic === "inverter"
      ? `Your inverter recommendation is based on the loads in ${context.project.name} that may overlap, plus headroom for the water pump’s startup surge. That avoids nuisance shutdowns without sizing for every appliance running at once.`
      : "The recommendation is calculated from your project loads and the assumptions still awaiting confirmation.";
  }
  async guideInstallation(stepId: string, context: WattsonContext) {
    const step = context.project.installationSteps.find((item) => item.id === stepId);
    return step ? `${step.description} Expected result: ${step.expectedResult}` : "Choose an installation stage and I’ll guide you through it.";
  }
  async guideCommissioning(_recordId: string, context: WattsonContext) {
    return `Before energising ${context.project.name}, verify polarity with a suitable meter and have regulated mains work checked by a licensed electrician.`;
  }
}
