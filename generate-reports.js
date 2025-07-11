/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

const fs = require('fs');
const path = require('path');

// Import the compiled services
const { SchemaIndexService } = require('./out/services/SchemaIndexService');
const { FieldPolicyParser } = require('./out/services/fieldPolicyParser');
const { generateFieldAccessReportData } = require('./out/services/fieldAccessReport');

async function generateReports() {
  const fixturesDir = path.join(__dirname, 'src/test/fixtures/field-policies');
  const schemaDir = path.join(__dirname, 'src/test/fixtures/schema-sample');

  // Set up schema index
  const schemaIndex = new SchemaIndexService();
  const schemaEntry = path.join(schemaDir, 'index.graphql');
  await schemaIndex.scan(schemaEntry);

  const policyParser = new FieldPolicyParser();
  
  // Get all YAML fixture files
  const fixtureFiles = fs.readdirSync(fixturesDir)
    .filter(file => file.endsWith('.yaml'))
    .map(file => file.replace('.yaml', ''));

  console.log('\n=== FIELD ACCESS REPORT GENERATION ===\n');

  for (const fixtureName of fixtureFiles) {
    const configPath = path.join(fixturesDir, `${fixtureName}.yaml`);
    const configContent = fs.readFileSync(configPath, 'utf8');

    console.log(`\n--- ${fixtureName} ---`);
    console.log(`Policy Config:`);
    console.log(configContent);
    
    try {
      const report = await generateFieldAccessReportData(schemaIndex, policyParser, configContent);
      
      console.log(`\nGenerated Report:`);
      console.log(JSON.stringify(report, null, 2));
      
      // Check if there's an existing expected report
      const expectedReportPath = path.join(fixturesDir, `${fixtureName}.report.json`);
      if (fs.existsSync(expectedReportPath)) {
        const expectedReport = JSON.parse(fs.readFileSync(expectedReportPath, 'utf8'));
        console.log(`\nExisting Expected Report:`);
        console.log(JSON.stringify(expectedReport, null, 2));
        
        console.log(`\nMatch: ${JSON.stringify(report) === JSON.stringify(expectedReport) ? 'YES' : 'NO'}`);
      } else {
        console.log(`\nNo existing expected report found for ${fixtureName}`);
      }
      
    } catch (error) {
      console.error(`\nError generating report: ${error}`);
    }
    
    console.log(`\n${'='.repeat(50)}`);
  }

  console.log('\n=== END OF REPORT GENERATION ===\n');
}

generateReports().catch(console.error); 