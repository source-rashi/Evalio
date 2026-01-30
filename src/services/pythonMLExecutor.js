/**
 * Python ML Executor
 * 
 * Executes the local Python ML engine from Node.js using child_process.
 * This is the bridge between the backend and the self-hosted ML system.
 * 
 * WHY THIS EXISTS:
 * - Backend (Node.js) needs to call ML (Python) deterministically
 * - Python ML stays isolated and independent
 * - Enables swapping ML implementations later
 * - Provides timeout and error handling
 * 
 * EXECUTION FLOW:
 * 1. Receive ML input (from mlInputBuilder)
 * 2. Spawn Python subprocess
 * 3. Pass input via stdin as JSON
 * 4. Capture stdout (ML result)
 * 5. Handle errors and timeouts
 * 6. Return parsed result to backend
 */

const { spawn } = require('child_process');
const path = require('path');

/**
 * Execute Python ML evaluation script
 * 
 * This function spawns a Python subprocess, passes the ML input via stdin,
 * and captures the ML result from stdout. Errors are captured from stderr.
 * 
 * @param {Object} mlInput - ML input structure (from mlInputBuilder)
 * @param {Object} options - Execution options
 * @param {number} options.timeout - Maximum execution time in ms (default: 30000)
 * @param {string} options.pythonPath - Path to Python executable (default: 'python')
 * @param {string} options.scriptPath - Path to ML script (default: 'ml/evaluate.py')
 * @returns {Promise<Object>} ML evaluation result
 * @throws {Error} If Python execution fails, times out, or returns invalid JSON
 * 
 * @example
 * const mlInput = buildMLInput({ submission, exam, questions, answers });
 * const mlResult = await executePythonML(mlInput);
 * // mlResult: { results: [...], aiTotalScore: 85, ... }
 */
async function executePythonML(mlInput, options = {}) {
  const {
    timeout = 30000, // 30 seconds default timeout
    pythonPath = process.env.PYTHON_PATH || 'python',
    scriptPath = path.join(process.cwd(), 'ml', 'evaluate.py')
  } = options;

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Spawn Python process
    const pythonProcess = spawn(pythonPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Set timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      pythonProcess.kill('SIGTERM');
      reject(new Error(`Python ML execution timed out after ${timeout}ms`));
    }, timeout);

    // Capture stdout (ML result)
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Capture stderr (errors and logs)
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code) => {
      clearTimeout(timeoutId);

      if (timedOut) {
        return; // Already rejected by timeout
      }

      if (code !== 0) {
        const error = new Error(`Python ML script exited with code ${code}`);
        error.exitCode = code;
        error.stderr = stderr;
        error.stdout = stdout;
        return reject(error);
      }

      // Parse JSON output
      try {
        const mlResult = JSON.parse(stdout);
        resolve(mlResult);
      } catch (parseError) {
        const error = new Error('Failed to parse ML output as JSON');
        error.parseError = parseError.message;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });

    // Handle process errors
    pythonProcess.on('error', (error) => {
      clearTimeout(timeoutId);
      
      if (error.code === 'ENOENT') {
        error.message = `Python executable not found: ${pythonPath}. Install Python or set PYTHON_PATH environment variable.`;
      }
      
      reject(error);
    });

    // Send input to Python via stdin
    try {
      const inputJSON = JSON.stringify(mlInput);
      pythonProcess.stdin.write(inputJSON);
      pythonProcess.stdin.end();
    } catch (writeError) {
      clearTimeout(timeoutId);
      pythonProcess.kill('SIGTERM');
      reject(new Error(`Failed to write input to Python: ${writeError.message}`));
    }
  });
}

/**
 * Check if Python is available on the system
 * 
 * @param {string} pythonPath - Path to Python executable (default: 'python')
 * @returns {Promise<Object>} { available: boolean, version: string|null, error: string|null }
 */
async function checkPythonAvailability(pythonPath = 'python') {
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonPath, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        const versionMatch = output.match(/Python\s+([\d.]+)/i);
        resolve({
          available: true,
          version: versionMatch ? versionMatch[1] : output.trim(),
          error: null
        });
      } else {
        resolve({
          available: false,
          version: null,
          error: `Python check exited with code ${code}`
        });
      }
    });

    pythonProcess.on('error', (error) => {
      resolve({
        available: false,
        version: null,
        error: error.code === 'ENOENT' 
          ? 'Python not found in PATH' 
          : error.message
      });
    });
  });
}

/**
 * Check if ML script exists
 * 
 * @param {string} scriptPath - Path to ML script
 * @returns {Promise<boolean>} True if script exists
 */
async function checkMLScriptExists(scriptPath = path.join(process.cwd(), 'ml', 'evaluate.py')) {
  const fs = require('fs').promises;
  try {
    await fs.access(scriptPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate ML execution environment
 * 
 * Checks if Python is available and ML script exists.
 * Useful for startup validation and health checks.
 * 
 * @returns {Promise<Object>} { ready: boolean, checks: Object }
 */
async function validateMLEnvironment() {
  const pythonPath = process.env.PYTHON_PATH || 'python';
  const scriptPath = path.join(process.cwd(), 'ml', 'evaluate.py');

  const pythonCheck = await checkPythonAvailability(pythonPath);
  const scriptExists = await checkMLScriptExists(scriptPath);

  const ready = pythonCheck.available && scriptExists;

  return {
    ready,
    checks: {
      python: pythonCheck,
      script: {
        exists: scriptExists,
        path: scriptPath
      }
    },
    warnings: [
      !pythonCheck.available && 'Python is not available',
      !scriptExists && 'ML script (ml/evaluate.py) not found'
    ].filter(Boolean)
  };
}

module.exports = {
  executePythonML,
  checkPythonAvailability,
  checkMLScriptExists,
  validateMLEnvironment
};
