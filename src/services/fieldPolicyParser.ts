/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as yaml from "js-yaml";
import {
  FieldPolicy,
  FieldPolicyParseResult,
  PolicyValidationError,
  PolicyConflict,
  PolicyCoverageAnalysis,
  TypeCoverage,
  PredicateAnalysis,
} from "../types/fieldPolicy";

export class FieldPolicyParser {
  /**
   * Parse a config.yaml file and extract field policies
   */
  async parse(configContent: string): Promise<FieldPolicyParseResult> {
    const errors: PolicyValidationError[] = [];
    const conflicts: PolicyConflict[] = [];
    let policies: FieldPolicy[] = [];

    try {
      // Parse YAML
      const config = yaml.load(configContent) as any;
      
      if (!config.access?.policies) {
        return {
          isValid: true,
          policies: [],
          errors: [],
          conflicts: []
        };
      }

      // Parse each policy
      for (const policyConfig of config.access.policies) {
        const policy = this.parsePolicy(policyConfig);
        if (policy) {
          policies.push(policy);
        }
      }

      // Validate policies
      const validationErrors = this.validatePolicies(policies);
      errors.push(...validationErrors);

      // Detect conflicts
      const policyConflicts = this.detectConflicts(policies);
      conflicts.push(...policyConflicts);

    } catch (error) {
      errors.push({
        message: `YAML parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'syntax'
      });
    }

    return {
      isValid: errors.length === 0,
      policies,
      errors,
      conflicts
    };
  }

  /**
   * Parse a single policy configuration
   */
  private parsePolicy(policyConfig: any): FieldPolicy | null {
    if (!policyConfig.type) {
      return null;
    }

    const rules = (policyConfig.rules || []).map((rule: any) => ({
      condition: String(rule.condition || "false"),
      name: rule.name || "unnamed rule",
      fields: rule.fields || []
    }));

    const policyDefault = {
      condition: String(policyConfig.policyDefault?.condition || "false")
    };

    return {
      type: policyConfig.type,
      rules,
      policyDefault
    };
  }

  /**
   * Validate policy syntax and structure
   */
  private validatePolicies(policies: FieldPolicy[]): PolicyValidationError[] {
    const errors: PolicyValidationError[] = [];

    for (const policy of policies) {
      // Validate policy default
      if (!this.validatePredicate(policy.policyDefault.condition)) {
        errors.push({
          message: `Invalid policy default condition: ${policy.policyDefault.condition}`,
          type: 'syntax'
        });
      }

      // Validate rules
      for (const rule of policy.rules) {
        const isValid = this.validatePredicate(rule.condition);
        if (!isValid) {
          errors.push({
            message: `Invalid condition in rule '${rule.name}': ${rule.condition}`,
            type: 'syntax'
          });
        }

        // Validate field names
        for (const field of rule.fields) {
          if (!this.isValidGraphQLIdentifier(field)) {
            errors.push({
              message: `Invalid field name: ${field}`,
              type: 'syntax'
            });
          }
        }
      }
    }

    return errors;
  }

  /**
   * Detect conflicts between policies
   */
  private detectConflicts(policies: FieldPolicy[]): PolicyConflict[] {
    const conflicts: PolicyConflict[] = [];

    for (const policy of policies) {
      const fieldRules = new Map<string, string[]>();

      // Collect all rules for each field
      for (const rule of policy.rules) {
        for (const field of rule.fields) {
          if (!fieldRules.has(field)) {
            fieldRules.set(field, []);
          }
          fieldRules.get(field)!.push(rule.name);
        }
      }

      // Check for field conflicts
      for (const [field, ruleNames] of fieldRules) {
        if (ruleNames.length > 1) {
          conflicts.push({
            type: 'field_conflict',
            field,
            rule1: ruleNames[0],
            rule2: ruleNames[1],
            message: `Field '${field}' is covered by multiple rules: ${ruleNames.join(', ')}`
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Validate predicate syntax (robust, supports logical operators and variables)
   */
  validatePredicate(predicate: string): boolean {
    if (!predicate || typeof predicate !== 'string') {
      return false;
    }

    // Simple predicates
    if (predicate === 'true' || predicate === 'false') {
      return true;
    }

    // Existence checks
    if (/^\?\$jwt(\.[a-zA-Z0-9_\/]+)?$/.test(predicate.trim())) {
      return true;
    }

    // Logical operators: split on '||' or '&&' and validate each side recursively
    const logicalSplit = predicate.match(/\|\||&&/);
    if (logicalSplit) {
      // Split on the first logical operator found
      const op = logicalSplit[0];
      const [left, right] = predicate.split(op);
      return this.validatePredicate(left.trim()) && this.validatePredicate(right.trim());
    }

    // JWT claim comparison with double quotes (StepZen syntax)
    // e.g. $jwt.role:String == "admin"
    // e.g. $jwt.userId:String == $variables.userId:String
    // e.g. $jwt.groups:String has "admin"
    const jwtComparePattern = /\$jwt\.[^:]+:[A-Za-z]+\s*(==|!=|<|<=|>|>=|has)\s*("[^"]*"|\$variables\.[a-zA-Z_][a-zA-Z0-9_]*:[A-Za-z]+)/;
    if (jwtComparePattern.test(predicate)) {
      return true;
    }

    // JWT claim comparison with single quotes (legacy support)
    // e.g. $jwt.role:String == 'admin'
    const jwtComparePatternSingle = /\$jwt\.[^:]+:[A-Za-z]+\s*(==|!=|<|<=|>|>=|has)\s*('[^']*'|\$variables\.[a-zA-Z_][a-zA-Z0-9_]*:[A-Za-z]+)/;
    if (jwtComparePatternSingle.test(predicate)) {
      return true;
    }

    // Check for common JWT patterns that are missing parts
    // e.g. $jwt.role (missing type annotation)
    const incompleteJwtPattern = /\$jwt\.[^:]+$/;
    if (incompleteJwtPattern.test(predicate)) {
      return false;
    }

    // Check for unquoted string literals
    // e.g. $jwt.role:String == admin (admin should be quoted)
    const unquotedStringPattern = /\$jwt\.[^:]+:[A-Za-z]+\s*(==|!=|<|<=|>|>=|has)\s+([a-zA-Z_][a-zA-Z0-9_]*)(?!\s*['"$])/;
    if (unquotedStringPattern.test(predicate)) {
      return false;
    }

    // $variables comparison (rare, but possible)
    const varComparePattern = /\$variables\.[a-zA-Z_][a-zA-Z0-9_]*:[A-Za-z]+\s*(==|!=|<|<=|>|>=|has)\s*("[^"]*"|'[^']*'|\$jwt\.[^:]+:[A-Za-z]+)/;
    if (varComparePattern.test(predicate)) {
      return true;
    }

    // Introspection fields (e.g. __type, __schema, __typename)
    if (/^__type$|^__schema$|^__typename$|^_service$/.test(predicate.trim())) {
      return true;
    }

    // Fallback: not valid
    return false;
  }

  /**
   * Extract JWT claims from a predicate
   */
  extractJwtClaims(predicate: string): string[] {
    const claims: string[] = [];
    const jwtPattern = /\$jwt\.([^:]+):/g;
    let match;

    while ((match = jwtPattern.exec(predicate)) !== null) {
      claims.push(match[1]);
    }

    return claims;
  }

  /**
   * Analyze predicate structure
   */
  analyzePredicate(predicate: string): PredicateAnalysis {
    const analysis: PredicateAnalysis = {
      isValid: this.validatePredicate(predicate),
      claims: [],
      variables: [],
      operators: [],
      errors: []
    };

    if (!analysis.isValid) {
      analysis.errors.push("Invalid predicate syntax");
      return analysis;
    }

    // Extract JWT claims
    const claims = this.extractJwtClaims(predicate);
    analysis.claims = claims.map(claim => ({
      path: claim,
      type: this.extractClaimType(predicate, claim)
    }));

    // Extract variables
    const variablePattern = /\$variables\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let match;
    while ((match = variablePattern.exec(predicate)) !== null) {
      analysis.variables.push(match[1]);
    }

    // Extract operators
    const operators = ['==', '!=', '<', '<=', '>', '>=', 'has', '||', '&&'];
    for (const op of operators) {
      if (predicate.includes(op)) {
        analysis.operators.push(op);
      }
    }

    return analysis;
  }

  /**
   * Extract claim type from predicate
   */
  private extractClaimType(predicate: string, claim: string): string {
    const pattern = new RegExp(`\\$jwt\\.${claim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:([A-Za-z]+)`);
    const match = predicate.match(pattern);
    return match ? match[1] : 'String';
  }

  /**
   * Check if a string is a valid GraphQL identifier
   */
  private isValidGraphQLIdentifier(identifier: string): boolean {
    // GraphQL identifiers must start with a letter or underscore
    // and contain only letters, digits, and underscores
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier);
  }

  /**
   * Analyze policy coverage
   */
  analyzeCoverage(policies: FieldPolicy[]): PolicyCoverageAnalysis {
    const types: TypeCoverage[] = [];
    let totalFields = 0;
    let coveredFields = 0;

    for (const policy of policies) {
      const coveredFieldsList: string[] = [];
      
      // Collect all fields from rules
      for (const rule of policy.rules) {
        coveredFieldsList.push(...rule.fields);
      }

      // Remove duplicates
      const uniqueCoveredFields = [...new Set(coveredFieldsList)];
      
      types.push({
        type: policy.type,
        coveredFields: uniqueCoveredFields,
        uncoveredFields: [], // Would need schema info to determine this
        rules: policy.rules,
        policyDefault: policy.policyDefault
      });

      totalFields += uniqueCoveredFields.length;
      coveredFields += uniqueCoveredFields.length;
    }

    const coveragePercentage = totalFields > 0 ? (coveredFields / totalFields) * 100 : 0;
    
    let securityLevel: 'low' | 'medium' | 'high' = 'low';
    if (coveragePercentage > 80) {
      securityLevel = 'high';
    } else if (coveragePercentage > 50) {
      securityLevel = 'medium';
    }

    return {
      types,
      totalFields,
      coveredFields,
      coveragePercentage,
      securityLevel
    };
  }
} 