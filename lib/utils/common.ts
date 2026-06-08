/**
 * Replace all occurrences of a substring in a string.
 * @description This function replaces all occurrences of a specified substring in a string with a new substring.
 * @param str 
 * @param find 
 * @param replace 
 * @returns 
 */
export function replaceAll(str: string, find: string, replace: string): string {
    const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // Escape special characters
    return str.replace(new RegExp(escapedFind, "g"), replace)
}

/**
 * Converts an object to a plain JSON string.
 * @param obj - Any JavaScript object.
 * @param config - Optional configuration object.
 * @param config.indent - Number of spaces to indent the JSON string.
 * @param config.dropKeys - Array of keys to drop from the object.
 * @returns A plain JSON string.
 */
export function safeStringify(obj: any, config?: { indent?: number; dropKeys?: string[] }): string {
    const cache = new Set<any>()
    const filterAndFormat = (key: string, value: any) => {
        if (config?.dropKeys?.includes(key)) {
            return undefined // Drop the key
        }
        if (typeof value === "object" && value !== null) {
            if (cache.has(value)) {
                return undefined // Avoid circular references
            }
            cache.add(value)
        }
        return value
    }
    return JSON.stringify(obj, filterAndFormat, config?.indent || 2)
}


/**
 * Represents the possible options for handling files within the FormData.
 * - 'exclude': Files are completely ignored.
 * - 'includeFilenames': Only the names of the files are included as strings.
 */
type FileHandlingOption = 'exclude' | 'includeFilenames'

/**
 * Configuration options for the formDataToObject function.
 */
interface FormDataToObjectOptions {
  /**
   * How to handle File objects found in the FormData.
   * @default 'exclude'
   */
  fileHandling?: FileHandlingOption
}

/**
 * Represents the structure of the object returned by formDataToObject.
 * Keys are strings, and values are either strings or arrays of strings.
 */
type FormDataObject= { [key: string]: string | string[] } 

/**
 * Converts a FormData object into a plain JavaScript object suitable for JSON serialization.
 * Handles multiple values for the same key by creating an array.
 * Provides options for handling file inputs (excluding them or including filenames).
 *
 * @param formData The FormData object to convert.
 * @param options Optional configuration for file handling.
 * @returns A plain JavaScript object representing the form data.
 */
export function formDataToObject(
  formData: FormData,
  options: FormDataToObjectOptions = {}
): FormDataObject {
  // Set default options
  const { fileHandling = 'exclude' }: FormDataToObjectOptions = options
  const obj: FormDataObject = {}

  formData.forEach((value: FormDataEntryValue, key: string) => {
    let processedValue: string | undefined // Can be string (value/filename) or undefined (if excluded)

    // --- Step 1: Process the value based on type and options ---
    if (value instanceof File) {
      // It's a file
      if (fileHandling === 'exclude') {
        return // Skip this entry if files should be excluded
      } else if (fileHandling === 'includeFilenames') {
        processedValue = value.name // Use filename as the value
      } else {
        // Fallback for unknown/future options: treat as 'exclude'
        // or handle differently if needed
        console.warn(`Unknown fileHandling option: "${fileHandling}" for key "${key}". Excluding file.`)
        return
      }
    } else {
      // It's a string (standard FormDataEntryValue behavior)
      processedValue = value
    }

    // --- Step 2: Add the processed value to the object, handling multiple values ---
    // Ensure we actually have a value to add (e.g., file wasn't excluded)
    if (processedValue === undefined) {
        return
    }

    if (key in obj) {
      // Key already exists
      const currentValue = obj[key] // Type: string | string[]

      if (!Array.isArray(currentValue)) {
        // If it's not an array (it must be a string), convert it to an array
        // containing the old and new values.
        obj[key] = [currentValue, processedValue]
      } else {
        // If it's already an array, push the new processed value
        currentValue.push(processedValue)
      }
    } else {
      // Key doesn't exist, add it with the processed value
      obj[key] = processedValue
    }
  })

  return obj
}
