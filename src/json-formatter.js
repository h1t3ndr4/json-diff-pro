/**
 * JSON Formatter and Validator
 * Pure implementation without external dependencies
 */

class JsonFormatter {
    /**
     * Format JSON string with proper indentation and validation
     * @param {string} jsonString 
     * @returns {string}
     */
    static format(jsonString) {
        try {
            // First clean the string
            const cleaned = this.cleanJsonString(jsonString);
            const parsed = JSON.parse(cleaned);
            return JSON.stringify(parsed, null, 2);
        } catch (error) {
            // Enhance error message with line and column info
            const errorInfo = this.getDetailedErrorInfo(jsonString, error);
            throw new Error(errorInfo);
        }
    }

    /**
     * Clean and prepare JSON string
     * @param {string} jsonString 
     * @returns {string}
     */
    static cleanJsonString(jsonString) {
        if (!jsonString) return '';
        
        // Remove comments (both single-line and multi-line)
        let cleaned = jsonString.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
        
        // Replace single quotes with double quotes for properties
        cleaned = cleaned.replace(/(\s*?{\s*?|\s*?,\s*?)(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '$1"$3":');
        
        // Remove trailing commas
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

        return cleaned.trim();
    }

    /**
     * Get detailed error information with line and column
     * @param {string} jsonString 
     * @param {Error} error 
     * @returns {string}
     */
    static getDetailedErrorInfo(jsonString, error) {
        const errorMatch = error.message.match(/at position (\d+)/);
        if (!errorMatch) return error.message;

        const position = parseInt(errorMatch[1]);
        const lines = jsonString.slice(0, position).split('\n');
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;

        const errorLines = jsonString.split('\n');
        const startLine = Math.max(0, line - 2);
        const endLine = Math.min(errorLines.length, line + 1);
        
        let context = '\n\nContext:\n';
        for (let i = startLine; i < endLine; i++) {
            context += `${i + 1}: ${errorLines[i]}\n`;
            if (i === line - 1) {
                context += `${' '.repeat(column + 2)}^ Error occurs here\n`;
            }
        }

        return `JSON syntax error at line ${line}, column ${column}: ${error.message}${context}`;
    }

    /**
     * Validate JSON string and return detailed error if invalid
     * @param {string} jsonString 
     * @returns {{ isValid: boolean, error?: string }}
     */
    static validateJson(jsonString) {
        try {
            if (!jsonString.trim()) {
                return { 
                    isValid: false, 
                    error: 'JSON string is empty' 
                };
            }

            const cleaned = this.cleanJsonString(jsonString);
            JSON.parse(cleaned);
            return { isValid: true };
        } catch (error) {
            return { 
                isValid: false, 
                error: this.getDetailedErrorInfo(jsonString, error)
            };
        }
    }
}

module.exports = JsonFormatter;