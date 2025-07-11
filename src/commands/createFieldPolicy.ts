/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as yaml from "js-yaml";
import { services } from "../services";
import { FieldPolicy, PolicyRule } from "../types/fieldPolicy";

export async function createFieldPolicy() {
  try {
    services.logger.info("Starting field policy creation");

    // Check workspace trust
    if (!vscode.workspace.isTrusted) {
      vscode.window.showWarningMessage("Creating field policies is not available in untrusted workspaces");
      return;
    }

    // Step 1: Select operation type
    const operationType = await vscode.window.showQuickPick(
      ["Query", "Mutation", "Subscription"],
      {
        placeHolder: "Select operation type for the field policy",
        canPickMany: false
      }
    );

    if (!operationType) {
      return; // User cancelled
    }

    // Step 2: Choose creation method
    const creationMethod = await vscode.window.showQuickPick(
      [
        { label: "Use Template", description: "Choose from pre-built templates" },
        { label: "Create Custom", description: "Build policy from scratch" }
      ],
      {
        placeHolder: "How would you like to create the policy?",
        canPickMany: false
      }
    );

    if (!creationMethod) {
      return; // User cancelled
    }

    let policy: FieldPolicy;

    if (creationMethod.label === "Use Template") {
      // Step 3a: Select template
      const templates = services.policyTemplate.getTemplatesByType(operationType as any);
      
      if (templates.length === 0) {
        vscode.window.showInformationMessage(`No templates available for ${operationType} operations`);
        return;
      }

      const templateItems = templates.map(template => ({
        label: template.name,
        description: template.description,
        template
      }));

      const selectedTemplate = await vscode.window.showQuickPick(templateItems, {
        placeHolder: `Select a template for ${operationType} policy`,
        canPickMany: false
      });

      if (!selectedTemplate) {
        return; // User cancelled
      }

      // Step 4a: Choose how to use the template
      const templateUsage = await vscode.window.showQuickPick([
        { label: "Use Template As-Is", description: "Apply template directly without customization" },
        { label: "Customize Template", description: "Start with template and customize in editor" }
      ], {
        placeHolder: "How would you like to use this template?",
        canPickMany: false
      });

      if (!templateUsage) {
        return; // User cancelled
      }

      const result = services.policyTemplate.generatePolicyFromTemplate(selectedTemplate.template.id);
      if (!result) {
        vscode.window.showErrorMessage("Failed to generate policy from template");
        return;
      }

      if (templateUsage.label === "Use Template As-Is") {
        // Use template directly
        policy = result.generatedPolicy;
      } else {
        // Customize template in editor
        const { PolicyEditorPanel } = await import("../panels/policyEditorPanel.js");
        const panel = PolicyEditorPanel.getInstance();
        await panel.openWithPolicy(result.generatedPolicy);
        return; // Don't continue with automatic save
      }

    } else {
      // Step 3b: Create custom policy
      const customPolicy = await createCustomPolicy(operationType);
      if (!customPolicy) {
        return; // User cancelled or failed
      }
      policy = customPolicy;
    }

    // Step 4: Add policy to config.yaml
    await addPolicyToConfig(policy);

  } catch (error) {
    services.logger.error("Error creating field policy", error);
    vscode.window.showErrorMessage("Failed to create field policy");
  }
}

async function createCustomPolicy(operationType: string): Promise<FieldPolicy | null> {
  const rules: PolicyRule[] = [];
  
  // Step 1: Get policy default condition
  const defaultCondition = await vscode.window.showInputBox({
    prompt: `Enter the default condition for ${operationType} fields (e.g., "true", "?$jwt", '$jwt.role:String == "admin"')`,
    placeHolder: "true",
    value: "true"
  });

  if (!defaultCondition) {
    return null; // User cancelled
  }

  // Step 2: Ask if they want to add specific rules
  const addRules = await vscode.window.showQuickPick(
    ["No", "Yes"],
    {
      placeHolder: "Do you want to add specific field rules?",
      canPickMany: false
    }
  );

  if (addRules === "Yes") {
    // Step 3: Get available fields from schema
    const fieldIndex = services.schemaIndex.getFieldIndex();
    const availableFields = fieldIndex[operationType] || [];
    
    if (availableFields.length === 0) {
      vscode.window.showWarningMessage(`No fields found for ${operationType} type in the schema`);
    } else {
      // Step 4: Create rules wizard
      const createdRules = await createRulesWizard(operationType, availableFields);
      if (createdRules) {
        rules.push(...createdRules);
      }
    }
  }

  return {
    type: operationType,
    rules,
    policyDefault: {
      condition: defaultCondition
    }
  };
}

async function createRulesWizard(_operationType: string, availableFields: any[]): Promise<PolicyRule[]> {
  const rules: PolicyRule[] = [];
  let continueAdding = true;

  while (continueAdding) {
    // Step 1: Select fields for this rule
    const fieldChoices = availableFields.map(field => ({
      label: field.name,
      description: field.type || 'unknown type',
      field
    }));

    const selectedFields = await vscode.window.showQuickPick(fieldChoices, {
      placeHolder: `Select fields for rule ${rules.length + 1}`,
      canPickMany: true
    });

    if (!selectedFields || selectedFields.length === 0) {
      break;
    }

    // Step 2: Enter rule name
    const ruleName = await vscode.window.showInputBox({
      prompt: `Enter a name for this rule (e.g., "admin access", "public fields")`,
      placeHolder: `rule-${rules.length + 1}`,
      value: `rule-${rules.length + 1}`
    });

    if (!ruleName) {
      break;
    }

    // Step 3: Select condition type
    const conditionType = await vscode.window.showQuickPick([
      { label: "Public Access", description: "Allow access to everyone", value: "public" },
      { label: "JWT Required", description: "Require any valid JWT token", value: "jwt-required" },
      { label: "Role-Based", description: "Require specific JWT role", value: "role-based" },
      { label: "Array Membership", description: "Check JWT array/group membership", value: "array-membership" },
      { label: "Custom Condition", description: "Write custom predicate condition", value: "custom" }
    ], {
      placeHolder: "Select condition type for this rule"
    });

    if (!conditionType) {
      break;
    }

    // Step 4: Get condition based on type
    let condition: string | undefined;
    
    switch (conditionType.value) {
      case "public":
        condition = "true";
        break;
      case "jwt-required":
        condition = "?$jwt";
        break;
      case "role-based":
        const role = await vscode.window.showInputBox({
          prompt: "Enter required role (e.g., 'admin', 'user', 'editor')",
          placeHolder: "admin"
        });
        if (!role) {
          break;
        }
        condition = `$jwt.role:String == "${role}"`;
        break;
      case "array-membership":
        const arrayField = await vscode.window.showInputBox({
          prompt: "Enter JWT array field name (e.g., 'groups', 'permissions')",
          placeHolder: "groups"
        });
        if (!arrayField) {
          break;
        }
        const requiredValue = await vscode.window.showInputBox({
          prompt: "Enter required value in array",
          placeHolder: "admin"
        });
        if (!requiredValue) {
          break;
        }
        condition = `$jwt.${arrayField}:String has "${requiredValue}"`;
        break;
      case "custom":
        const customCondition = await vscode.window.showInputBox({
          prompt: "Enter custom condition (e.g., '$jwt.sub:String == $variables.userId:String')",
          placeHolder: "Enter custom predicate condition..."
        });
        if (!customCondition) {
          break;
        }
        condition = customCondition;
        break;
      default:
        break;
    }

    if (condition) {
      // Create the rule
      const rule: PolicyRule = {
        condition,
        name: ruleName,
        fields: selectedFields.map(f => f.field.name)
      };
      
      rules.push(rule);
      
      // Show confirmation
      vscode.window.showInformationMessage(
        `Created rule "${ruleName}" for ${selectedFields.length} field(s) with condition: ${condition}`
      );
    }

    // Step 5: Ask if they want to add another rule
    const addAnother = await vscode.window.showQuickPick(
      ["Yes", "No"],
      {
        placeHolder: "Add another rule?",
        canPickMany: false
      }
    );

    if (addAnother !== "Yes") {
      continueAdding = false;
    }
  }

  return rules;
}

async function addPolicyToConfig(policy: FieldPolicy): Promise<void> {
  try {
    // Find or create config.yaml
    const projectRoot = await services.projectResolver.resolveStepZenProjectRoot();
    const configPath = path.join(projectRoot, "config.yaml");

    let config: any = {};

    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, "utf8");
      config = yaml.load(configContent) || {};
    }

    // Initialize access.policies if it doesn't exist
    if (!config.access) {
      config.access = {};
    }
    if (!config.access.policies) {
      config.access.policies = [];
    }

    // Check if policy for this type already exists
    const existingPolicyIndex = config.access.policies.findIndex((p: any) => p.type === policy.type);
    
    if (existingPolicyIndex >= 0) {
      // Ask user if they want to replace existing policy
      const replace = await vscode.window.showQuickPick(
        ["Replace existing policy", "Cancel"],
        {
          placeHolder: `A policy for ${policy.type} already exists. What would you like to do?`,
          canPickMany: false
        }
      );

      if (replace === "Cancel") {
        return;
      }

      // Replace existing policy
      config.access.policies[existingPolicyIndex] = policy;
    } else {
      // Add new policy
      config.access.policies.push(policy);
    }

    // Write config back to file
    const yamlContent = yaml.dump(config, { indent: 2 });
    fs.writeFileSync(configPath, yamlContent, "utf8");

    // Show success message
    const action = existingPolicyIndex >= 0 ? "updated" : "created";
    vscode.window.showInformationMessage(`Successfully ${action} field policy for ${policy.type}`);

    // Open the config file to show the result
    const document = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(document);

  } catch (error) {
    services.logger.error("Error adding policy to config", error);
    vscode.window.showErrorMessage("Failed to add policy to config.yaml");
  }
} 