/**
 * Base directory name for Savant Code user configuration and credentials.
 *
 * The full runtime path is built as:
 *   `${os.homedir()}/${SAVANT_CODE_CONFIG_DIR_NAME}${envSuffix}`
 *
 * Environment suffixes are applied by the CLI and SDK consumers:
 *   - dev:  `.savant-code-dev`
 *   - test: `.savant-code-test`
 *   - prod: `.savant-code`
 */
export const SAVANT_CODE_CONFIG_DIR_NAME = '.savant-code'
