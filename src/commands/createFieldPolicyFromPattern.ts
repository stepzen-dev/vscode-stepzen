/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as yaml from "js-yaml";
import { services } from "../services";
import { FieldPolicy, PatternRule } from "../types/fieldPolicy";

export async function createFieldPolicyFromPattern() {
  try {
    services.logger.info("Starting pattern-based field policy creation");

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

    // Step 2: Get available fields from schema
    const fieldIndex = services.schemaIndex.getFieldIndex();
    const availableFields = fieldIndex[operationType] || [];
    
    if (availableFields.length === 0) {
      vscode.window.showWarningMessage(`No fields found for ${operationType} type in the schema`);
      return;
    }

    // Step 3: Select template pattern
    const patterns = services.policyTemplate.getTemplatePatternsByType(operationType as any);
    
    if (patterns.length === 0) {
      vscode.window.showInformationMessage(`No patterns available for ${operationType} operations`);
      return;
    }

    const patternItems = patterns.map(pattern => ({
      label: pattern.name,
      description: pattern.description,
      detail: pattern.pattern.guidance,
      pattern
    }));

    const selectedPattern = await vscode.window.showQuickPick(patternItems, {
      placeHolder: `Select a pattern for ${operationType} policy`,
      canPickMany: false
    });

    if (!selectedPattern) {
      return; // User cancelled
    }

    // Step 4: Guided field selection for each rule
    const fieldSelections: { [ruleName: string]: string[] } = {};
    
    for (const rule of selectedPattern.pattern.pattern.structure) {
      const selectedFields = await selectFieldsForRule(rule, availableFields);
      if (selectedFields.length > 0) {
        fieldSelections[rule.name] = selectedFields;
      }
    }

    // Step 5: Generate policy from pattern
    const policy = services.policyTemplate.generatePolicyFromPattern(
      selectedPattern.pattern.id,
      fieldSelections
    );

    if (!policy) {
      vscode.window.showErrorMessage("Failed to generate policy from pattern");
      return;
    }

    // Step 6: Add policy to config.yaml
    await addPolicyToConfig(policy);

  } catch (error) {
    services.logger.error("Error creating field policy from pattern", error);
    vscode.window.showErrorMessage("Failed to create field policy from pattern");
  }
}

async function selectFieldsForRule(
  rule: PatternRule, 
  availableFields: any[]
): Promise<string[]> {
  // Get field suggestions for this rule
  const suggestions = services.policyTemplate.suggestFieldsForPattern(rule, availableFields);
  
  // Show rule description
  await vscode.window.showInformationMessage(
    `Selecting fields for: ${rule.name}\n${rule.description}`
  );

  // Create field selection items with confidence indicators
  const fieldItems = suggestions.map(suggestion => ({
    label: suggestion.fieldName,
    description: suggestion.reason,
    detail: `Confidence: ${Math.round(suggestion.confidence * 100)}%`,
    picked: suggestion.confidence > 0.7, // Auto-select high confidence fields
    suggestion
  }));

  // Let user select fields
  const selectedItems = await vscode.window.showQuickPick(fieldItems, {
    placeHolder: `Select fields for ${rule.name} (${rule.description})`,
    canPickMany: true
  });

  if (!selectedItems) {
    return [];
  }

  return selectedItems.map(item => item.suggestion.fieldName);
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