/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import { readFileSync, existsSync } from "fs";
import * as path from "path";
import { logger } from '../logger';

/**
 * Traverses @sdl include directives in a loop-safe manner
 * @param entryFile The starting file path
 * @returns Array of all linked schema file paths
 */
export function traverseSDLIncludes(entryFile: string): string[] {
  if (!entryFile || typeof entryFile !== 'string') {
    logger.error('Invalid entry file path provided to traverseSDLIncludes');
    return [];
  }

  if (!existsSync(entryFile)) {
    logger.error(`File not found: ${entryFile}`);
    return [];
  }

  const visited = new Set<string>();
  const schemaFiles: string[] = [];
  const queue: string[] = [entryFile];

  while (queue.length) {
    const file = queue.pop()!;
    
    if (visited.has(file)) {
      continue;
    }
    
    visited.add(file);
    schemaFiles.push(file);
    
    try {
      const content = readFileSync(file, "utf8");
      
      // Find @sdl(files: [...]) directives
      const includeListRegex = /@sdl\(\s*files?\s*:\s*\[([^]+?)\]/g;
      for (const inc of content.matchAll(includeListRegex)) {
        const raw = inc[1];
        const pathRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g;
        
        for (const m of raw.matchAll(pathRegex)) {
          const rel = (m[1] ?? m[2]).trim();
          if (!rel) {
            continue;
          }
          
          const abs = path.join(path.dirname(file), rel);
          if (!visited.has(abs) && existsSync(abs)) {
            queue.push(abs);
          }
        }
      }
    } catch (err) {
      logger.error(`Error reading file ${file}: ${err}`);
    }
  }

  return schemaFiles;
} 