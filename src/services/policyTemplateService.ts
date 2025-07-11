/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import { 
  PolicyTemplate, 
  PolicyTemplateResult, 
  FieldPolicy,
  PolicyTemplatePattern,
  PatternRule,
  FieldSuggestion
} from "../types/fieldPolicy";

export class PolicyTemplateService {
  private templatePatterns: PolicyTemplatePattern[] = [
    // Basic Patterns
    {
      id: "public-query-access",
      name: "Public Query Access",
      description: "Allow public access to all query fields",
      type: "Query",
      category: "basic",
      pattern: {
        structure: [
          {
            condition: "true",
            name: "public access",
            fieldSelector: {
              type: "public",
              description: "All query fields that should be publicly accessible",
              namingPatterns: ["public", "info", "list", "get", "read", "view"]
            },
            description: "Select fields that should be accessible to everyone"
          }
        ],
        defaultCondition: "false",
        guidance: "Choose fields that contain non-sensitive, publicly available data."
      }
    },
    {
      id: "jwt-required-with-introspection",
      name: "JWT Required (Public Introspection)",
      description: "Require JWT authentication for data access, but allow public introspection",
      type: "Query",
      category: "basic",
      pattern: {
        structure: [
          {
            condition: "true",
            name: "public introspection",
            fieldSelector: {
              type: "public",
              description: "GraphQL introspection fields",
              suggestions: ["__type", "__schema", "__typename"]
            },
            description: "Allow public access to GraphQL introspection"
          },
          {
            condition: "?$jwt",
            name: "authenticated data",
            fieldSelector: {
              type: "user-specific",
              description: "Data fields that require authentication",
              namingPatterns: ["user", "profile", "data", "content", "item"]
            },
            description: "Select fields that require valid JWT authentication"
          }
        ],
        defaultCondition: "false",
        guidance: "Choose introspection fields for public access, and data fields for authenticated access."
      }
    },
    {
      id: "admin-mutations",
      name: "Admin Mutations",
      description: "Restrict mutations to admin users only",
      type: "Mutation",
      category: "basic",
      pattern: {
        structure: [
          {
            condition: '$jwt.role:String == "admin"',
            name: "admin mutations",
            fieldSelector: {
              type: "admin-only",
              description: "Administrative mutation fields",
              namingPatterns: ["create", "delete", "update", "admin", "manage", "system"]
            },
            description: "Select mutation fields that only administrators should access"
          }
        ],
        defaultCondition: "false",
        guidance: "Choose mutation fields that perform administrative or system-level operations."
      }
    },
    
    // Advanced Patterns
    {
      id: "role-based-access",
      name: "Role-Based Access Control",
      description: "Different access levels based on JWT roles",
      type: "Query",
      category: "advanced",
      pattern: {
        structure: [
          {
            condition: "true",
            name: "public fields",
            fieldSelector: {
              type: "public",
              description: "Publicly accessible fields",
              namingPatterns: ["public", "info", "list", "announcement", "news"]
            },
            description: "Select fields that should be accessible to everyone"
          },
          {
            condition: '$jwt.role:String == "user"',
            name: "user access",
            fieldSelector: {
              type: "user-specific",
              description: "User-specific data fields",
              namingPatterns: ["user", "profile", "preference", "personal", "my"]
            },
            description: "Select fields that require user authentication"
          },
          {
            condition: '$jwt.role:String == "editor"',
            name: "editor access",
            fieldSelector: {
              type: "role-based",
              description: "Content management fields",
              namingPatterns: ["content", "draft", "publish", "edit", "manage"]
            },
            description: "Select fields that editors can access"
          },
          {
            condition: '$jwt.role:String == "admin"',
            name: "admin access",
            fieldSelector: {
              type: "admin-only",
              description: "Administrative fields",
              namingPatterns: ["admin", "system", "userManagement", "audit", "config"]
            },
            description: "Select fields that only administrators can access"
          }
        ],
        defaultCondition: "false",
        guidance: "Organize fields by access level: public, user-specific, editor, and admin-only."
      }
    },
    {
      id: "array-membership-access",
      name: "Array Membership Access",
      description: "Access control based on JWT array/group membership",
      type: "Query",
      category: "advanced",
      pattern: {
        structure: [
          {
            condition: "true",
            name: "public fields",
            fieldSelector: {
              type: "public",
              description: "Public information fields",
              namingPatterns: ["public", "info", "list", "catalog"]
            },
            description: "Select fields that should be accessible to everyone"
          },
          {
            condition: '$jwt.groups:String has "readers"',
            name: "reader access",
            fieldSelector: {
              type: "role-based",
              description: "Read-only content fields",
              namingPatterns: ["read", "view", "content", "data", "export"]
            },
            description: "Select fields that readers can access"
          },
          {
            condition: '$jwt.groups:String has "writers"',
            name: "writer access",
            fieldSelector: {
              type: "role-based",
              description: "Content creation fields",
              namingPatterns: ["create", "write", "submit", "content", "draft"]
            },
            description: "Select fields that writers can access"
          },
          {
            condition: '$jwt.groups:String has "moderators"',
            name: "moderator access",
            fieldSelector: {
              type: "role-based",
              description: "Moderation fields",
              namingPatterns: ["moderate", "approve", "flag", "review", "content"]
            },
            description: "Select fields that moderators can access"
          },
          {
            condition: '$jwt.groups:String has "admins"',
            name: "admin access",
            fieldSelector: {
              type: "admin-only",
              description: "Administrative fields",
              namingPatterns: ["admin", "system", "user", "config", "management"]
            },
            description: "Select fields that administrators can access"
          }
        ],
        defaultCondition: "false",
        guidance: "Organize fields by group permissions: public, readers, writers, moderators, and admins."
      }
    },
    {
      id: "department-based-access",
      name: "Department-Based Access",
      description: "Access control based on user department",
      type: "Query",
      category: "advanced",
      pattern: {
        structure: [
          {
            condition: "true",
            name: "public fields",
            fieldSelector: {
              type: "public",
              description: "Company-wide information",
              namingPatterns: ["company", "info", "public", "announcement"]
            },
            description: "Select fields that should be accessible to everyone"
          },
          {
            condition: '$jwt.department:String == "engineering"',
            name: "engineering access",
            fieldSelector: {
              type: "department-specific",
              description: "Engineering-specific fields",
              namingPatterns: ["code", "repo", "build", "deploy", "test", "ci"]
            },
            description: "Select fields that engineering department can access"
          },
          {
            condition: '$jwt.department:String == "marketing"',
            name: "marketing access",
            fieldSelector: {
              type: "department-specific",
              description: "Marketing-specific fields",
              namingPatterns: ["campaign", "marketing", "analytics", "customer", "lead"]
            },
            description: "Select fields that marketing department can access"
          },
          {
            condition: '$jwt.department:String == "finance"',
            name: "finance access",
            fieldSelector: {
              type: "department-specific",
              description: "Finance-specific fields",
              namingPatterns: ["finance", "budget", "expense", "report", "financial"]
            },
            description: "Select fields that finance department can access"
          },
          {
            condition: '$jwt.department:String == "hr"',
            name: "hr access",
            fieldSelector: {
              type: "department-specific",
              description: "HR-specific fields",
              namingPatterns: ["employee", "hr", "payroll", "benefit", "personnel"]
            },
            description: "Select fields that HR department can access"
          }
        ],
        defaultCondition: "false",
        guidance: "Organize fields by department: public, engineering, marketing, finance, and HR."
      }
    }
  ];

  // Legacy templates for backward compatibility
  private templates: PolicyTemplate[] = [
    {
      id: "public-query-access-legacy",
      name: "Public Query Access (Legacy)",
      description: "Allow public access to all query fields",
      type: "Query",
      policyDefault: {
        condition: "true"
      },
      category: "basic"
    },
    {
      id: "jwt-required-with-introspection-legacy",
      name: "JWT Required (Public Introspection) - Legacy",
      description: "Require JWT authentication for data access, but allow public introspection",
      type: "Query",
      rules: [
        {
          condition: "true",
          name: "public introspection",
          fields: ["__type", "__schema", "__typename"]
        }
      ],
      policyDefault: {
        condition: "?$jwt"
      },
      category: "basic"
    },
    {
      id: "admin-mutations-legacy",
      name: "Admin Mutations (Legacy)",
      description: "Restrict mutations to admin users only",
      type: "Mutation",
      policyDefault: {
        condition: '$jwt.role:String == "admin"'
      },
      category: "basic"
    }
  ];

  /**
   * Get all available template patterns
   */
  getAllTemplatePatterns(): PolicyTemplatePattern[] {
    return [...this.templatePatterns];
  }

  /**
   * Get template patterns by category
   */
  getTemplatePatternsByCategory(category: 'basic' | 'advanced'): PolicyTemplatePattern[] {
    return this.templatePatterns.filter(pattern => pattern.category === category);
  }

  /**
   * Get template patterns by operation type
   */
  getTemplatePatternsByType(type: 'Query' | 'Mutation' | 'Subscription'): PolicyTemplatePattern[] {
    return this.templatePatterns.filter(pattern => pattern.type === type);
  }

  /**
   * Get a specific template pattern by ID
   */
  getTemplatePatternById(id: string): PolicyTemplatePattern | undefined {
    return this.templatePatterns.find(pattern => pattern.id === id);
  }

  /**
   * Suggest fields for a pattern rule based on schema analysis
   */
  suggestFieldsForPattern(
    patternRule: PatternRule, 
    availableFields: any[]
  ): FieldSuggestion[] {
    const suggestions: FieldSuggestion[] = [];
    const fieldNames = availableFields.map(f => f.name.toLowerCase());
    
    // Check for exact matches in suggestions
    if (patternRule.fieldSelector.suggestions) {
      patternRule.fieldSelector.suggestions.forEach(suggestion => {
        if (fieldNames.includes(suggestion.toLowerCase())) {
          suggestions.push({
            fieldName: suggestion,
            confidence: 1.0,
            reason: "Exact match from template suggestions"
          });
        }
      });
    }
    
    // Check for naming pattern matches
    if (patternRule.fieldSelector.namingPatterns) {
      patternRule.fieldSelector.namingPatterns.forEach(pattern => {
        const matchingFields = fieldNames.filter(name => 
          name.includes(pattern.toLowerCase())
        );
        
        matchingFields.forEach(fieldName => {
          const originalField = availableFields.find(f => 
            f.name.toLowerCase() === fieldName
          );
          
          if (originalField) {
            suggestions.push({
              fieldName: originalField.name,
              confidence: 0.8,
              reason: `Matches naming pattern: ${pattern}`
            });
          }
        });
      });
    }
    
    // Add all fields with lower confidence for manual selection
    availableFields.forEach(field => {
      const existingSuggestion = suggestions.find(s => s.fieldName === field.name);
      if (!existingSuggestion) {
        suggestions.push({
          fieldName: field.name,
          confidence: 0.3,
          reason: "Available field for manual selection"
        });
      }
    });
    
    // Sort by confidence (highest first)
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate a policy from a template pattern (requires field selection)
   */
  generatePolicyFromPattern(
    patternId: string,
    fieldSelections: { [ruleName: string]: string[] }
  ): FieldPolicy | null {
    const pattern = this.getTemplatePatternById(patternId);
    if (!pattern) {
      return null;
    }

    const rules = pattern.pattern.structure.map(rule => ({
      condition: rule.condition,
      name: rule.name,
      fields: fieldSelections[rule.name] || []
    }));

    return {
      type: pattern.type,
      rules,
      policyDefault: {
        condition: pattern.pattern.defaultCondition
      }
    };
  }

  // Legacy methods for backward compatibility
  getAllTemplates(): PolicyTemplate[] {
    return [...this.templates];
  }

  getTemplatesByCategory(category: 'basic' | 'advanced'): PolicyTemplate[] {
    return this.templates.filter(template => template.category === category);
  }

  getTemplatesByType(type: 'Query' | 'Mutation' | 'Subscription'): PolicyTemplate[] {
    return this.templates.filter(template => template.type === type);
  }

  getTemplateById(id: string): PolicyTemplate | undefined {
    return this.templates.find(template => template.id === id);
  }

  generatePolicyFromTemplate(templateId: string): PolicyTemplateResult | null {
    const template = this.getTemplateById(templateId);
    if (!template) {
      return null;
    }

    const generatedPolicy: FieldPolicy = {
      type: template.type,
      rules: template.rules || [],
      policyDefault: template.policyDefault
    };

    return {
      template,
      generatedPolicy
    };
  }

  generatePoliciesFromTemplates(templateIds: string[]): PolicyTemplateResult[] {
    return templateIds
      .map(id => this.generatePolicyFromTemplate(id))
      .filter((result): result is PolicyTemplateResult => result !== null);
  }
} 