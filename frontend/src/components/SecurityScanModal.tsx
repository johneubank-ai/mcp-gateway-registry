import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ClipboardList,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';


export interface SecurityScanResult {
  server_path?: string;
  server_url?: string;
  agent_path?: string;
  agent_url?: string;
  scan_timestamp: string;
  is_safe: boolean;
  critical_issues: number;
  high_severity: number;
  medium_severity: number;
  low_severity: number;
  analyzers_used: string[];
  raw_output: {
    analysis_results?: Record<string, any>;
    tool_results?: Record<string, any>;
    scan_results?: Record<string, any>;
  };
  scan_failed: boolean;
  error_message?: string;
}


interface SecurityScanModalProps {
  resourceName: string;
  resourceType: 'server' | 'agent' | 'skill';
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  scanResult?: SecurityScanResult | null;
  onRescan?: () => Promise<void>;
  canRescan?: boolean;
  onShowToast?: (message: string, type: 'success' | 'error') => void;
}


interface StatusInfo {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  text: string;
}


const SEVERITY_BOX_STYLES: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  high: 'bg-muted text-muted-foreground border-border',
  medium: 'bg-muted text-muted-foreground border-border',
  low: 'bg-primary/10 text-primary dark:text-primary border-primary/20',
};


const _getStatusInfo = (scanResult: SecurityScanResult | null | undefined): StatusInfo => {
  if (!scanResult) {
    return { icon: ShieldCheck, color: 'gray', text: 'No Scan Data' };
  }
  if (scanResult.scan_failed) {
    return { icon: AlertTriangle, color: 'red', text: 'Scan Failed' };
  }
  if (scanResult.critical_issues > 0 || scanResult.high_severity > 0) {
    return { icon: AlertTriangle, color: 'red', text: 'UNSAFE' };
  }
  if (scanResult.medium_severity > 0 || scanResult.low_severity > 0) {
    return { icon: ShieldAlert, color: 'amber', text: 'WARNING' };
  }
  return { icon: ShieldCheck, color: 'green', text: 'SAFE' };
};


const _getStatusBannerClasses = (color: string): string => {
  switch (color) {
    case 'green':
      return 'bg-primary/10 border-primary/20';
    case 'amber':
      return 'bg-muted border-border';
    case 'red':
      return 'bg-destructive/10 border-destructive/20';
    default:
      return 'bg-muted border-border';
  }
};


const _getStatusIconClasses = (color: string): string => {
  switch (color) {
    case 'green':
      return 'text-primary';
    case 'amber':
      return 'text-muted-foreground';
    case 'red':
      return 'text-destructive';
    default:
      return 'text-muted-foreground';
  }
};


const _getSeverityBadgeClasses = (severity: string): string => {
  const severityLower = severity.toLowerCase();
  switch (severityLower) {
    case 'critical':
      return 'bg-red-500/10 text-red-700 dark:text-red-400';
    case 'high':
      return 'bg-muted text-muted-foreground';
    case 'medium':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-primary/10 text-primary dark:text-primary';
  }
};


const SecurityScanModal: React.FC<SecurityScanModalProps> = ({
  resourceName,
  resourceType,
  isOpen,
  onClose,
  loading,
  scanResult,
  onRescan,
  canRescan,
  onShowToast,
}) => {
  const [showRawJson, setShowRawJson] = useState(false);
  const [expandedAnalyzers, setExpandedAnalyzers] = useState<Set<string>>(new Set());
  const [rescanning, setRescanning] = useState(false);

  const toggleAnalyzer = (analyzer: string) => {
    const newExpanded = new Set(expandedAnalyzers);
    if (newExpanded.has(analyzer)) {
      newExpanded.delete(analyzer);
    } else {
      newExpanded.add(analyzer);
    }
    setExpandedAnalyzers(newExpanded);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(scanResult, null, 2));
      onShowToast?.('Security scan results copied to clipboard!', 'success');
    } catch (error) {
      console.error('Failed to copy:', error);
      onShowToast?.('Failed to copy results', 'error');
    }
  };

  const handleRescan = async () => {
    if (!onRescan || rescanning) return;
    setRescanning(true);
    try {
      await onRescan();
      onShowToast?.('Security scan completed', 'success');
    } catch (error) {
      onShowToast?.('Failed to rescan', 'error');
    } finally {
      setRescanning(false);
    }
  };

  const statusInfo = _getStatusInfo(scanResult);
  const StatusIcon = statusInfo.icon;

  const severityItems = [
    { label: 'CRITICAL', count: scanResult?.critical_issues ?? 0, key: 'critical' },
    { label: 'HIGH', count: scanResult?.high_severity ?? 0, key: 'high' },
    { label: 'MEDIUM', count: scanResult?.medium_severity ?? 0, key: 'medium' },
    { label: 'LOW', count: scanResult?.low_severity ?? 0, key: 'low' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-auto bg-card p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Security Scan Results - {resourceName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading scan results...</span>
          </div>
        ) : !scanResult ? (
          <div className="text-center py-12">
            <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No security scan results available for this {resourceType}.
            </p>
            {canRescan && onRescan && (
              <Button
                onClick={handleRescan}
                disabled={rescanning}
                className="mt-4 bg-primary hover:bg-primary/90 text-white"
              >
                {rescanning ? 'Scanning...' : 'Run Security Scan'}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall Status */}
            <div className={`p-4 rounded-lg border ${_getStatusBannerClasses(statusInfo.color)}`}>
              <div className="flex items-center gap-3">
                <StatusIcon className={`h-8 w-8 ${_getStatusIconClasses(statusInfo.color)}`} />
                <div>
                  <div className="font-semibold text-foreground">
                    Overall Status: {statusInfo.text}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Scanned: {new Date(scanResult.scan_timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
              {scanResult.scan_failed && scanResult.error_message && (
                <div className="mt-3 p-3 bg-destructive/10 rounded text-sm text-destructive">
                  Error: {scanResult.error_message}
                </div>
              )}
            </div>

            {/* Severity Summary */}
            <div>
              <h4 className="font-medium text-foreground mb-3">Severity Summary</h4>
              <div className="grid grid-cols-4 gap-3">
                {severityItems.map((item) => (
                  <div
                    key={item.key}
                    className={`p-3 rounded-lg border text-center ${SEVERITY_BOX_STYLES[item.key]}`}
                  >
                    <div className="text-xs font-medium opacity-75">{item.label}</div>
                    <div className="text-2xl font-bold">{item.count}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Analyzers Used */}
            {scanResult.analyzers_used && scanResult.analyzers_used.length > 0 && (
              <div>
                <h4 className="font-medium text-foreground mb-3">Analyzers Used</h4>
                <div className="flex flex-wrap gap-2">
                  {scanResult.analyzers_used.map((analyzer) => (
                    <span
                      key={analyzer}
                      className="px-3 py-1 bg-muted text-foreground rounded-full text-sm font-medium"
                    >
                      {analyzer.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Findings */}
            {scanResult.raw_output && scanResult.raw_output.analysis_results && (
              <div>
                <h4 className="font-medium text-foreground mb-3">Detailed Findings</h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  {Object.entries(scanResult.raw_output.analysis_results).map(([analyzer, analyzerData]) => {
                    // Handle both formats: direct array or object with findings property
                    const findings = Array.isArray(analyzerData)
                      ? analyzerData
                      : (analyzerData as any)?.findings || [];
                    const findingsCount = Array.isArray(findings) ? findings.length : 0;

                    return (
                      <div key={analyzer} className="border-b border-border last:border-b-0">
                        <button
                          onClick={() => toggleAnalyzer(analyzer)}
                          className="w-full flex items-center justify-between p-3 hover:bg-accent transition-colors"
                          aria-expanded={expandedAnalyzers.has(analyzer)}
                        >
                          <span className="font-medium text-foreground">
                            {analyzer.charAt(0).toUpperCase() + analyzer.slice(1).replace(/_/g, ' ')} Analysis
                            <span className="ml-2 text-sm text-muted-foreground">
                              ({findingsCount} finding{findingsCount !== 1 ? 's' : ''})
                            </span>
                          </span>
                          {expandedAnalyzers.has(analyzer) ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                        </button>
                        {/* Always show finding summaries - collapsed shows preview, expanded shows full details */}
                        {Array.isArray(findings) && findings.length > 0 && !expandedAnalyzers.has(analyzer) && (
                          <div className="px-3 pb-3">
                            <div className="space-y-2">
                              {findings.map((finding: any, idx: number) => {
                                // Try multiple possible field names for the description
                                const description = finding.threat_summary
                                  || finding.description
                                  || finding.message
                                  || finding.detail
                                  || finding.reason
                                  || (finding.threat_names && finding.threat_names.length > 0
                                    ? finding.threat_names.join(', ')
                                    : null);
                                const title = finding.title || finding.tool_name || finding.skill_name || finding.name || finding.rule_id;

                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-2 bg-muted rounded border border-border"
                                  >
                                    <span className="text-sm text-foreground">
                                      {title || description || 'Finding'}
                                      {description && title && (
                                        <span className="text-muted-foreground ml-2">
                                          - {description.length > 60
                                            ? description.substring(0, 60) + '...'
                                            : description}
                                        </span>
                                      )}
                                      {!title && description && description.length > 80 && (
                                        <span className="text-muted-foreground">...</span>
                                      )}
                                    </span>
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${_getSeverityBadgeClasses(finding.severity)}`}>
                                      {finding.severity}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {expandedAnalyzers.has(analyzer) && (
                          <div className="p-3 bg-muted border-t border-border">
                            {Array.isArray(findings) && findings.length > 0 ? (
                              <div className="space-y-3">
                                {findings.map((finding: any, idx: number) => {
                                  const findingTitle = finding.title || finding.tool_name || finding.skill_name || finding.name || 'Finding';
                                  const findingDesc = finding.description || finding.threat_summary || finding.message;

                                  return (
                                    <div
                                      key={idx}
                                      className="p-3 bg-card rounded border border-border"
                                    >
                                      <div className="flex items-start justify-between mb-2">
                                        <span className="font-medium text-foreground">
                                          {findingTitle}
                                        </span>
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${_getSeverityBadgeClasses(finding.severity)}`}>
                                          {finding.severity}
                                        </span>
                                      </div>
                                      {findingDesc && (
                                        <p className="text-sm text-muted-foreground mb-2">
                                          {findingDesc}
                                        </p>
                                      )}
                                      {finding.remediation && (
                                        <p className="text-sm text-primary mb-2">
                                          <span className="font-medium">Fix: </span>{finding.remediation}
                                        </p>
                                      )}
                                      {finding.file_path && (
                                        <p className="text-xs text-muted-foreground">
                                          {finding.file_path}{finding.line_number ? `:${finding.line_number}` : ''}
                                        </p>
                                      )}
                                      {finding.threat_names && finding.threat_names.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {finding.threat_names.map((threat: string, tidx: number) => (
                                            <span
                                              key={tidx}
                                              className="px-2 py-0.5 text-xs bg-muted text-foreground rounded"
                                            >
                                              {threat}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-muted-foreground text-sm">
                                No findings from this analyzer.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Raw JSON Toggle */}
            <div>
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="text-sm text-primary hover:underline"
              >
                {showRawJson ? 'Hide' : 'View'} Raw JSON
              </button>
              {showRawJson && (
                <pre className="mt-2 p-4 bg-muted border border-border rounded-lg overflow-x-auto text-xs text-foreground max-h-[30vh] overflow-y-auto">
                  {JSON.stringify(scanResult, null, 2)}
                </pre>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button
                variant="ghost"
                onClick={handleCopy}
                className="flex items-center gap-2 text-foreground"
              >
                <ClipboardList className="h-4 w-4" />
                Copy Results
              </Button>
              {canRescan && onRescan && (
                <Button
                  onClick={handleRescan}
                  disabled={rescanning}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white"
                >
                  <RefreshCw className={`h-4 w-4 ${rescanning ? 'animate-spin' : ''}`} />
                  {rescanning ? 'Scanning...' : 'Rescan'}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SecurityScanModal;
