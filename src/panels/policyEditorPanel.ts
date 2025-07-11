/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import { BaseWebviewPanel } from "./BaseWebviewPanel";
import { services } from "../services";
import { FieldPolicy } from "../types/fieldPolicy";
import { EXTENSION_URI } from "../extension";

export class PolicyEditorPanel extends BaseWebviewPanel {
  private static instance: PolicyEditorPanel | undefined;
  private currentPolicy: FieldPolicy | null = null;
  private schemaFields: any = {};
  protected disposables: vscode.Disposable[] = [];

  private constructor(extensionUri: vscode.Uri) {
    super(extensionUri);
  }

  public static getInstance(): PolicyEditorPanel {
    if (!PolicyEditorPanel.instance) {
      PolicyEditorPanel.instance = new PolicyEditorPanel(EXTENSION_URI);
    }
    return PolicyEditorPanel.instance;
  }

  public async openWithPolicy(policy: FieldPolicy | null = null): Promise<void> {
    this.currentPolicy = policy;
    
    // Load schema fields
    this.schemaFields = services.schemaIndex.getFieldIndex();
    
    services.logger.info("Opening Policy Editor Panel");

    if (!this.panel) {
      this.panel = this.createWebviewPanel(
        "policyEditor",
        "Field Policy Editor",
        vscode.ViewColumn.Active
      );

      this.setupMessageHandling();
    }

    this.reveal();
    this.panel.webview.html = this.generateHtml(this.panel.webview);
  }

  private setupMessageHandling(): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "savePolicy":
            await this.handleSavePolicy(message.policy);
            break;
          case "validatePolicy":
            await this.handleValidatePolicy(message.policy);
            break;
          case "getSchemaFields":
            await this.handleGetSchemaFields(message.operationType);
            break;
          case "testPolicy":
            await this.handleTestPolicy(message.policy, message.jwtToken);
            break;
          case "loadTemplate":
            await this.handleLoadTemplate();
            break;
        }
      },
      undefined,
      this.disposables
    );
  }

  private async handleSavePolicy(policy: FieldPolicy): Promise<void> {
    try {
      // Validate policy first
      const validationResult = await services.fieldPolicyParser.parse(
        this.policyToYaml(policy)
      );

      if (!validationResult.isValid) {
        const errorMessage = validationResult.errors.map(e => e.message).join('\n');
        vscode.window.showErrorMessage(`Policy validation failed:\n${errorMessage}`);
        return;
      }

      // Save to config.yaml
      const projectRoot = await services.projectResolver.resolveStepZenProjectRoot();
      const configPath = require('path').join(projectRoot, "config.yaml");
      const fs = require('fs');
      const yaml = require('js-yaml');

      let config: any = {};
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, "utf8");
        config = yaml.load(configContent) || {};
      }

      if (!config.access) {
        config.access = {};
      }
      if (!config.access.policies) {
        config.access.policies = [];
      }

      // Check if policy for this type already exists
      const existingPolicyIndex = config.access.policies.findIndex((p: any) => p.type === policy.type);
      
      if (existingPolicyIndex >= 0) {
        config.access.policies[existingPolicyIndex] = policy;
      } else {
        config.access.policies.push(policy);
      }

      const yamlContent = yaml.dump(config, { indent: 2 });
      fs.writeFileSync(configPath, yamlContent, "utf8");

      vscode.window.showInformationMessage(`Policy for ${policy.type} saved successfully`);
      
      // Open the config file
      const document = await vscode.workspace.openTextDocument(configPath);
      await vscode.window.showTextDocument(document);

    } catch (error) {
      services.logger.error("Error saving policy", error);
      vscode.window.showErrorMessage("Failed to save policy");
    }
  }

  private async handleValidatePolicy(policy: FieldPolicy): Promise<void> {
    try {
      const validationResult = await services.fieldPolicyParser.parse(
        this.policyToYaml(policy)
      );

      if (validationResult.isValid) {
        vscode.window.showInformationMessage("Policy is valid!");
      } else {
        const errorMessage = validationResult.errors.map(e => e.message).join('\n');
        vscode.window.showErrorMessage(`Policy validation failed:\n${errorMessage}`);
      }
    } catch (error) {
      services.logger.error("Error validating policy", error);
      vscode.window.showErrorMessage("Failed to validate policy");
    }
  }

  private async handleGetSchemaFields(operationType: string): Promise<void> {
    const fields = this.schemaFields[operationType] || [];
    this.panel?.webview.postMessage({
      command: "schemaFieldsResponse",
      operationType,
      fields: fields.map((f: any) => ({ name: f.name, type: f.type }))
    });
  }

  private async handleTestPolicy(_policy: FieldPolicy, _jwtToken: string): Promise<void> {
    // TODO: Implement policy testing with JWT simulation
    vscode.window.showInformationMessage("Policy testing feature coming soon!");
  }

  private async handleLoadTemplate(): Promise<void> {
    try {
      // Get the current operation type from the panel
      const operationType = this.currentPolicy?.type || 'Query';
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
        placeHolder: `Select a template to load`,
        canPickMany: false
      });

      if (!selectedTemplate) {
        return; // User cancelled
      }

      const result = services.policyTemplate.generatePolicyFromTemplate(selectedTemplate.template.id);
      if (!result) {
        vscode.window.showErrorMessage("Failed to generate policy from template");
        return;
      }

      // Load the template into the editor
      this.currentPolicy = result.generatedPolicy;
      this.panel?.webview.postMessage({
        command: "loadPolicy",
        policy: result.generatedPolicy
      });

      vscode.window.showInformationMessage(`Loaded template: ${selectedTemplate.template.name}`);

    } catch (error) {
      services.logger.error("Error loading template", error);
      vscode.window.showErrorMessage("Failed to load template");
    }
  }

  private policyToYaml(policy: FieldPolicy): string {
    const yaml = require('js-yaml');
    const config = {
      access: {
        policies: [policy]
      }
    };
    return yaml.dump(config, { indent: 2 });
  }

  protected onDispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    super.onDispose();
    PolicyEditorPanel.instance = undefined;
  }

  protected generateHtml(webview: vscode.Webview): string {
    const nonce = this.nonce();
    const policyData = this.currentPolicy ? JSON.stringify(this.currentPolicy) : 'null';
    const schemaData = JSON.stringify(this.schemaFields);

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="${this.csp(webview, nonce)}">
        <meta name="color-scheme" content="light dark">
        <title>Field Policy Editor</title>
        <style nonce="${nonce}">
          body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
          }
          .form-section {
            margin-bottom: 20px;
            padding: 15px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 6px;
          }
          .form-group {
            margin-bottom: 15px;
          }
          label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
          }
          input, select, textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
          }
          .button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
          }
          .button:hover {
            background: var(--vscode-button-hoverBackground);
          }
          .button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
          }
          .button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
          }
          .rules-container {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 10px;
            margin-top: 10px;
          }
          .rule-item {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 10px;
          }
          .field-selector {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 5px;
          }
          .field-option {
            padding: 5px;
            cursor: pointer;
            border-radius: 2px;
          }
          .field-option:hover {
            background: var(--vscode-list-hoverBackground);
          }
          .field-option.selected {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
          }
          .condition-builder {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 10px;
            margin-top: 10px;
          }
          .condition-type {
            margin-bottom: 10px;
          }
          .condition-inputs {
            display: none;
          }
          .condition-inputs.active {
            display: block;
          }
          .error {
            color: var(--vscode-errorForeground);
            font-size: 12px;
            margin-top: 5px;
          }
          .success {
            color: var(--vscode-testing-iconPassed);
            font-size: 12px;
            margin-top: 5px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Field Policy Editor</h1>
          <div>
            <button class="button secondary" onclick="validatePolicy()">Validate</button>
            <button class="button secondary" onclick="testPolicy()">Test</button>
            <button class="button" onclick="savePolicy()">Save Policy</button>
          </div>
        </div>

        <div class="form-section">
          <div class="form-group">
            <label for="operationType">Operation Type:</label>
            <select id="operationType" onchange="onOperationTypeChange()">
              <option value="Query">Query</option>
              <option value="Mutation">Mutation</option>
              <option value="Subscription">Subscription</option>
            </select>
          </div>
          <div class="form-group">
            <button class="button secondary" onclick="loadTemplate()">Load Template</button>
            <button class="button secondary" onclick="clearPolicy()">Clear Policy</button>
          </div>
        </div>

        <div class="form-section">
          <h3>Policy Rules</h3>
          <div id="rulesContainer" class="rules-container">
            <div id="noRulesMessage">No rules defined. Add a rule to get started.</div>
          </div>
          <button class="button secondary" onclick="addRule()">Add Rule</button>
        </div>

        <div class="form-section">
          <h3>Default Policy</h3>
          <div class="form-group">
            <label for="defaultCondition">Default Condition:</label>
            <input type="text" id="defaultCondition" placeholder="e.g., true, ?$jwt, false" value="false">
            <div class="error" id="defaultConditionError"></div>
          </div>
        </div>

        <script nonce="${nonce}">
          let currentPolicy = ${policyData};
          let schemaFields = ${schemaData};
          let ruleCounter = 0;

          function initializeEditor() {
            if (currentPolicy) {
              document.getElementById('operationType').value = currentPolicy.type;
              document.getElementById('defaultCondition').value = currentPolicy.policyDefault.condition;
              
              currentPolicy.rules.forEach(rule => {
                addRuleToUI(rule);
              });
            }
          }

          function onOperationTypeChange() {
            const operationType = document.getElementById('operationType').value;
            vscode.postMessage({
              command: 'getSchemaFields',
              operationType: operationType
            });
          }

          function addRule() {
            const rule = {
              name: '',
              condition: '',
              fields: []
            };
            addRuleToUI(rule);
          }

          function addRuleToUI(rule) {
            const rulesContainer = document.getElementById('rulesContainer');
            const noRulesMessage = document.getElementById('noRulesMessage');
            
            if (noRulesMessage) {
              noRulesMessage.style.display = 'none';
            }

            const ruleId = ruleCounter++;
            const ruleElement = document.createElement('div');
            ruleElement.className = 'rule-item';
            ruleElement.innerHTML = \`
              <div class="form-group">
                <label>Rule Name:</label>
                <input type="text" id="ruleName\${ruleId}" placeholder="e.g., admin access" value="\${rule.name || ''}">
              </div>
              <div class="form-group">
                <label>Condition:</label>
                <select id="conditionType\${ruleId}" onchange="onConditionTypeChange(\${ruleId})">
                  <option value="public">Public Access</option>
                  <option value="jwt-required">JWT Required</option>
                  <option value="role-based">Role-Based</option>
                  <option value="array-membership">Array Membership</option>
                  <option value="custom">Custom Condition</option>
                </select>
                <div id="conditionInputs\${ruleId}" class="condition-inputs">
                  <input type="text" id="conditionValue\${ruleId}" placeholder="Enter condition...">
                </div>
              </div>
              <div class="form-group">
                <label>Fields:</label>
                <div id="fieldSelector\${ruleId}" class="field-selector">
                  <div>Loading fields...</div>
                </div>
              </div>
              <button class="button secondary" onclick="removeRule(\${ruleId})">Remove Rule</button>
            \`;
            
            rulesContainer.appendChild(ruleElement);
            
            // Initialize condition
            if (rule.condition) {
              setConditionFromValue(ruleId, rule.condition);
            }
            
            // Load fields
            loadFieldsForRule(ruleId);
          }

          function onConditionTypeChange(ruleId) {
            const conditionType = document.getElementById('conditionType' + ruleId).value;
            const inputsDiv = document.getElementById('conditionInputs' + ruleId);
            const valueInput = document.getElementById('conditionValue' + ruleId);
            
            inputsDiv.className = 'condition-inputs active';
            
            switch (conditionType) {
              case 'public':
                valueInput.value = 'true';
                valueInput.readOnly = true;
                break;
              case 'jwt-required':
                valueInput.value = '?$jwt';
                valueInput.readOnly = true;
                break;
              case 'role-based':
                valueInput.value = '$jwt.role:String == "admin"';
                valueInput.readOnly = false;
                break;
              case 'array-membership':
                valueInput.value = '$jwt.groups:String has "admin"';
                valueInput.readOnly = false;
                break;
              case 'custom':
                valueInput.value = '';
                valueInput.readOnly = false;
                break;
            }
          }

          function setConditionFromValue(ruleId, condition) {
            const conditionTypeSelect = document.getElementById('conditionType' + ruleId);
            const valueInput = document.getElementById('conditionValue' + ruleId);
            
            if (condition === 'true') {
              conditionTypeSelect.value = 'public';
            } else if (condition === '?$jwt') {
              conditionTypeSelect.value = 'jwt-required';
            } else if (condition.includes('role:String')) {
              conditionTypeSelect.value = 'role-based';
            } else if (condition.includes('has')) {
              conditionTypeSelect.value = 'array-membership';
            } else {
              conditionTypeSelect.value = 'custom';
            }
            
            valueInput.value = condition;
            onConditionTypeChange(ruleId);
          }

          function loadFieldsForRule(ruleId) {
            const operationType = document.getElementById('operationType').value;
            const fields = schemaFields[operationType] || [];
            const fieldSelector = document.getElementById('fieldSelector' + ruleId);
            
            fieldSelector.innerHTML = '';
            
            fields.forEach(field => {
              const option = document.createElement('div');
              option.className = 'field-option';
              option.textContent = field.name + ' (' + field.type + ')';
              option.onclick = () => toggleFieldSelection(option, ruleId);
              fieldSelector.appendChild(option);
            });
          }

          function toggleFieldSelection(option, ruleId) {
            option.classList.toggle('selected');
          }

          function removeRule(ruleId) {
            const ruleElement = document.getElementById('ruleName' + ruleId).closest('.rule-item');
            ruleElement.remove();
            
            const rulesContainer = document.getElementById('rulesContainer');
            if (rulesContainer.children.length === 0) {
              const noRulesMessage = document.getElementById('noRulesMessage');
              if (noRulesMessage) {
                noRulesMessage.style.display = 'block';
              }
            }
          }

          function collectPolicy() {
            const operationType = document.getElementById('operationType').value;
            const defaultCondition = document.getElementById('defaultCondition').value;
            
            const rules = [];
            const ruleElements = document.querySelectorAll('.rule-item');
            
            ruleElements.forEach((element, index) => {
              const ruleId = element.querySelector('input[id^="ruleName"]').id.replace('ruleName', '');
              const name = document.getElementById('ruleName' + ruleId).value;
              const condition = document.getElementById('conditionValue' + ruleId).value;
              
              const selectedFields = [];
              const fieldOptions = element.querySelectorAll('.field-option.selected');
              fieldOptions.forEach(option => {
                const fieldName = option.textContent.split(' (')[0];
                selectedFields.push(fieldName);
              });
              
              if (name && condition && selectedFields.length > 0) {
                rules.push({
                  name: name,
                  condition: condition,
                  fields: selectedFields
                });
              }
            });
            
            return {
              type: operationType,
              rules: rules,
              policyDefault: {
                condition: defaultCondition
              }
            };
          }

          function savePolicy() {
            const policy = collectPolicy();
            vscode.postMessage({
              command: 'savePolicy',
              policy: policy
            });
          }

          function validatePolicy() {
            const policy = collectPolicy();
            vscode.postMessage({
              command: 'validatePolicy',
              policy: policy
            });
          }

          function testPolicy() {
            const policy = collectPolicy();
            const jwtToken = prompt('Enter JWT token for testing (optional):');
            vscode.postMessage({
              command: 'testPolicy',
              policy: policy,
              jwtToken: jwtToken || ''
            });
          }

          function loadTemplate() {
            vscode.postMessage({
              command: 'loadTemplate'
            });
          }

          function clearPolicy() {
            currentPolicy = null;
            document.getElementById('operationType').value = 'Query';
            document.getElementById('defaultCondition').value = 'false';
            document.getElementById('rulesContainer').innerHTML = '<div id="noRulesMessage">No rules defined. Add a rule to get started.</div>';
            ruleCounter = 0;
          }

          // Handle messages from the extension
          window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
              case 'loadPolicy':
                currentPolicy = message.policy;
                initializeEditor();
                break;
            }
          });

          // Initialize the editor
          initializeEditor();
          onOperationTypeChange();
        </script>
      </body>
      </html>
    `;
  }
} 