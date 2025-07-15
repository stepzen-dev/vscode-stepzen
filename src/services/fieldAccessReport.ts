/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import { FieldPolicyParser } from "./fieldPolicyParser";
import { SchemaIndexService } from "./SchemaIndexService";
import { FieldPolicy } from "../types/fieldPolicy";

export interface FieldAccessReport {
  summary: {
    totalRootFields: number;
    accessibleRootFields: number;
    protectedRootFields: number;
    totalCustomTypes: number;
    customTypesWithPolicies: number;
  };
  rootTypeAccess: {
    [typeName: string]: Array<{
      field: string;
      access: "allowed" | "denied";
      ruleName: string | null;
      condition: string;
      reason: string;
    }>;
  };
  customTypeAccess: {
    [typeName: string]: {
      hasPolicy: boolean;
      accessPaths: Array<{
        rootField: string;
        status: "accessible" | "blocked";
        reason: string;
        ruleName: string | null;
        condition: string;
        path?: string[];
      }>;
      effectiveAccess: "blocked" | "controlled" | "inherited";
      fields: Array<{
        field: string;
        access: "inherited" | "controlled";
        ruleName: string | null;
        condition: string | null;
        reason: string;
      }>;
    };
  };
}

const ROOT_TYPES = new Set(["Query", "Mutation", "Subscription"]);
const BUILTIN_GRAPHQL_FIELDS = new Set(["__type", "__schema", "__typename", "_service"]);

// Utility: Compute all access paths from root fields to each type
function computeTypeAccessPaths(fieldIndex: Record<string, Array<{ name: string; type: string }>>, rootTypeFields: Record<string, Array<{ name: string; type: string }>>, rootTypeAccess: any) {
  // For each type, collect all root field paths that can reach it
  const pathsByType: Record<string, Array<{ rootField: string; path: string[]; status: string; reason: string; ruleName: string | null; condition: string }>> = {};
  // Helper: DFS traversal
  function dfs(currentType: string, path: string[], visited: Set<string>, rootField: string, rootFieldAccess: any) {
    if (visited.has(currentType)) {return;}
    visited.add(currentType);
    // Record this path for the type (but skip the root type itself)
    if (path.length >= 1) {
      const typeName = currentType;
      if (!pathsByType[typeName]) {pathsByType[typeName] = [];}
      // The root field access info
      const rootAccess = rootFieldAccess;
      pathsByType[typeName].push({
        rootField,
        path: [...path],
        status: (rootAccess.access === 'allowed' ? 'accessible' : 'blocked') as 'accessible' | 'blocked',
        reason: rootAccess.reason,
        ruleName: rootAccess.ruleName,
        condition: rootAccess.condition
      });
    }
    // Traverse fields of this type
    const fields = fieldIndex[currentType] || [];
    for (const field of fields) {
      if (fieldIndex[field.type]) {
        dfs(field.type, [...path, field.name], visited, rootField, rootFieldAccess);
      }
    }
    visited.delete(currentType);
  }
  // For each root type and field
  for (const rootTypeName of Object.keys(rootTypeFields)) {
    const rootFields = rootTypeFields[rootTypeName];
    for (const rootField of rootFields) {
      const rootAccess = rootTypeAccess[rootTypeName]?.find((f: any) => f.field === rootField.name);
      if (!rootAccess) {continue;}
      // Start DFS from the return type of the root field
      dfs(rootField.type, [rootTypeName + '.' + rootField.name], new Set([rootTypeName]), rootTypeName + '.' + rootField.name, rootAccess);
    }
  }
  return pathsByType;
}

export async function generateFieldAccessReportData(
  schemaIndex: SchemaIndexService,
  policyParser: FieldPolicyParser,
  configContent: string
): Promise<FieldAccessReport> {
  // Parse policies
  const parseResult = await policyParser.parse(configContent);
  const policies = parseResult.policies;
  const policyMap: Record<string, FieldPolicy> = {};
  for (const policy of policies) {
    policyMap[policy.type] = policy;
  }

  // Get all types and fields from schema
  const fieldIndex = schemaIndex.getFieldIndex();
  
  // Separate root types from custom types
  const rootTypeFields: Record<string, Array<{ name: string; type: string }>> = {};
  const customTypeFields: Record<string, Array<{ name: string; type: string }>> = {};
  
  for (const typeName of Object.keys(fieldIndex).sort()) {
    const fields = fieldIndex[typeName];
    if (ROOT_TYPES.has(typeName)) {
      rootTypeFields[typeName] = fields;
    } else {
      customTypeFields[typeName] = fields;
    }
  }

  // Generate root type access report
  const rootTypeAccess: FieldAccessReport["rootTypeAccess"] = {};
  let totalRootFields = 0;

  for (const typeName of Object.keys(rootTypeFields)) {
    const fields = rootTypeFields[typeName];
    const typeAccess: FieldAccessReport["rootTypeAccess"][string] = [];
    
    for (const field of fields) {
      totalRootFields++;
      let access: "allowed" | "denied" = "allowed";
      let ruleName: string | null = null;
      let condition = "";
      let reason = "";

      // Built-in GraphQL fields are always accessible for introspection
      if (BUILTIN_GRAPHQL_FIELDS.has(field.name)) {
        access = "allowed";
        condition = "true";
        reason = "Built-in GraphQL field: always accessible for introspection";
      } else {
        const policy = policyMap[typeName];
        if (!policies.length) {
          // No policies at all: all fields accessible
          access = "allowed";
          condition = "true";
          reason = "No field policies defined: all fields accessible";
        } else if (!policy) {
          // Policies exist, but not for this root type
          access = "denied";
          condition = "false";
          reason = `No policy for root type ${typeName}: denied by default`;
        } else {
          // Policy exists for this root type
          // Check if a rule exists for this field
          const rule = policy.rules.find(r => r.fields.includes(field.name));
          if (rule) {
            // Use the rule's condition to determine access
            ruleName = rule.name;
            condition = rule.condition;
            if (rule.condition === "true") {
              access = "allowed";
              reason = `Rule: ${rule.name}`;
            } else {
              access = "denied";
              reason = `Rule: ${rule.name} (condition: ${rule.condition})`;
            }
          } else {
            // No rule found, deny by default
            access = "denied";
            condition = policy && policy.policyDefault ? policy.policyDefault.condition : "false";
            if (policy && policy.policyDefault) {
              reason = `Policy default: denied (condition: ${policy.policyDefault.condition})`;
            } else {
              reason = `No rule found for field ${field.name} in policy for root type ${typeName}: denied by default`;
            }
          }
        }
      }
      typeAccess.push({
        field: field.name,
        access: access,
        ruleName: ruleName,
        condition: condition,
        reason: reason
      });
    }
    rootTypeAccess[typeName] = typeAccess;
  }

  // Compute access paths for all types
  const accessPathsByType = computeTypeAccessPaths(fieldIndex, rootTypeFields, rootTypeAccess);

  // Generate custom type access report
  const customTypeAccess: FieldAccessReport["customTypeAccess"] = {};
  let totalCustomTypes = Object.keys(customTypeFields).length;
  let customTypesWithPolicies = 0;

  for (const typeName of Object.keys(customTypeFields)) {
    const fields = customTypeFields[typeName];
    const policy = policyMap[typeName];
    const hasPolicy = !!policy;
    
    if (hasPolicy) {
      customTypesWithPolicies++;
    }

    // Find all root fields that return this type
    const accessPaths = (accessPathsByType[typeName] || []).map(p => ({
      rootField: p.rootField,
      status: p.status as "accessible" | "blocked",
      reason: p.reason,
      ruleName: p.ruleName,
      condition: p.condition
    }));

    // Determine effective access for the type
    let effectiveAccess: "blocked" | "controlled" | "inherited";
    if (hasPolicy) {
      effectiveAccess = "controlled";
    } else if (accessPaths.every(path => path.status === "blocked")) {
      effectiveAccess = "blocked";
    } else {
      effectiveAccess = "inherited";
    }

    // Generate field access for this type
    const typeFields: Array<{
      field: string;
      access: "inherited" | "controlled";
      ruleName: string | null;
      condition: string | null;
      reason: string;
    }> = [];

    for (const field of fields) {
      let access: "inherited" | "controlled" = "inherited";
      let ruleName: string | null = null;
      let condition: string | null = null;
      let reason = "";

      if (hasPolicy) {
        // Check if a rule exists for this field
        const rule = policy!.rules.find(r => r.fields.includes(field.name));
        if (rule) {
          access = "controlled";
          ruleName = rule.name;
          condition = rule.condition;
          reason = `Rule: ${rule.name}`;
        } else {
          access = "controlled";
          condition = policy!.policyDefault.condition;
          reason = `Policy default: ${policy!.policyDefault.condition === "true" ? "allowed" : "denied"} (condition: ${policy!.policyDefault.condition})`;
        }
      } else {
        reason = "No policy - access depends on root type access";
      }

      typeFields.push({
        field: field.name,
        access,
        ruleName,
        condition,
        reason
      });
    }

    customTypeAccess[typeName] = {
      hasPolicy,
      accessPaths,
      effectiveAccess,
      fields: typeFields
    };
  }

  // Calculate summary
  const summary: FieldAccessReport["summary"] = {
    totalRootFields: totalRootFields,
    accessibleRootFields: Object.values(rootTypeAccess).reduce((sum, typeAccess) => sum + typeAccess.filter(f => f.access === 'allowed').length, 0),
    protectedRootFields: Object.values(rootTypeAccess).reduce((sum, typeAccess) => sum + typeAccess.filter(f => f.access === 'denied').length, 0),
    totalCustomTypes: totalCustomTypes,
    customTypesWithPolicies: customTypesWithPolicies
  };

  return {
    summary: summary,
    rootTypeAccess: rootTypeAccess,
    customTypeAccess: customTypeAccess
  };
}