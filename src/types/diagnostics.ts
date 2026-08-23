export type DiagnosticSeverity = 'error' | 'warning';

export interface SourceLocation {
  line: number;
  column: number;
}

export interface Diagnostic {
  code: string;
  message: string;
  severity: DiagnosticSeverity;
  location?: SourceLocation;
}
