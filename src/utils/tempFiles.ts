/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ValidationError, handleError } from "../errors";
import { TEMP_FILE_PATTERNS, TIMEOUTS } from "./constants";
import { services } from "../services";

/**
 * Creates a temporary GraphQL file with the provided query content
 * @param content The GraphQL query content to write to the file
 * @returns Path to the created temporary file
 * @throws ValidationError if content is invalid or file creation fails
 */
export function createTempGraphQLFile(content: string): string {
  if (!content || typeof content !== 'string') {
    throw new ValidationError(
      "Invalid query content: expected a non-empty string",
      "INVALID_QUERY_CONTENT"
    );
  }
  
  const tempDir = os.tmpdir();
  const timestamp = new Date().getTime();
  const randomPart = Math.random().toString(36).substring(2, 10);
  const filename = `${TEMP_FILE_PATTERNS.QUERY_PREFIX}${timestamp}-${randomPart}${TEMP_FILE_PATTERNS.GRAPHQL_EXTENSION}`;
  const filePath = path.join(tempDir, filename);
  
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    services.logger.debug(`Created temporary query file: ${filePath}`);
    return filePath;
  } catch (err) {
    throw new ValidationError(
      `Failed to create temporary file: ${err instanceof Error ? err.message : String(err)}`,
      "FILE_CREATE_FAILED",
      err
    );
  }
}

/**
 * Schedules cleanup of a temporary file after a delay
 * @param filePath Path to the temporary file to clean up
 * @param delayMs Optional delay in milliseconds before deletion (defaults to TIMEOUTS.FILE_CLEANUP_DELAY_MS)
 */
export function cleanupLater(filePath: string, delayMs: number = TIMEOUTS.FILE_CLEANUP_DELAY_MS): void {
  if (!filePath || typeof filePath !== 'string') {
    services.logger.warn("Invalid path provided to cleanupLater");
    return;
  }
  
  // Only attempt to clean up files in the temp directory for security
  if (!filePath.startsWith(os.tmpdir())) {
    services.logger.warn(`Refusing to clean up non-temporary file: ${filePath}`);
    return;
  }
  
  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        services.logger.debug(`Cleaned up temporary file: ${filePath}`);
      }
    } catch (err) {
      handleError(new ValidationError(
        `Failed to clean up temporary file: ${filePath}`,
        "FILE_CLEANUP_FAILED",
        err
      ));
    }
  }, delayMs);
}

/**
 * Creates a temporary JSON file with the provided data
 * @param data The data to write to the file (will be JSON.stringify'd)
 * @param prefix Optional prefix for the filename (defaults to "stepzen-data-")
 * @returns Path to the created temporary file
 * @throws ValidationError if data is invalid or file creation fails
 */
export function createTempJSONFile(data: any, prefix: string = "stepzen-data-"): string {
  if (data === undefined || data === null) {
    throw new ValidationError(
      "Invalid data: cannot create JSON file with null or undefined data",
      "INVALID_JSON_DATA"
    );
  }
  
  const tempDir = os.tmpdir();
  const timestamp = new Date().getTime();
  const randomPart = Math.random().toString(36).substring(2, 10);
  const filename = `${prefix}${timestamp}-${randomPart}.json`;
  const filePath = path.join(tempDir, filename);
  
  try {
    const jsonContent = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonContent, 'utf8');
    services.logger.debug(`Created temporary JSON file: ${filePath}`);
    return filePath;
  } catch (err) {
    throw new ValidationError(
      `Failed to create temporary JSON file: ${err instanceof Error ? err.message : String(err)}`,
      "FILE_CREATE_FAILED",
      err
    );
  }
} 