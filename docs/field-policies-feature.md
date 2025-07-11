<!--
Copyright IBM Corp. 2025
Assisted by CursorAI
-->

# Field Policies Feature Planning

## Recent Improvements (2025)

- **Field Access Report now shows access paths for all reachable types, including those returned directly from root operation fields.**
- **Color coding in the report:**
  - Red: Accessible via policy default (potential security gap)
  - Yellow: Accessible via a rule with condition `true` (public)
  - Green: Accessible via a rule with a more restrictive condition (covered by rule)
  - Gray: Blocked (not accessible)
- **Bug fix:** Previously, types returned directly from root fields (e.g., `Query.employee: Employee`) did not show access paths. This is now fixed: all reachable types display their access paths, whether reached directly or indirectly.

---

# Field Policies Feature Planning

## Problem Statement

GraphQL security is challenging because:

- Single endpoint exposes entire schema
- HTTP verb-based security doesn't apply
- "All or nothing" access control is insufficient
- Field-level granularity needed for proper security

## StepZen Solution: Field Policies

Field Policies provide ABAC (Attribute-Based Access Control) and RBAC (Role-Based Access Control) at the field level in GraphQL schemas.

## Feature Vision

Build a VSCode extension feature that helps developers:

1. **Create Field Policies** - Intuitive tools for building policies
2. **Validate Field Policies** - Tools to examine and validate existing policies
3. **Analyze Field Access** - Generate reports showing effective field access control

## Design Principles

- **Precision First**: Security requires exactness
- **Progressive Disclosure**: Hide complexity until needed
- **Validation at Every Step**: Catch errors early
- **Visual Feedback**: Make policy structure clear
- **Integration**: Work seamlessly with existing StepZen workflow

## Research Questions

- [x] How do Field Policies work in StepZen?
- [x] What's the syntax/structure?
- [x] What are common patterns and use cases?
- [x] What validation rules exist?
- [x] How do policies integrate with schema files?

## Field Policies Deep Dive

Based on the [IBM API Connect documentation](https://www.ibm.com/docs/en/api-connect-graphql/saas?topic=endpoints-using-field-policies), Field Policies provide:

### Core Concepts

- **YAML Configuration**: Policies defined in `config.yaml` file
- **Type-Based Organization**: Policies organized by GraphQL types (Query, Mutation, Subscription, custom types)
- **Rule-Based Access**: Each rule has a condition, name, and list of fields
- **Policy Default**: Catch-all policy for unspecified fields (defaults to `false` - deny access)

### Key Components

```
access:
  policies:
    - type: Query
      rules:
      - condition: PREDICATE
        name: name of rule
        fields: [ fieldname ... ]
      policyDefault:
        condition: PREDICATE
```

### Predicate Language

- **Types**: Int, Boolean, Float, String (must be explicitly typed)
- **Built-in Values**: `$jwt`, `$variables` (JWT token and GraphQL variables)
- **Operators**: `<`, `<=`, `==`, `!=`, `>`, `>=`, `has`
- **Existence Checks**: `?$jwt`, `?$jwt.CUSTOM/bar`

### Common Patterns

1. **Public Access**: `condition: true`
2. **JWT Required**: `condition: "?$jwt"`
3. **Role-Based**: `condition: "$jwt.CUSTOMGROUP.role:String == 'admin'"`
4. **Array Membership**: `condition: "$jwt.CUSTOM/groups: String has 'admin'"`
5. **Introspection Control**: Fields `[__type, __schema, __typename]`

### Default Behavior & Authentication Context

**Important**: Field Policies only work with JWT authentication, not API key authentication.

- **Default State**: New schemas have no field policies defined
- **API Key Auth**: Field policies are ignored, all fields accessible
- **JWT Auth**: Field policies are enforced based on JWT claims
- **Admin/API Keys**: Always bypass field policies (for management purposes)

**Extension Opportunity**:

- Add "default authentication" setting in extension configuration
- When set to JWT, automatically configure JWT auth and include default field policies
- Provide templates for common JWT + field policy setups

## UX Considerations

### Policy Creation

- **Interactive Policy Editor**: Visual form-based interface for creating and editing policies
- **Schema Integration**: Direct field selection from actual GraphQL schema
- **Template Library**: Nine comprehensive templates for common security patterns
- **Condition Builder**: Guided interface for creating complex JWT conditions
- **Real-time Validation**: Immediate feedback on syntax and logic errors
- **Custom Policy Wizard**: Step-by-step guided creation with field selection
- **Multi-select Field Picker**: Choose multiple fields with visual feedback

### Policy Validation

- **Coverage Analysis**: Visual indicators showing which fields have policies
- **Security Gap Detection**: Highlight unprotected sensitive fields
- **Conflict Resolution**: Detect and resolve overlapping rules
- **Policy Testing**: Simulate requests with different JWT tokens
- **Performance Impact**: Analyze policy complexity and optimization opportunities

### Field Access Reporting

- **Access Analysis**: Determine effective access for each field based on policies and defaults
- **Enhanced Visual Reports**: Interactive panel with filtering, search, and statistics
- **Coverage Analysis**: Visual indicators showing policy coverage percentage
- **Filtering Capabilities**: Filter by type, access level, and search terms
- **JSON Export**: Machine-readable reports for CI/CD and version control
- **Security Assurance**: Clear indicators of which fields are accessible vs protected
- **Policy Editor Integration**: Direct link to open policy editor from report

### User Experience Flow

1. **Discovery**: User opens schema, sees policy status at a glance
2. **Creation**: Choose template or use interactive policy editor
3. **Configuration**: Fill in details with schema-integrated field selection
4. **Validation**: Real-time validation with immediate feedback
5. **Reporting**: Generate enhanced access reports with filtering and statistics
6. **Editing**: Modify policies using visual editor with schema integration
7. **Deployment**: Integrate with existing deploy workflow

## Implementation Phases

### Phase 1: Research & Design ✅

- [x] Review Field Policies documentation
- [x] Analyze existing StepZen schema structure
- [x] Design UX mockups
- [x] Define technical architecture

### Phase 2: Policy Creation ✅

- [x] Build policy creation tools
- [x] Create templates/patterns
- [x] Add validation feedback
- [x] Integrate with existing commands

### Phase 3: Policy Validation ✅

- [x] Build validation engine
- [x] Create analysis tools
- [x] Add comprehensive testing
- [x] Performance optimization

### Phase 4: Integration & Polish ✅

- [x] Integrate with existing commands
- [x] Add comprehensive testing
- [x] Field Access Report feature
- [x] Enhanced visual panel with filtering and statistics
- [x] Interactive Policy Editor panel
- [x] Complete custom policy wizard
- [x] Expanded template system
- [x] Schema integration for field selection
- [x] Real-time validation and feedback
- [ ] Documentation and examples
- [ ] User feedback iteration

## TDD Approach

### Test-First Development Strategy

1. **Test Fixtures**: Create sample config.yaml files with various policy patterns
2. **Unit Tests**: Test each component in isolation (parser, validator, analyzer)
3. **Integration Tests**: Test end-to-end policy validation workflows
4. **Edge Cases**: Test complex JWT claims, nested conditions, conflicts

### Sample Test Cases ✅

- [x] Valid YAML structure parsing
- [x] Predicate syntax validation
- [x] Policy conflict detection
- [x] Coverage analysis accuracy
- [x] JWT claim extraction
- [x] Type annotation validation
- [x] Array operation testing
- [x] Introspection policy handling
- [x] Field access report generation
- [x] No policies scenario handling

### Test Fixtures Needed ✅

- [x] Basic public access policies
- [x] JWT-based role policies
- [x] Complex array membership conditions
- [x] Introspection control policies
- [x] Malformed/invalid policies for error testing
- [x] Policy conflicts and edge cases
- [x] Expected field access report outputs

## Technical Architecture

### Core Components

#### 1. Policy Parser & Validator ✅

- **YAML Schema Validation**: Ensure config.yaml structure is correct
- **Predicate Language Parser**: Validate condition syntax and types
- **Policy Conflict Detection**: Identify overlapping rules and conflicts
- **Integration**: Extend existing `SchemaIndexService` for policy awareness

#### 2. Policy Creation Tools ✅

- **Template Engine**: Pre-built policy templates for common patterns
- **Wizard Interface**: Step-by-step policy creation with validation
- **Command Integration**: "StepZen: Create Field Policy" command
- **Template System**: Nine comprehensive templates (basic and advanced patterns)
- **Custom Policy Wizard**: Complete rule creation with schema integration
- **Field Selection**: Multi-select interface for choosing fields from actual schema

#### 3. Policy Analysis Engine ✅

- **Coverage Analyzer**: Map policies to schema fields
- **Security Gap Detector**: Identify unprotected sensitive fields
- **Policy Tester**: Simulate requests with different JWT tokens
- **Performance Analyzer**: Assess policy complexity impact

#### 4. Field Access Report Engine ✅

- **Access Analysis**: Determine effective access for each field
- **Report Generation**: Create structured reports with summary and details
- **Schema Integration**: Map policies to actual schema fields
- **Edge Case Handling**: Handle no policies, root types, complex rules

#### 5. UI Components ✅

- **Interactive Policy Editor Panel**: Visual form-based policy builder with schema integration
- **Enhanced Field Access Report Panel**: Interactive report with filtering, search, and statistics
- **Policy Status Indicators**: Visual overview of policy coverage and security status
- **Condition Builder**: Guided interface for creating complex JWT conditions
- **Field Selection Interface**: Multi-select field picker with schema validation
- **Real-time Validation**: Immediate feedback on policy syntax and logic

### Integration Points

#### Existing Services

- **SchemaIndexService**: Extend to include policy metadata
- **CLI Service**: Add policy validation commands
- **Logger Service**: Policy-specific logging and debugging
- **Project Resolver**: Locate and parse config.yaml files

#### New Commands ✅

- `stepzen.createFieldPolicy` - Create field policy from template or custom
- `stepzen.openPolicyEditor` - Open interactive policy editor panel
- `stepzen.fieldAccessReport` - Generate field access report (visual/JSON)
- `stepzen.validatePolicies` - Validate existing policies (via parser)
- `stepzen.testPolicy` - Test policy with sample JWT (future)
- `stepzen.showPolicyCoverage` - Visualize policy coverage (future)

### Data Flow

1. **Schema Parsing**: Parse GraphQL schema and extract field information
2. **Policy Parsing**: Parse config.yaml and extract policy rules
3. **Policy Mapping**: Map policies to schema fields
4. **Access Analysis**: Determine effective access for each field
5. **Report Generation**: Create structured reports
6. **Visualization**: Present results in user-friendly format

## Current Implementation Status ✅

### What's Working

#### Policy Parser & Validation

- ✅ **YAML Parsing**: Robust parsing of `config.yaml` files with real StepZen syntax
- ✅ **Predicate Validation**: Supports double quotes, JWT claims, variables, logical operators
- ✅ **Conflict Detection**: Identifies overlapping field rules
- ✅ **Error Handling**: Comprehensive validation with detailed error messages
- ✅ **Test Coverage**: 8 comprehensive test cases with realistic fixtures

#### Policy Templates

- ✅ **Nine Comprehensive Templates**:
  - **Basic Templates**:
    - **Public Query Access**: `condition: true` for all query fields
    - **JWT Required with Public Introspection**: `?$jwt` for data, `true` for introspection
    - **Admin Mutations**: `$jwt.role:String == "admin"` for mutations
  - **Advanced Templates**:
    - **Role-Based Access Control**: Different access levels based on JWT roles
    - **Array Membership Access**: Access control based on JWT array/group membership
    - **Time-Based Access Control**: Access control based on time conditions
    - **Department-Based Access**: Access control based on user department
    - **Secure Mutation Control**: Comprehensive mutation security with role-based access
    - **Subscription Access Control**: Control access to real-time subscriptions
- ✅ **Template Service**: Full CRUD operations for templates
- ✅ **Template Generation**: Convert templates to actual policies

#### Policy Creation

- ✅ **Command**: "StepZen: Create Field Policy" (`stepzen.createFieldPolicy`)
- ✅ **User Flow**: Guided wizard for operation type → template/custom → config.yaml
- ✅ **Config Integration**: Automatically updates `config.yaml` with new policies
- ✅ **Conflict Resolution**: Handles existing policies with replace/append logic
- ✅ **Complete Custom Policy Wizard**:
  - Multi-step rule creation with field selection from actual schema
  - Condition type selection (public, JWT required, role-based, array membership, custom)
  - Interactive field picker with multi-select capability
  - Real-time validation and user feedback

#### Interactive Policy Editor

- ✅ **New Command**: "StepZen: Open Policy Editor" (`stepzen.openPolicyEditor`)
- ✅ **Visual Policy Builder**: Form-based interface for creating and editing policies
- ✅ **Schema Integration**: Shows actual available fields from the GraphQL schema
- ✅ **Real-time Validation**: Immediate feedback on syntax and logic errors
- ✅ **Condition Builder**: Guided templates for common condition patterns
- ✅ **Save/Validate/Test**: Integrated functionality for policy management
- ✅ **Field Selection**: Multi-select interface for choosing fields from schema

#### Field Access Report

- ✅ **Command**: "StepZen: Generate Field Access Report" (`stepzen.fieldAccessReport`)
- ✅ **Access Analysis**: Determines effective access for each field based on policies and defaults
- ✅ **Enhanced Visual Panel**: Interactive webview with improved styling and features
- ✅ **Filtering Capabilities**: Filter by type, access level, and search terms
- ✅ **Coverage Statistics**: Shows coverage percentage and detailed statistics
- ✅ **JSON Export**: Deterministic, check-in-friendly output for CI/CD
- ✅ **Edge Cases**: Handles no policies, root types, complex rules
- ✅ **Test Coverage**: Unit tests for report logic and panel functionality
- ✅ **Policy Editor Integration**: Direct link to open policy editor from report

#### Service Integration

- ✅ **Service Registry**: Integrated into the main service registry
- ✅ **Error Handling**: Consistent with existing error patterns
- ✅ **Logging**: Full logging integration for debugging
- ✅ **Extension Activation**: Properly registered and activated

### Major Improvements Made ✅

#### UI/UX Enhancements

- **Interactive Policy Editor**: Complete visual policy builder with form-based interface
- **Schema Integration**: Direct field selection from actual GraphQL schema instead of manual entry
- **Enhanced Field Access Report**: Improved visual design with filtering, search, and statistics
- **Real-time Validation**: Immediate feedback on policy syntax and logic errors
- **Condition Builder**: Guided interface for creating complex JWT conditions
- **Multi-select Field Picker**: Visual interface for choosing multiple fields

#### Template System Expansion

- **Nine Comprehensive Templates**: Expanded from 3 basic to 9 templates covering advanced patterns
- **Role-Based Access Control**: Complete role hierarchy with different access levels
- **Array Membership Access**: Group-based access control patterns
- **Time-Based Access Control**: Business hours and time-based conditions
- **Department-Based Access**: Organization-specific access patterns
- **Secure Mutation Control**: Comprehensive mutation security
- **Subscription Access Control**: Real-time subscription security

#### Custom Policy Creation

- **Complete Wizard Implementation**: Full multi-step rule creation process
- **Field Selection from Schema**: No more manual field name entry
- **Condition Type Selection**: Guided creation of different condition types
- **Rule Management**: Add, edit, and remove rules with visual feedback
- **Validation at Every Step**: Catch errors early with helpful messages

#### Integration Improvements

- **Policy Editor Integration**: Direct link from field access report to policy editor
- **New Commands**: "Open Policy Editor" command for direct access
- **Enhanced Reporting**: Better statistics, filtering, and search capabilities
- **Coverage Analysis**: Visual indicators of policy coverage percentage

### What's Next

#### Immediate Opportunities

- **Policy Testing**: Simulate requests with different JWT tokens
- **Schema Integration**: Right-click context menus on GraphQL fields
- **Advanced Templates**: Time-based, environment-based, custom JWT claims
- **Policy Migration**: Tools to migrate between different policy patterns

#### Future Enhancements

- **Security Analysis**: Automated detection of security gaps
- **Performance Optimization**: Policy complexity analysis
- **Policy Comparison**: Diff tools for policy changes
- **JWT Token Builder**: Visual JWT token creation and testing
- **Request Simulation**: Test policies with sample GraphQL requests

## Open Questions

- [x] Should this be a new command or integrate with existing ones? **Answer: New command with existing integration**
- [x] How do we handle policy conflicts? **Answer: Detection + user choice for replacement**
- [x] What's the relationship with existing security features? **Answer: Complementary to existing StepZen security**
- [x] How do we test policy effectiveness? **Answer: Field Access Report provides visibility**
- [x] How do we handle complex JWT conditions? **Answer: Condition builder with guided templates**
- [x] How do we improve the custom policy creation experience? **Answer: Complete wizard with schema integration**
- [x] How do we make policy editing more user-friendly? **Answer: Interactive visual policy editor**
- [ ] How do we implement policy testing with JWT simulation? **Future: JWT token builder and request simulation**
- [ ] How do we add right-click context menus on GraphQL fields? **Future: Schema integration enhancements**

## Template Usage Patterns

### The Problem with Hardcoded Fields

The original template system had a fundamental flaw: **templates included hardcoded field names** that don't exist in the user's actual GraphQL schema. This created several issues:

- **Invalid Policies**: Generated policies referenced non-existent fields
- **User Confusion**: Users got policies that didn't work with their schema
- **Manual Fixup Required**: Users had to manually edit YAML to fix field names
- **Poor UX**: "Quick start" templates actually created more work

### Solution: Template Patterns

We've refactored the template system to use **template patterns** instead of hardcoded fields:

#### **What Are Template Patterns?**

Template patterns provide:

- **Structure**: The organization of rules and conditions
- **Guidance**: Descriptions of what each rule should contain
- **Field Suggestions**: Smart suggestions based on naming patterns
- **Flexibility**: Users select actual fields from their schema

#### **How Template Patterns Work**

1. **Pattern Definition**: Templates define the structure and guidance
2. **Schema Analysis**: System analyzes the user's actual GraphQL schema
3. **Field Suggestions**: Smart suggestions based on naming patterns and field types
4. **User Selection**: Users choose from actual schema fields with confidence indicators
5. **Policy Generation**: Valid policy created with real field names

### Expected User Workflows

The field policies feature now supports these improved workflows:

#### **Workflow 1: Pattern-Based Creation (Recommended)**

```
1. User wants to create a policy using proven patterns
2. Selects "Create Field Policy from Pattern"
3. Chooses operation type (Query/Mutation/Subscription)
4. Selects a template pattern (e.g., "Role-Based Access Control")
5. For each rule, selects fields from their actual schema
6. System provides smart suggestions with confidence levels
7. User saves the policy with valid field names
```

**Use Case**: Creating policies using proven security patterns with actual schema fields.

#### **Workflow 2: Template → Use As-Is (Legacy)**

```
1. User wants quick setup for common security patterns
2. Selects template (e.g., "Public Query Access")
3. Chooses "Use Template As-Is"
4. Template generates policy with predefined fields
5. User saves policy directly to config.yaml
6. User manually edits config.yaml later if field names need adjustment
```

**Use Case**: Quick setup where template fields closely match the user's schema.

#### **Workflow 3: Template → Customize (Legacy)**

```
1. User wants to start with a template but customize it for their schema
2. Selects template (e.g., "Array Membership Access")
3. Chooses "Customize Template"
4. Template loads into the interactive policy editor
5. User modifies field names to match their actual schema
6. User adjusts conditions or adds/removes rules
7. User saves the customized policy
```

**Use Case**: Starting with a proven pattern but adapting it to specific schema requirements.

#### **Workflow 4: Custom from Scratch**

```
1. User wants complete control over policy creation
2. Chooses "Create Custom" or opens policy editor
3. Uses the custom policy wizard or builds manually
4. Creates policy step by step with field selection from schema
5. User saves the custom policy
```

**Use Case**: Unique security requirements that don't match existing patterns.

### Smart Field Suggestions

The new pattern system provides intelligent field suggestions:

#### **Confidence Levels**

- **100%**: Exact matches from template suggestions (e.g., `__type`, `__schema`)
- **80%**: Fields matching naming patterns (e.g., fields containing "user", "admin")
- **30%**: All available fields for manual selection

#### **Naming Pattern Matching**

The system analyzes field names to suggest appropriate fields:

**Role-Based Access Control Pattern:**

- **Public fields**: Suggests fields containing "public", "info", "list", "get", "read", "view"
- **User fields**: Suggests fields containing "user", "profile", "preference", "personal", "my"
- **Admin fields**: Suggests fields containing "admin", "system", "userManagement", "audit", "config"

**Department-Based Access Pattern:**

- **Engineering**: Suggests fields containing "code", "repo", "build", "deploy", "test", "ci"
- **Marketing**: Suggests fields containing "campaign", "marketing", "analytics", "customer", "lead"
- **Finance**: Suggests fields containing "finance", "budget", "expense", "report", "financial"

### Template Customization Guidelines

#### **When to Use Pattern-Based Creation**

- You want to use proven security patterns
- You want smart field suggestions based on your schema
- You want to avoid manual field name editing
- You want confidence indicators for field selection

#### **When to Use Legacy Templates**

- Template field names closely match your schema
- You want quick setup and will adjust later manually
- You're familiar with the template structure

#### **When to Customize Templates**

- Template provides good structure but field names need adjustment
- You want to modify conditions for your specific JWT claims
- You want to add or remove rules based on your needs

### Best Practices

1. **Use Pattern-Based Creation**: Prefer the new pattern system over legacy templates
2. **Review Field Suggestions**: Check confidence levels and reasoning for suggestions
3. **Customize as Needed**: Adjust field selections to match your security requirements
4. **Validate Policies**: Use the field access report to verify policy effectiveness
5. **Iterate**: Start simple and add complexity as needed

---

_Portions of the Content may be generated with the assistance of CursorAI_
