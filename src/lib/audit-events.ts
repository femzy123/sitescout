export type AuditDiagnosticDetails = {
  name: string;
  message: string;
  causes: string[];
};

export type AuditProgress = {
  type: "progress" | "complete" | "error" | "diagnostic";
  progress: number;
  stage: string;
  message: string;
  auditId?: string;
  leadId?: string;
  details?: AuditDiagnosticDetails;
};
