/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

export interface FieldPolicy {
  type: string;
  rules: PolicyRule[];
  policyDefault: PolicyDefault;
}

export interface PolicyRule {
  condition: string;
  name: string;
  fields: string[];
}

interface PolicyDefault {
  condition: string;
}

export interface FieldPolicyParseResult {
  isValid: boolean;
  policies: FieldPolicy[];
  errors: PolicyValidationError[];
  conflicts: PolicyConflict[];
}

export interface PolicyValidationError {
  message: string;
  type: 'syntax' | 'semantic' | 'conflict';
}

export interface PolicyConflict {
  type: 'field_conflict';
  field: string;
  rule1: string;
  rule2: string;
  message: string;
}

export interface PolicyCoverageAnalysis {
  types: TypeCoverage[];
  totalFields: number;
  coveredFields: number;
  coveragePercentage: number;
  securityLevel: 'low' | 'medium' | 'high';
}

export interface TypeCoverage {
  type: string;
  coveredFields: string[];
  uncoveredFields: string[];
  rules: PolicyRule[];
  policyDefault: PolicyDefault;
}

export interface PredicateAnalysis {
  isValid: boolean;
  claims: JwtClaim[];
  variables: string[];
  operators: string[];
  errors: string[];
}

interface JwtClaim {
  path: string;
  type: string;
}

// Policy Template Types
export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  type: 'Query' | 'Mutation' | 'Subscription';
  rules?: PolicyRule[];
  policyDefault: PolicyDefault;
  category: 'basic' | 'advanced';
}

export interface PolicyTemplateResult {
  template: PolicyTemplate;
  generatedPolicy: FieldPolicy;
}

// New Template Pattern Types
export interface PolicyTemplatePattern {
  id: string;
  name: string;
  description: string;
  type: 'Query' | 'Mutation' | 'Subscription';
  category: 'basic' | 'advanced';
  pattern: PolicyPattern;
}

interface PolicyPattern {
  structure: PatternRule[];
  defaultCondition: string;
  guidance: string;
}

export interface PatternRule {
  condition: string;
  name: string;
  fieldSelector: FieldSelector;
  description: string;
  example?: string;
}

interface FieldSelector {
  type: 'public' | 'user-specific' | 'admin-only' | 'role-based' | 'department-specific' | 'custom';
  namingPatterns?: string[];
  description: string;
  suggestions?: string[];
}

export interface FieldSuggestion {
  fieldName: string;
  confidence: number;
  reason: string;
} 