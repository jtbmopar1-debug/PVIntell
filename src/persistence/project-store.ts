import type { Project } from "@/domain/models";

const STORAGE_KEY = "pvintell.project.v1";

export interface ProjectStore {
  load(fallback: Project): Project;
  save(project: Project): void;
}

export class BrowserProjectStore implements ProjectStore {
  load(fallback: Project) {
    if (typeof window === "undefined") return fallback;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as Project) : fallback;
    } catch {
      return fallback;
    }
  }
  save(project: Project) {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  }
}
