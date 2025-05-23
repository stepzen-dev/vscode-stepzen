import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import {
  scanStepZenProject,
  getRootOperationsMap,
  getFieldIndex,
  getPersistedDocMap,
  clearScannerState,
  findDefinition,
} from "../../utils/stepzenProjectScanner";
import { createMock } from "../helpers/test-utils";

suite("StepZen Project Scanner Test Suite", () => {
  // Store originals to restore after tests
  const originalCreateOutputChannel = vscode.window.createOutputChannel;
  const originalWorkspaceConfig = vscode.workspace.getConfiguration;
  const originalWithProgress = vscode.window.withProgress;

  // Mock output channel for verification
  let mockOutputChannel: vscode.OutputChannel;

  setup(() => {
    // Clear scanner state before each test
    clearScannerState();
    
    // Create mock output channel
    mockOutputChannel = createMock<vscode.OutputChannel>({
      appendLine: () => {},
      dispose: () => {},
    });

    // Replace VSCode APIs with our mocks
    (vscode.window.createOutputChannel as any) = function (
      _name: string,
      _languageIdOrOptions?: string | { log: boolean },
    ) {
      return mockOutputChannel;
    };

    // Mock configuration
    vscode.workspace.getConfiguration = () => {
      return createMock<vscode.WorkspaceConfiguration>({
        get: (section: string, defaultValue?: any) => {
          // Default values for testing
          if (section === "logLevel") {
            return "info";
          } else if (section === "logToFile") {
            return false;
          }
          return defaultValue;
        },
      });
    };

    // Mock withProgress to execute the callback immediately
    vscode.window.withProgress = async function <R>(
      _options: vscode.ProgressOptions,
      task: (
        progress: vscode.Progress<{ message?: string; increment?: number }>,
        token: vscode.CancellationToken,
      ) => Thenable<R>,
    ): Promise<R> {
      const mockProgress = createMock<vscode.Progress<{ message?: string; increment?: number }>>({
        report: () => {},
      });
      const mockToken = createMock<vscode.CancellationToken>({
        isCancellationRequested: false,
        onCancellationRequested: () => ({ dispose: () => {} }),
      });
      return await task(mockProgress, mockToken);
    };
  });

  teardown(() => {
    // Restore original functions
    vscode.window.createOutputChannel = originalCreateOutputChannel;
    vscode.workspace.getConfiguration = originalWorkspaceConfig;
    vscode.window.withProgress = originalWithProgress;
  });

  test("scanStepZenProject should scan fixture and populate maps correctly", async () => {
    // Get the path to our test fixture (use source path since fixtures aren't compiled)
    const fixturePath = path.join(__dirname, "..", "..", "..", "src", "test", "fixtures", "schema-sample", "index.graphql");
    
    // Scan the project
    await scanStepZenProject(fixturePath);

    // Test 1: Check that we have root operations
    const rootOperationsMap = getRootOperationsMap();
    assert.ok(
      Object.keys(rootOperationsMap).length >= 2,
      `Expected at least 2 root operations, got ${Object.keys(rootOperationsMap).length}. Operations: ${Object.keys(rootOperationsMap).join(", ")}`,
    );

    // Test 2: Check specific field names are present
    assert.ok(
      "hello" in rootOperationsMap,
      "Expected 'hello' field in root operations",
    );
    assert.ok(
      "user" in rootOperationsMap,
      "Expected 'user' field in root operations",
    );

    // Test 3: Check that Query type has fields in field index
    const fieldIndex = getFieldIndex();
    assert.ok(
      "Query" in fieldIndex,
      "Expected 'Query' type in field index",
    );
    assert.ok(
      fieldIndex["Query"].length > 0,
      `Expected Query type to have fields, got ${fieldIndex["Query"].length}`,
    );

    // Test 4: Check that we have at least one persisted document
    const persistedDocMap = getPersistedDocMap();
    assert.ok(
      Object.keys(persistedDocMap).length > 0,
      `Expected at least one persisted document, got ${Object.keys(persistedDocMap).length}`,
    );

    // Additional verification: Check that persisted documents contain operations
    const persistedDocs = Object.values(persistedDocMap);
    const hasOperations = persistedDocs.some(doc => doc.operations && doc.operations.length > 0);
    assert.ok(
      hasOperations,
      "Expected at least one persisted document to contain operations",
    );
  });

  test("scanStepZenProject should handle nested SDL files with executables", async () => {
    // Get the path to our test fixture (use source path since fixtures aren't compiled)
    const fixturePath = path.join(__dirname, "..", "..", "..", "src", "test", "fixtures", "schema-sample", "index.graphql");
    
    // Scan the project
    await scanStepZenProject(fixturePath);

    // Check that we found the nested executable from products/index.graphql
    const persistedDocMap = getPersistedDocMap();
    const persistedDocs = Object.values(persistedDocMap);
    
    // Should have at least one persisted document from the nested SDL
    const hasPersistedFromNested = persistedDocs.some(doc => 
      doc.fileUri.toString().includes("product-queries.graphql")
    );
    
    assert.ok(
      hasPersistedFromNested,
      "Expected to find persisted document from nested SDL directive (product-queries.graphql)",
    );
  });

  test("scanStepZenProject should populate field index with type information", async () => {
    // Get the path to our test fixture (use source path since fixtures aren't compiled)
    const fixturePath = path.join(__dirname, "..", "..", "..", "src", "test", "fixtures", "schema-sample", "index.graphql");
    
    // Scan the project
    await scanStepZenProject(fixturePath);

    const fieldIndex = getFieldIndex();
    
    // Should have various types from our fixture
    const expectedTypes = ["Query", "User", "Product", "Category"];
    
    for (const typeName of expectedTypes) {
      assert.ok(
        typeName in fieldIndex,
        `Expected '${typeName}' type in field index. Available types: ${Object.keys(fieldIndex).join(", ")}`,
      );
    }

    // Query should have the fields we defined
    const queryFields = fieldIndex["Query"];
    const queryFieldNames = queryFields.map(field => field.name);
    
    assert.ok(
      queryFieldNames.includes("hello"),
      `Expected 'hello' field in Query type. Available fields: ${queryFieldNames.join(", ")}`,
    );
    assert.ok(
      queryFieldNames.includes("user"),
      `Expected 'user' field in Query type. Available fields: ${queryFieldNames.join(", ")}`,
    );
  });

  // New comprehensive tests for go-to-definition functionality
  suite("Go to Definition Tests", () => {
    let fixturePath: string;

    setup(async () => {
      // Get the path to our test fixture and scan the project once for all go-to-definition tests
      fixturePath = path.join(__dirname, "..", "..", "..", "src", "test", "fixtures", "schema-sample", "index.graphql");
      await scanStepZenProject(fixturePath);
    });

    test("should find type definitions for custom types", () => {
      // Test finding Product type definition (used in extension.graphql line 14: favoriteProducts: [Product])
      const productDefs = findDefinition("Product");
      assert.ok(productDefs && productDefs.length > 0, "Should find Product type definition");
      assert.ok(
        productDefs[0].filePath.includes("products/types/product.graphql"),
        `Product should be defined in products/types/product.graphql, found in: ${productDefs[0].filePath}`,
      );
      assert.strictEqual(productDefs[0].container, null, "Product should be a type-level definition");

      // Test finding Order type definition (used in extension.graphql line 5: recentOrders: [Order])
      const orderDefs = findDefinition("Order");
      assert.ok(orderDefs && orderDefs.length > 0, "Should find Order type definition");
      assert.ok(
        orderDefs[0].filePath.includes("orders/atom.graphql"),
        `Order should be defined in orders/atom.graphql, found in: ${orderDefs[0].filePath}`,
      );

      // Test finding User type definition
      const userDefs = findDefinition("User");
      assert.ok(userDefs && userDefs.length > 0, "Should find User type definition");
      assert.ok(
        userDefs[0].filePath.includes("users/schema.graphql"),
        `User should be defined in users/schema.graphql, found in: ${userDefs[0].filePath}`,
      );
    });

    test("should find enum definitions", () => {
      // Test finding ShippingCarrier enum (defined in extension.graphql)
      const carrierDefs = findDefinition("ShippingCarrier");
      assert.ok(carrierDefs && carrierDefs.length > 0, "Should find ShippingCarrier enum definition");
      assert.ok(
        carrierDefs[0].filePath.includes("extension.graphql"),
        `ShippingCarrier should be defined in extension.graphql, found in: ${carrierDefs[0].filePath}`,
      );

      // Test finding Currency enum (defined in products/types/product.graphql)
      const currencyDefs = findDefinition("Currency");
      assert.ok(currencyDefs && currencyDefs.length > 0, "Should find Currency enum definition");
      assert.ok(
        currencyDefs[0].filePath.includes("products/types/product.graphql"),
        `Currency should be defined in products/types/product.graphql, found in: ${currencyDefs[0].filePath}`,
      );

      // Test finding OrderStatus enum (defined in orders/atom.graphql)
      const statusDefs = findDefinition("OrderStatus");
      assert.ok(statusDefs && statusDefs.length > 0, "Should find OrderStatus enum definition");
      assert.ok(
        statusDefs[0].filePath.includes("orders/atom.graphql"),
        `OrderStatus should be defined in orders/atom.graphql, found in: ${statusDefs[0].filePath}`,
      );
    });

    test("should find interface definitions", () => {
      // Test finding Node interface (defined in products/types/product.graphql)
      const nodeDefs = findDefinition("Node");
      assert.ok(nodeDefs && nodeDefs.length > 0, "Should find Node interface definition");
      assert.ok(
        nodeDefs[0].filePath.includes("products/types/product.graphql"),
        `Node should be defined in products/types/product.graphql, found in: ${nodeDefs[0].filePath}`,
      );
      assert.strictEqual(nodeDefs[0].container, null, "Node should be a type-level definition");
    });

    test("should find union definitions", () => {
      // Test finding SearchResult union (defined in products/types/product.graphql)
      const searchDefs = findDefinition("SearchResult");
      assert.ok(searchDefs && searchDefs.length > 0, "Should find SearchResult union definition");
      assert.ok(
        searchDefs[0].filePath.includes("products/types/product.graphql"),
        `SearchResult should be defined in products/types/product.graphql, found in: ${searchDefs[0].filePath}`,
      );
    });

    test("should find scalar definitions", () => {
      // Test finding custom scalar UUID (defined in index.graphql)
      const uuidDefs = findDefinition("UUID");
      assert.ok(uuidDefs && uuidDefs.length > 0, "Should find UUID scalar definition");
      assert.ok(
        uuidDefs[0].filePath.includes("index.graphql"),
        `UUID should be defined in index.graphql, found in: ${uuidDefs[0].filePath}`,
      );

      // Test finding EmailAddress scalar (defined in index.graphql)
      const emailDefs = findDefinition("EmailAddress");
      assert.ok(emailDefs && emailDefs.length > 0, "Should find EmailAddress scalar definition");
      assert.ok(
        emailDefs[0].filePath.includes("index.graphql"),
        `EmailAddress should be defined in index.graphql, found in: ${emailDefs[0].filePath}`,
      );
    });

    test("should find field definitions within types (current behavior: root fields only)", () => {
      // Test finding Query fields (root operations) - this works correctly
      const helloDefs = findDefinition("hello");
      assert.ok(helloDefs && helloDefs.length > 0, "Should find hello field definition");
      const helloInQuery = helloDefs.find(def => def.container === "Query");
      assert.ok(helloInQuery, "Should find hello field in Query type");

      const userDefs = findDefinition("user");
      assert.ok(userDefs && userDefs.length > 0, "Should find user field definition");
      const userInQuery = userDefs.find(def => def.container === "Query");
      assert.ok(userInQuery, "Should find user field in Query type");

      // Current behavior: findDefinition only works for root operation fields, not regular type fields
      // This is the current scanner behavior that we're capturing with golden-path tests
      // TODO: In the future, findDefinition could be enhanced to also find fields within regular types
      const recentOrdersDefs = findDefinition("recentOrders");
      assert.strictEqual(recentOrdersDefs, undefined, "Current scanner behavior: findDefinition doesn't find non-root fields");

      const favoriteProductsDefs = findDefinition("favoriteProducts");
      assert.strictEqual(favoriteProductsDefs, undefined, "Current scanner behavior: findDefinition doesn't find non-root fields");

      // However, these fields should be available in the field index
      const fieldIndex = getFieldIndex();
      assert.ok(fieldIndex["User"], "User type should be in field index");
      const userFields = fieldIndex["User"];
      const recentOrdersField = userFields.find(f => f.name === "recentOrders");
      const favoriteProductsField = userFields.find(f => f.name === "favoriteProducts");
      
      assert.ok(recentOrdersField, "recentOrders field should be in User field index");
      assert.ok(favoriteProductsField, "favoriteProducts field should be in User field index");
      assert.strictEqual(recentOrdersField.type, "Order", "recentOrders should return Order type");
      assert.strictEqual(favoriteProductsField.type, "Product", "favoriteProducts should return Product type");
      assert.strictEqual(recentOrdersField.isList, true, "recentOrders should be a list");
      assert.strictEqual(favoriteProductsField.isList, true, "favoriteProducts should be a list");
    });

    test("should handle symbols that don't exist", () => {
      // Test searching for non-existent symbols
      const nonExistentDefs = findDefinition("NonExistentType");
      assert.strictEqual(nonExistentDefs, undefined, "Should return undefined for non-existent symbols");

      const anotherNonExistentDefs = findDefinition("FakeField");
      assert.strictEqual(anotherNonExistentDefs, undefined, "Should return undefined for non-existent fields");
    });

    test("should handle invalid input gracefully", () => {
      // Test with empty string
      const emptyDefs = findDefinition("");
      assert.strictEqual(emptyDefs, undefined, "Should return undefined for empty string");

      // Test with null/undefined (TypeScript should prevent this, but test runtime behavior)
      const nullDefs = findDefinition(null as any);
      assert.strictEqual(nullDefs, undefined, "Should return undefined for null input");

      const undefinedDefs = findDefinition(undefined as any);
      assert.strictEqual(undefinedDefs, undefined, "Should return undefined for undefined input");
    });

    test("should find multiple definitions when symbols are extended", () => {
      // User type is defined in users/schema.graphql and extended in extension.graphql
      const userTypeDefs = findDefinition("User");
      assert.ok(userTypeDefs && userTypeDefs.length > 0, "Should find User type definitions");
      
      // Should find the main User type definition
      const mainUserDef = userTypeDefs.find(def => def.container === null);
      assert.ok(mainUserDef, "Should find main User type definition");
      assert.ok(
        mainUserDef.filePath.includes("users/schema.graphql"),
        "Main User definition should be in users/schema.graphql",
      );

      // Product type is defined in products/types/product.graphql and extended in extension.graphql
      const productTypeDefs = findDefinition("Product");
      assert.ok(productTypeDefs && productTypeDefs.length > 0, "Should find Product type definitions");
      
      // Should find the main Product type definition
      const mainProductDef = productTypeDefs.find(def => def.container === null);
      assert.ok(mainProductDef, "Should find main Product type definition");
      assert.ok(
        mainProductDef.filePath.includes("products/types/product.graphql"),
        "Main Product definition should be in products/types/product.graphql",
      );
    });
  });
}); 