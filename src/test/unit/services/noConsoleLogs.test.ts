import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';

/**
 * Recursively scans a directory for files and returns all file paths
 * @param dir Directory to scan
 * @param fileList Optional array to accumulate results
 * @returns Array of file paths
 */
function getAllFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            fileList = getAllFiles(filePath, fileList);
        } else {
            fileList.push(filePath);
        }
    });
    
    return fileList;
}

/**
 * Tests that no console.log statements exist in the compiled code
 */
describe('Code Quality', function() {
    it('should not contain console.log calls in compiled code', function() {
        // Skip test if dist directory doesn't exist
        const distDir = path.join(__dirname, '../../../../dist');
        if (!fs.existsSync(distDir)) {
            this.skip();
            return;
        }
        
        // Get all .js files in the dist directory
        const jsFiles = getAllFiles(distDir).filter(file => file.endsWith('.js'));
        
        // Track violations
        const violations: { file: string, line: string }[] = [];
        
        // Scan each file for console statements
        jsFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            
            lines.forEach((line, index) => {
                // Look for console.log, console.error, etc.
                if (line.includes('console.') && 
                    /console\.(log|error|warn|info|debug)/.test(line)) {
                    violations.push({
                        file: file.substring(distDir.length + 1),
                        line: `Line ${index + 1}: ${line.trim()}`
                    });
                }
            });
        });
        
        if (violations.length > 0) {
            const message = [
                'Found console statements in compiled code:',
                ...violations.map(v => `${v.file}: ${v.line}`)
            ].join('\n');
            assert.fail(message);
        }
    });
});