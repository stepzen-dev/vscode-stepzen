import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { logger } from './logger';
import { CliError } from '../errors';

/**
 * Service for interacting with the StepZen CLI
 * Centralized handling of all StepZen CLI operations
 */
export class StepzenCliService {
  /**
   * Deploy a schema to StepZen
   * 
   * @param schemaPath Path to the schema file or directory to deploy
   * @returns Promise that resolves when deployment is complete
   * @throws CliError if the operation fails
   */
  async deploy(): Promise<void> {
    try {
      logger.info('Starting StepZen deployment...');
      
      // Import services here to avoid circular dependency
      const { services } = await import('./index.js');
      const projectRoot = await services.projectResolver.resolveStepZenProjectRoot();
      
      // Instead of using inherit, we'll capture the output for better error handling
      const result = await this.spawnProcessWithOutput(['deploy'], {
        cwd: projectRoot
      });
      
      // Log the output for debugging
      result.split('\n').forEach((line: string) => {
        if (line.trim()) {
          logger.debug(`Deploy output: ${line.trim()}`);
        }
      });
      
      logger.info('StepZen deploy completed successfully');
    } catch (err) {
      // Create a more descriptive error with deployment details
      let errorMessage = 'Failed to deploy StepZen schema';
      
      // Extract additional information from standard error if available
      if (err instanceof Error && err.message.includes('stepzen deploy exited with code')) {
        errorMessage += ': Command failed with non-zero exit code';
      }
      
      const error = new CliError(
        errorMessage,
        'DEPLOY_FAILED',
        err
      );
      throw error;
    }
  }

  /**
   * Execute a GraphQL request using the StepZen CLI
   * 
   * @param query The GraphQL query to execute
   * @param vars Optional variables to pass to the query
   * @param operationName Optional name of the operation to execute
   * @param debugLevel Optional debug level (defaults to 1)
   * @returns Promise resolving to the response string
   * @throws CliError if the operation fails
   */
  async request(query: string, vars?: object, operationName?: string, debugLevel: number = 1): Promise<string> {
    let tmpFile = '';
    let varsFile = '';
    
    try {
      logger.info('Executing StepZen GraphQL request...');
      
      // Import services here to avoid circular dependency
      const { services } = await import('./index.js');
      const projectRoot = await services.projectResolver.resolveStepZenProjectRoot();
      
      // Create a temporary file with the query in system temp directory
      const timestamp = new Date().getTime();
      tmpFile = path.join(os.tmpdir(), `stepzen-query-${timestamp}.graphql`);
      fs.writeFileSync(tmpFile, query, 'utf8');
      logger.debug(`Created temporary query file: ${tmpFile}`);
      
      // Prepare variable arguments if vars are provided
      const varArgs: string[] = [];
      if (vars && Object.keys(vars).length > 0) {
        // Create a temporary file with the variables in system temp directory
        varsFile = path.join(os.tmpdir(), `stepzen-vars-${timestamp}.json`);
        fs.writeFileSync(varsFile, JSON.stringify(vars, null, 2), 'utf8');
        logger.debug(`Created temporary variables file: ${varsFile}`);
        varArgs.push('--var-file', varsFile);
        
        // Clean up vars file when done
        setTimeout(() => {
          try {
            if (fs.existsSync(varsFile)) {
              fs.unlinkSync(varsFile);
              logger.debug(`Cleaned up temporary variables file: ${varsFile}`);
            }
          } catch (e) {
            logger.warn(`Failed to clean up temporary variables file: ${e}`);
          }
        }, 5000);
      }
      
      // Build args array for the request command
      const args = [
        'request',
        '--file', tmpFile,
        ...(operationName ? ['--operation-name', operationName] : []),
        '--header', `"stepzen-debug-level: ${debugLevel}"`,
        ...varArgs
      ];
      
      // Execute the request
      logger.debug(`Executing StepZen request with args: ${args.join(' ')}${operationName ? ` (operation: ${operationName})` : ''}, debug level: ${debugLevel}`);
      let stdout;
      try {
        stdout = await this.spawnProcessWithOutput(args, {
          cwd: projectRoot
        });
        logger.debug('Request completed successfully');
      } catch (err) {
        logger.error(`StepZen request failed: ${err instanceof Error ? err.message : String(err)}`);
        // Clean up temporary files immediately if there's an error
        try {
          if (fs.existsSync(tmpFile)) {
            fs.unlinkSync(tmpFile);
            logger.debug(`Cleaned up temporary query file after error: ${tmpFile}`);
          }
        } catch (e) {
          // Just log and continue since we're already in an error handler
          logger.warn(`Failed to clean up temporary query file: ${e}`);
        }
        throw err;
      }
      
      // Clean up temp file
      setTimeout(() => {
        try {
          if (fs.existsSync(tmpFile)) {
            fs.unlinkSync(tmpFile);
            logger.debug(`Cleaned up temporary query file: ${tmpFile}`);
          }
        } catch (e) {
          logger.warn(`Failed to clean up temporary query file: ${e}`);
        }
      }, 5000);
      
      return stdout;
    } catch (err) {
      const error = new CliError(
        'Failed to execute StepZen request',
        'REQUEST_FAILED',
        err
      );
      throw error;
    }
  }
  
  // TODO: CLEANUP
  //  /**
  //  * Spawn a StepZen CLI process with inherited stdio
  //  * 
  //  * @param command The StepZen command to execute
  //  * @param args Command arguments
  //  * @param options Spawn options
  //  * @returns Promise that resolves when the process completes
  //  * @throws CliError if the process fails
  //  */
  // private async spawnProcess(
  //   command: string,
  //   args: string[] = [],
  //   options: cp.SpawnOptions = {}
  // ): Promise<void> {
  //   return new Promise<void>((resolve, reject) => {
  //     const fullArgs = [command, ...args];
  //     const proc = cp.spawn('stepzen', fullArgs, {
  //       shell: true,
  //       ...options
  //     });
      
  //     let stderr = '';
      
  //     if (proc.stderr) {
  //       proc.stderr.on('data', (data) => {
  //         const chunk = data.toString();
  //         stderr += chunk;
  //         logger.debug(`StepZen CLI stderr: ${chunk.trim()}`);
  //       });
  //     }
      
  //     proc.on('error', (err) => {
  //       reject(new CliError(
  //         `Failed to spawn StepZen CLI: ${err.message}`,
  //         'SPAWN_FAILED',
  //         err
  //       ));
  //     });
      
  //     proc.on('close', (code) => {
  //       if (code !== 0) {
  //         // Create a more descriptive error with exit code and stderr
  //         const errorMsg = stderr.trim() 
  //           ? `StepZen ${command} exited with code ${code}: ${stderr.trim()}`
  //           : `StepZen ${command} exited with code ${code}`;
            
  //         reject(new CliError(
  //           errorMsg,
  //           'COMMAND_FAILED',
  //           stderr ? new Error(stderr) : undefined
  //         ));
  //       } else {
  //         resolve();
  //       }
  //     });
  //   });
  // }
  
  /**
   * Spawn a StepZen CLI process and capture output
   * 
   * @param args Command arguments
   * @param options Spawn options
   * @returns Promise resolving to the captured stdout
   * @throws CliError if the process fails
   */
  private async spawnProcessWithOutput(
    args: string[] = [],
    options: cp.SpawnOptions = {}
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const proc = cp.spawn('stepzen', args, {
        shell: true,
        ...options
      });
    
      // Log the command being executed for debugging
      logger.debug(`Executing: stepzen ${args.join(' ')}`);
      
      let stdout = '';
      let stderr = '';
      
      if (proc.stdout) {
        proc.stdout.on('data', (data) => {
          const chunk = data.toString();
          stdout += chunk;
          // Log stdout to provide real-time progress
          chunk.split('\n').forEach((line: string) => {
            if (line.trim()) {
              logger.debug(`StepZen CLI stdout: ${line.trim()}`);
            }
          });
        });
      }
      
      if (proc.stderr) {
        proc.stderr.on('data', (data) => {
          const chunk = data.toString();
          stderr += chunk;
          // Log stderr to provide real-time error information
          chunk.split('\n').forEach((line: string) => {
            if (line.trim()) {
              logger.debug(`StepZen CLI stderr: ${line.trim()}`);
            }
          });
        });
      }
      
      proc.on('error', (err) => {
        reject(new CliError(
          `Failed to spawn StepZen CLI: ${err.message}`,
          'SPAWN_FAILED',
          err
        ));
      });
      
      proc.on('close', (code) => {
        if (code !== 0) {
          // Create a more descriptive error with both exit code and stderr content
          const errorMsg = stderr.trim() 
            ? `StepZen CLI exited with code ${code}: ${stderr.trim()}`
            : `StepZen CLI exited with code ${code}`;
            
          reject(new CliError(
            errorMsg,
            'COMMAND_FAILED',
            stderr ? new Error(stderr) : undefined
          ));
        } else {
          logger.debug(`StepZen CLI process completed with exit code 0`);
          resolve(stdout);
        }
      });
    });
  }
}