import { DiagnosticPdfSectionsConfig } from './diagnosticCorrelationPdfGenerator';

export interface PdfReportTemplate {
  id: string;
  name: string;
  audience: string;
  tagline: string;
  description: string;
  sections: DiagnosticPdfSectionsConfig;
}

export const PREDEFINED_PDF_TEMPLATES: PdfReportTemplate[] = [
  {
    id: 'executive-summary',
    name: 'Executive Summary',
    audience: 'Leadership & C-Suite',
    tagline: 'High-Level Strategic Overview',
    description: 'High-level narrative callout, dual-panel SLA sparklines, and prioritized remediation actions without granular low-level table logs.',
    sections: {
      includeSparklines: true,
      includeMutationHistory: false,
      includeRecommendations: true,
      includeExecutiveSummary: true,
      breakBeforeSparklines: false,
      breakBeforeMutationHistory: false,
      breakBeforeRecommendations: false,
      breakBeforeExecutiveSummary: false
    }
  },
  {
    id: 'full-technical-audit',
    name: 'Full Technical Audit',
    audience: 'SREs, DBAs & Architects',
    tagline: 'Comprehensive Structured Multi-Page Audit',
    description: 'Complete multi-page deep dive with all sections enabled and page breaks before data tables and action plans for clean printing.',
    sections: {
      includeSparklines: true,
      includeMutationHistory: true,
      includeRecommendations: true,
      includeExecutiveSummary: true,
      breakBeforeSparklines: false,
      breakBeforeMutationHistory: true,
      breakBeforeRecommendations: true,
      breakBeforeExecutiveSummary: false
    }
  },
  {
    id: 'troubleshooting-focused',
    name: 'Troubleshooting Focused',
    audience: 'Incident Response & On-Call',
    tagline: 'Root-Cause & Incident Triage',
    description: 'Prioritizes raw mutation timestamps, mutex lock-holding times, and correlated latency sparklines for immediate incident root-cause triage.',
    sections: {
      includeSparklines: true,
      includeMutationHistory: true,
      includeRecommendations: true,
      includeExecutiveSummary: false,
      breakBeforeSparklines: false,
      breakBeforeMutationHistory: true,
      breakBeforeRecommendations: false,
      breakBeforeExecutiveSummary: false
    }
  },
  {
    id: 'data-compliance-audit',
    name: 'Compliance & Deep Logs',
    audience: 'Auditors & Security Governance',
    tagline: 'Chronological Mutation Records',
    description: 'Detailed mutation tables and remediation action plans with visual sparklines disabled for standardized audit log records.',
    sections: {
      includeSparklines: false,
      includeMutationHistory: true,
      includeRecommendations: true,
      includeExecutiveSummary: false,
      breakBeforeSparklines: false,
      breakBeforeMutationHistory: false,
      breakBeforeRecommendations: false,
      breakBeforeExecutiveSummary: false
    }
  },
  {
    id: 'visual-standup',
    name: 'Visual Standup Briefing',
    audience: 'Product Owners & Sprint Reviews',
    tagline: 'Fast Graphical Health Snapshot',
    description: 'Compact visual overview with dual-panel SLA sparklines and executive narrative takeaways for quick team standups.',
    sections: {
      includeSparklines: true,
      includeMutationHistory: false,
      includeRecommendations: false,
      includeExecutiveSummary: true,
      breakBeforeSparklines: false,
      breakBeforeMutationHistory: false,
      breakBeforeRecommendations: false,
      breakBeforeExecutiveSummary: false
    }
  }
];

export const CUSTOM_TEMPLATE_STORAGE_KEY = 'benchmark_pdf_export_custom_template';

export function getSavedCustomTemplate(): PdfReportTemplate | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PdfReportTemplate;
  } catch (err) {
    console.error('Failed to parse saved custom template:', err);
    return null;
  }
}

export function saveCustomTemplate(
  sections: DiagnosticPdfSectionsConfig,
  customName: string = 'Saved Custom Template'
): PdfReportTemplate {
  const template: PdfReportTemplate = {
    id: 'saved-custom',
    name: customName,
    audience: 'Custom Saved Audience',
    tagline: 'User-Defined Preset',
    description: 'Custom section visibility and page break structure configured and saved by user.',
    sections: { ...sections }
  };
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(CUSTOM_TEMPLATE_STORAGE_KEY, JSON.stringify(template));
    } catch (err) {
      console.error('Failed to save custom template:', err);
    }
  }
  return template;
}

export function deleteSavedCustomTemplate(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem(CUSTOM_TEMPLATE_STORAGE_KEY);
    } catch (err) {
      console.error('Failed to remove custom template:', err);
    }
  }
}

export function matchTemplateId(
  current: DiagnosticPdfSectionsConfig,
  savedCustom?: PdfReportTemplate | null
): string {
  for (const t of PREDEFINED_PDF_TEMPLATES) {
    if (
      Boolean(t.sections.includeSparklines) === Boolean(current.includeSparklines) &&
      Boolean(t.sections.includeMutationHistory) === Boolean(current.includeMutationHistory) &&
      Boolean(t.sections.includeRecommendations) === Boolean(current.includeRecommendations) &&
      Boolean(t.sections.includeExecutiveSummary) === Boolean(current.includeExecutiveSummary) &&
      Boolean(t.sections.breakBeforeSparklines) === Boolean(current.breakBeforeSparklines) &&
      Boolean(t.sections.breakBeforeMutationHistory) === Boolean(current.breakBeforeMutationHistory) &&
      Boolean(t.sections.breakBeforeRecommendations) === Boolean(current.breakBeforeRecommendations) &&
      Boolean(t.sections.breakBeforeExecutiveSummary) === Boolean(current.breakBeforeExecutiveSummary)
    ) {
      return t.id;
    }
  }

  if (savedCustom) {
    if (
      Boolean(savedCustom.sections.includeSparklines) === Boolean(current.includeSparklines) &&
      Boolean(savedCustom.sections.includeMutationHistory) === Boolean(current.includeMutationHistory) &&
      Boolean(savedCustom.sections.includeRecommendations) === Boolean(current.includeRecommendations) &&
      Boolean(savedCustom.sections.includeExecutiveSummary) === Boolean(current.includeExecutiveSummary) &&
      Boolean(savedCustom.sections.breakBeforeSparklines) === Boolean(current.breakBeforeSparklines) &&
      Boolean(savedCustom.sections.breakBeforeMutationHistory) === Boolean(current.breakBeforeMutationHistory) &&
      Boolean(savedCustom.sections.breakBeforeRecommendations) === Boolean(current.breakBeforeRecommendations) &&
      Boolean(savedCustom.sections.breakBeforeExecutiveSummary) === Boolean(current.breakBeforeExecutiveSummary)
    ) {
      return 'saved-custom';
    }
  }

  return 'custom';
}
