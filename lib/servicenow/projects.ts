import { repository } from "@/lib/servicenow/repository";
import type { ModuleConfiguration, Project } from "@/types";

export const projects = repository<Project>("project");
export const moduleConfigurations = repository<ModuleConfiguration>("module_configuration");
