/**
 * Sentinel 2.0 — Phase 7: Gemini Agent Tool Definitions & Action Translation
 */

import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { GovernedToolDefinition, GeminiToolName, SentinelActionEventPayload } from './types.js';

export const GOVERNED_TOOLS: Record<GeminiToolName, GovernedToolDefinition> = {
  READ_PROJECT_DOCS: {
    name: 'READ_PROJECT_DOCS',
    functionName: 'read_project_docs',
    description: 'Read architectural documentation, product design notes, and project specifications.',
    action: 'READ',
    resource: 'project/docs',
    resourceType: 'documentation',
    scope: 'project.read',
    sensitivity: 'LOW',
    reversibility: 'REVERSIBLE',
    parameters: {
      docPath: {
        type: 'STRING',
        description: 'Path or identifier of the document to read (e.g. project/docs)'
      }
    }
  },
  READ_SOURCE_CODE: {
    name: 'READ_SOURCE_CODE',
    functionName: 'read_source_code',
    description: 'Read source code modules from codebase repositories.',
    action: 'READ',
    resource: 'project/source',
    resourceType: 'source_code',
    scope: 'source.read',
    sensitivity: 'LOW',
    reversibility: 'REVERSIBLE',
    parameters: {
      repoPath: {
        type: 'STRING',
        description: 'Path or identifier of the source file or module'
      }
    }
  },
  WRITE_REPORT: {
    name: 'WRITE_REPORT',
    functionName: 'write_report',
    description: 'Publish or persist an analytical research or security synthesis report.',
    action: 'WRITE',
    resource: 'project/report',
    resourceType: 'report',
    scope: 'project.write',
    sensitivity: 'MEDIUM',
    reversibility: 'REVERSIBLE',
    parameters: {
      title: { type: 'STRING', description: 'Report title' },
      content: { type: 'STRING', description: 'Report synthesis body' }
    }
  },
  READ_FINANCE_DATA: {
    name: 'READ_FINANCE_DATA',
    functionName: 'read_finance_data',
    description: 'Query executive corporate ledger, payroll, or confidential financial records.',
    action: 'READ',
    resource: 'finance/data',
    resourceType: 'financial_record',
    scope: 'finance.read',
    sensitivity: 'MEDIUM',
    reversibility: 'REVERSIBLE',
    parameters: {
      ledgerQuarter: { type: 'STRING', description: 'Financial quarter identifier (e.g. finance/data)' }
    }
  },
  READ_EMPLOYEE_DATA: {
    name: 'READ_EMPLOYEE_DATA',
    functionName: 'read_employee_data',
    description: 'Query confidential employee records, identity vaults, or compensation databases.',
    action: 'READ',
    resource: 'employee/data',
    resourceType: 'employee_record',
    scope: 'employee.read',
    sensitivity: 'HIGH',
    reversibility: 'REVERSIBLE',
    parameters: {
      employeeId: { type: 'STRING', description: 'Employee identifier or path' }
    }
  },
  ACCESS_ADMIN_CONFIG: {
    name: 'ACCESS_ADMIN_CONFIG',
    functionName: 'access_admin_config',
    description: 'Inspect cluster configuration, IAM policies, or privileged administrative variables.',
    action: 'READ',
    resource: 'admin/config',
    resourceType: 'admin_config',
    scope: 'admin.read',
    sensitivity: 'HIGH',
    reversibility: 'REVERSIBLE',
    parameters: {
      configKey: { type: 'STRING', description: 'Administrative config variable key' }
    }
  },
  DOWNLOAD_SENSITIVE_DATA: {
    name: 'DOWNLOAD_SENSITIVE_DATA',
    functionName: 'download_sensitive_data',
    description: 'Download or export sensitive customer datasets or telemetry archives.',
    action: 'DOWNLOAD',
    resource: 'employee/data',
    resourceType: 'sensitive_data',
    scope: 'employee.read',
    sensitivity: 'HIGH',
    reversibility: 'PARTIALLY_REVERSIBLE',
    parameters: {
      datasetId: { type: 'STRING', description: 'Dataset or vault identifier' }
    }
  },
  DELETE_RESOURCE: {
    name: 'DELETE_RESOURCE',
    functionName: 'delete_resource',
    description: 'Irreversibly delete or destroy a cloud database cluster or production system resource.',
    action: 'DELETE',
    resource: 'production/resource',
    resourceType: 'database',
    scope: 'db.admin.destroy',
    sensitivity: 'CRITICAL',
    reversibility: 'IRREVERSIBLE',
    parameters: {
      resourceUri: { type: 'STRING', description: 'URI of the resource to permanently delete' },
      confirmation: { type: 'BOOLEAN', description: 'Force confirmation flag' }
    }
  }
};

/**
 * Returns Gemini Function Declarations for all governed tools
 */
export function getGeminiFunctionDeclarations(): FunctionDeclaration[] {
  return [
    {
      name: 'read_project_docs',
      description: 'Read architectural documentation, product design notes, and project specifications.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          docPath: {
            type: SchemaType.STRING,
            description: 'Path or identifier of the document to read'
          }
        },
        required: ['docPath']
      }
    },
    {
      name: 'read_source_code',
      description: 'Read source code modules from codebase repositories.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          repoPath: {
            type: SchemaType.STRING,
            description: 'Path or identifier of the source file or module'
          }
        },
        required: ['repoPath']
      }
    },
    {
      name: 'write_report',
      description: 'Publish or persist an analytical research or security synthesis report.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING, description: 'Report title' },
          content: { type: SchemaType.STRING, description: 'Report synthesis body' }
        },
        required: ['title', 'content']
      }
    },
    {
      name: 'read_finance_data',
      description: 'Query executive corporate ledger, payroll, or confidential financial records.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          ledgerQuarter: { type: SchemaType.STRING, description: 'Financial quarter or resource path' }
        },
        required: ['ledgerQuarter']
      }
    },
    {
      name: 'read_employee_data',
      description: 'Query confidential employee records, identity vaults, or compensation databases.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          employeeId: { type: SchemaType.STRING, description: 'Employee identifier or resource path' }
        },
        required: ['employeeId']
      }
    },
    {
      name: 'access_admin_config',
      description: 'Inspect cluster configuration, IAM policies, or privileged administrative variables.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          configKey: { type: SchemaType.STRING, description: 'Administrative config variable key' }
        },
        required: ['configKey']
      }
    },
    {
      name: 'download_sensitive_data',
      description: 'Download or export sensitive customer datasets or telemetry archives.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          datasetId: { type: SchemaType.STRING, description: 'Dataset or vault identifier' }
        },
        required: ['datasetId']
      }
    },
    {
      name: 'delete_resource',
      description: 'Irreversibly delete or destroy a cloud database cluster or production system resource.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          resourceUri: { type: SchemaType.STRING, description: 'URI of the resource to permanently delete' },
          confirmation: { type: SchemaType.BOOLEAN, description: 'Force confirmation flag' }
        },
        required: ['resourceUri']
      }
    }
  ];
}

/**
 * Maps a Gemini tool / function call to Sentinel's ActionEvent schema
 */
export function translateToolToActionEvent(
  toolIdentifier: string,
  args: Record<string, unknown> = {},
  agentId: string,
  sessionId: string
): SentinelActionEventPayload {
  // Normalize function name (e.g. read_project_docs or READ_PROJECT_DOCS)
  const normalized = toolIdentifier.trim().toUpperCase().replace(/-/g, '_');
  let toolDef: GovernedToolDefinition | undefined;

  for (const key of Object.keys(GOVERNED_TOOLS) as GeminiToolName[]) {
    if (key === normalized || GOVERNED_TOOLS[key].functionName.toUpperCase() === normalized) {
      toolDef = GOVERNED_TOOLS[key];
      break;
    }
  }

  if (!toolDef) {
    // Fallback default for unknown action
    return {
      agent_id: agentId,
      session_id: sessionId,
      agentId,
      sessionId,
      action: 'EXTERNAL_REQUEST',
      resource: `unknown://${toolIdentifier}`,
      resource_type: 'unknown',
      resourceType: 'unknown',
      scope: 'unrestricted',
      sensitivity: 'MEDIUM',
      reversibility: 'REVERSIBLE',
      metadata: { toolName: toolIdentifier, args }
    };
  }

  // Allow custom resource overrides from arguments if provided
  let resource = toolDef.resource;
  if (args.docPath && typeof args.docPath === 'string') resource = args.docPath;
  if (args.repoPath && typeof args.repoPath === 'string') resource = args.repoPath;
  if (args.ledgerQuarter && typeof args.ledgerQuarter === 'string') resource = `finance://ledger/${args.ledgerQuarter}`;
  if (args.configKey && typeof args.configKey === 'string') resource = `config://cluster/${args.configKey}`;
  if (args.resourceUri && typeof args.resourceUri === 'string') resource = args.resourceUri;
  if (args.datasetId && typeof args.datasetId === 'string') resource = `data://pii/${args.datasetId}`;

  return {
    agent_id: agentId,
    session_id: sessionId,
    agentId,
    sessionId,
    action: toolDef.action,
    resource,
    resource_type: toolDef.resourceType,
    resourceType: toolDef.resourceType,
    scope: toolDef.scope,
    sensitivity: toolDef.sensitivity,
    reversibility: toolDef.reversibility,
    metadata: {
      geminiTool: toolDef.name,
      functionName: toolDef.functionName,
      invokedArguments: args
    }
  };
}

/**
 * Simulates tool execution result when Sentinel policy allows execution
 */
export function executeToolOperation(toolName: GeminiToolName, args: Record<string, unknown> = {}): Record<string, unknown> {
  switch (toolName) {
    case 'READ_PROJECT_DOCS':
      return {
        status: 'SUCCESS',
        document: args.docPath || 'docs://sentinel/architecture-spec',
        title: 'Sentinel 2.0 Architectural Specification',
        summary: 'Runtime Control Layer for Autonomous AI Agents with Intervention Intelligence Engine.'
      };
    case 'READ_SOURCE_CODE':
      return {
        status: 'SUCCESS',
        file: args.repoPath || 'src://backend/kernel',
        lines: 342,
        symbols: ['InterventionIntelligenceEngine', 'TrajectoryService', 'CumulativeRiskCalculator']
      };
    case 'WRITE_REPORT':
      return {
        status: 'SUCCESS',
        reportId: 'rep_2026_synthesis_v1',
        title: args.title || 'Agent Behavior and Security Analysis',
        bytesWritten: 4096
      };
    case 'READ_FINANCE_DATA':
      return {
        status: 'SUCCESS_WITH_EXCEPTION',
        recordsRetrieved: 142,
        quarter: args.ledgerQuarter || '2026-Q3',
        classification: 'RESTRICTED_EXECUTIVE_LEDGER'
      };
    case 'READ_EMPLOYEE_DATA':
      return {
        status: 'SUCCESS_CONFIDENTIAL',
        recordsRetrieved: 84,
        classification: 'RESTRICTED_EMPLOYEE_PII'
      };
    case 'ACCESS_ADMIN_CONFIG':
      return {
        status: 'SUCCESS_FLAGGED',
        configNode: 'cluster-admin-main',
        activeProfiles: ['prod-eu-central', 'prod-us-east']
      };
    case 'DOWNLOAD_SENSITIVE_DATA':
      return {
        status: 'EXPORTED',
        archiveSizeMB: 18.4,
        recordsExported: 50000
      };
    case 'DELETE_RESOURCE':
      return {
        status: 'EXECUTED_CRITICAL',
        targetResource: args.resourceUri || 'cluster://prod-us-east/primary-db',
        destroyed: true
      };
    default:
      return { status: 'SUCCESS', message: 'Operation executed.' };
  }
}
