import { ProjectState } from "./types";

const STORAGE_KEY = "ibc-worksheet-project-v1";

export function saveProject(project: ProjectState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch (e) {
    console.error("Failed to save project:", e);
  }
}

export function loadProject(): ProjectState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProjectState;
  } catch (e) {
    console.error("Failed to load project:", e);
    return null;
  }
}

export function clearProject(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear project:", e);
  }
}