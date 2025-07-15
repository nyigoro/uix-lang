// UIX Validation System
// A comprehensive validation system for UIX components with type checking and constraints

/**
 * Custom validation error class for UIX components
 */
export class UIXValidationError extends Error {
  constructor(message, field = null, value = null) {
    super(message);
    this.name = 'UIXValidationError';
    this.field = field;
    this.value = value;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Base validation schema builder
 */
export class UIXSchema {
  constructor(type, options = {}) {
    this.type = type;
    this.options = options;
    this.required = options.required || false;
    this.defaultValue = options.defaultValue;
    this.constraints = options.constraints || {};
  }

  /**
   * Create a string schema
   */
  static string(options = {}) {
    return new UIXSchema('string', {
      ...options,
      constraints: {
        minLength: options.minLength,
        maxLength: options.maxLength,
        pattern: options.pattern,
        ...options.constraints
      }
    });
  }

  /**
   * Create a number schema
   */
  static number(options = {}) {
    return new UIXSchema('number', {
      ...options,
      constraints: {
        min: options.min,
        max: options.max,
        integer: options.integer,
        ...options.constraints
      }
    });
  }

  /**
   * Create a boolean schema
   */
  static boolean(options = {}) {
    return new UIXSchema('boolean', options);
  }

  /**
   * Create a function schema
   */
  static function(options = {}) {
    return new UIXSchema('function', options);
  }

  /**
   * Create an array schema
   */
  static array(options = {}) {
    return new UIXSchema('array', {
      ...options,
      constraints: {
        items: options.items,
        minItems: options.minItems,
        maxItems: options.maxItems,
        ...options.constraints
      }
    });
  }

  /**
   * Create an object schema
   */
  static object(options = {}) {
    return new UIXSchema('object', {
      ...options,
      constraints: {
        properties: options.properties,
        ...options.constraints
      }
    });
  }

  /**
   * Create an enum schema
   */
  static enum(values, options = {}) {
    return new UIXSchema('enum', {
      ...options,
      constraints: {
        values: values,
        ...options.constraints
      }
    });
  }

  /**
   * Create a union schema (accepts multiple types)
   */
  static union(schemas, options = {}) {
    return new UIXSchema('union', {
      ...options,
      constraints: {
        schemas: schemas,
        ...options.constraints
      }
    });
  }

  /**
   * Create an any schema (accepts any type)
   */
  static any(options = {}) {
    return new UIXSchema('any', options);
  }

  /**
   * Make a schema optional
   */
  static optional(schema, defaultValue = undefined) {
    return new UIXSchema(schema.type, {
      ...schema.options,
      required: false,
      defaultValue: defaultValue
    });
  }

  /**
   * Validate a value against this schema
   */
  validate(value, fieldName = 'value') {
    // Handle undefined values
    if (value === undefined || value === null) {
      if (this.required) {
        throw new UIXValidationError(`${fieldName} is required`, fieldName, value);
      }
      return this.defaultValue;
    }

    // Type validation
    switch (this.type) {
      case 'string':
        return this.validateString(value, fieldName);
      case 'number':
        return this.validateNumber(value, fieldName);
      case 'boolean':
        return this.validateBoolean(value, fieldName);
      case 'function':
        return this.validateFunction(value, fieldName);
      case 'array':
        return this.validateArray(value, fieldName);
      case 'object':
        return this.validateObject(value, fieldName);
      case 'enum':
        return this.validateEnum(value, fieldName);
      case 'union':
        return this.validateUnion(value, fieldName);
      case 'any':
        return value;
      default:
        throw new UIXValidationError(`Unknown schema type: ${this.type}`, fieldName, value);
    }
  }

  validateString(value, fieldName) {
    if (typeof value !== 'string') {
      throw new UIXValidationError(`${fieldName} must be a string, got ${typeof value}`, fieldName, value);
    }

    const { minLength, maxLength, pattern } = this.constraints;
    
    if (minLength !== undefined && value.length < minLength) {
      throw new UIXValidationError(`${fieldName} must be at least ${minLength} characters long`, fieldName, value);
    }
    
    if (maxLength !== undefined && value.length > maxLength) {
      throw new UIXValidationError(`${fieldName} must be no more than ${maxLength} characters long`, fieldName, value);
    }
    
    if (pattern !== undefined) {
      const regex = new RegExp(pattern);
      if (!regex.test(value)) {
        throw new UIXValidationError(`${fieldName} must match pattern: ${pattern}`, fieldName, value);
      }
    }

    return value;
  }

  validateNumber(value, fieldName) {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new UIXValidationError(`${fieldName} must be a number, got ${typeof value}`, fieldName, value);
    }

    const { min, max, integer } = this.constraints;
    
    if (min !== undefined && value < min) {
      throw new UIXValidationError(`${fieldName} must be at least ${min}`, fieldName, value);
    }
    
    if (max !== undefined && value > max) {
      throw new UIXValidationError(`${fieldName} must be no more than ${max}`, fieldName, value);
    }
    
    if (integer && !Number.isInteger(value)) {
      throw new UIXValidationError(`${fieldName} must be an integer`, fieldName, value);
    }

    return value;
  }

  validateBoolean(value, fieldName) {
    if (typeof value !== 'boolean') {
      throw new UIXValidationError(`${fieldName} must be a boolean, got ${typeof value}`, fieldName, value);
    }
    return value;
  }

  validateFunction(value, fieldName) {
    if (typeof value !== 'function') {
      throw new UIXValidationError(`${fieldName} must be a function, got ${typeof value}`, fieldName, value);
    }
    return value;
  }

  validateArray(value, fieldName) {
    if (!Array.isArray(value)) {
      throw new UIXValidationError(`${fieldName} must be an array, got ${typeof value}`, fieldName, value);
    }

    const { items, minItems, maxItems } = this.constraints;
    
    if (minItems !== undefined && value.length < minItems) {
      throw new UIXValidationError(`${fieldName} must have at least ${minItems} items`, fieldName, value);
    }
    
    if (maxItems !== undefined && value.length > maxItems) {
      throw new UIXValidationError(`${fieldName} must have no more than ${maxItems} items`, fieldName, value);
    }

    if (items) {
      return value.map((item, index) => items.validate(item, `${fieldName}[${index}]`));
    }

    return value;
  }

  validateObject(value, fieldName) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new UIXValidationError(`${fieldName} must be an object, got ${typeof value}`, fieldName, value);
    }

    const { properties } = this.constraints;
    if (properties) {
      const validatedObject = {};
      for (const [key, schema] of Object.entries(properties)) {
        validatedObject[key] = schema.validate(value[key], `${fieldName}.${key}`);
      }
      return validatedObject;
    }

    return value;
  }

  validateEnum(value, fieldName) {
    const { values } = this.constraints;
    if (!values.includes(value)) {
      throw new UIXValidationError(`${fieldName} must be one of: ${values.join(', ')}`, fieldName, value);
    }
    return value;
  }

  validateUnion(value, fieldName) {
    const { schemas } = this.constraints;
    const errors = [];

    for (const schema of schemas) {
      try {
        return schema.validate(value, fieldName);
      } catch (error) {
        errors.push(error.message);
      }
    }

    throw new UIXValidationError(`${fieldName} must match one of the union types. Errors: ${errors.join('; ')}`, fieldName, value);
  }
}

/**
 * Component validator class
 */
export class UIXComponentValidator {
  constructor(componentName, propsSchema) {
    this.componentName = componentName;
    this.propsSchema = propsSchema;
  }

  /**
   * Validate component props
   */
  validate(props) {
    const validatedProps = {};
    
    // Validate each prop according to schema
    for (const [propName, schema] of Object.entries(this.propsSchema)) {
      try {
        validatedProps[propName] = schema.validate(props[propName], propName);
      } catch (error) {
        throw new UIXValidationError(`Invalid prop '${propName}' for component '${this.componentName}': ${error.message}`, propName, props[propName]);
      }
    }

    // Check for unexpected props
    for (const propName of Object.keys(props || {})) {
      if (!this.propsSchema.hasOwnProperty(propName)) {
        console.warn(`⚠️  Unknown prop '${propName}' passed to component '${this.componentName}'`);
      }
    }

    return validatedProps;
  }

  /**
   * Get validation schema for a specific prop
   */
  getPropSchema(propName) {
    return this.propsSchema[propName];
  }

  /**
   * Get all prop names
   */
  getPropNames() {
    return Object.keys(this.propsSchema);
  }

  /**
   * Get required prop names
   */
  getRequiredProps() {
    return Object.entries(this.propsSchema)
      .filter(([_, schema]) => schema.required)
      .map(([propName]) => propName);
  }

  /**
   * Get optional prop names
   */
  getOptionalProps() {
    return Object.entries(this.propsSchema)
      .filter(([_, schema]) => !schema.required)
      .map(([propName]) => propName);
  }
}

/**
 * Main UIX validator class
 */
export class UIXValidator {
  constructor() {
    this.componentValidators = new Map();
    this.globalValidationRules = new Map();
  }

  /**
   * Register a component validator
   */
  registerComponent(componentName, propsSchema) {
    const validator = new UIXComponentValidator(componentName, propsSchema);
    this.componentValidators.set(componentName, validator);
    return validator;
  }

  /**
   * Get a component validator
   */
  getValidator(componentName) {
    return this.componentValidators.get(componentName);
  }

  /**
   * Validate props for a component
   */
  validateComponent(componentName, props) {
    const validator = this.getValidator(componentName);
    if (!validator) {
      throw new UIXValidationError(`No validator found for component: ${componentName}`);
    }
    return validator.validate(props);
  }

  /**
   * Add a global validation rule
   */
  addGlobalRule(ruleName, ruleFunction) {
    this.globalValidationRules.set(ruleName, ruleFunction);
  }

  /**
   * Apply global validation rules
   */
  applyGlobalRules(componentName, props) {
    for (const [ruleName, ruleFunction] of this.globalValidationRules) {
      try {
        ruleFunction(componentName, props);
      } catch (error) {
        throw new UIXValidationError(`Global rule '${ruleName}' failed: ${error.message}`);
      }
    }
  }

  /**
   * Get all registered component names
   */
  getRegisteredComponents() {
    return Array.from(this.componentValidators.keys());
  }

  /**
   * Check if a component is registered
   */
  isComponentRegistered(componentName) {
    return this.componentValidators.has(componentName);
  }

  /**
   * Generate validation report
   */
  generateReport() {
    const report = {
      totalComponents: this.componentValidators.size,
      components: {},
      globalRules: Array.from(this.globalValidationRules.keys())
    };

    for (const [componentName, validator] of this.componentValidators) {
      report.components[componentName] = {
        totalProps: validator.getPropNames().length,
        requiredProps: validator.getRequiredProps(),
        optionalProps: validator.getOptionalProps(),
        propTypes: {}
      };

      for (const propName of validator.getPropNames()) {
        const schema = validator.getPropSchema(propName);
        report.components[componentName].propTypes[propName] = {
          type: schema.type,
          required: schema.required,
          defaultValue: schema.defaultValue
        };
      }
    }

    return report;
  }
}

/**
 * Utility functions for common validation patterns
 */
export const UIXValidationUtils = {
  /**
   * Create a validation schema for HTML attributes
   */
  htmlAttributes: () => ({
    id: UIXSchema.optional(UIXSchema.string()),
    className: UIXSchema.optional(UIXSchema.string()),
    style: UIXSchema.optional(UIXSchema.string()),
    onClick: UIXSchema.optional(UIXSchema.function()),
    onSubmit: UIXSchema.optional(UIXSchema.function()),
    onFocus: UIXSchema.optional(UIXSchema.function()),
    onBlur: UIXSchema.optional(UIXSchema.function())
  }),

  /**
   * Create a validation schema for form inputs
   */
  formInputAttributes: () => ({
    ...UIXValidationUtils.htmlAttributes(),
    name: UIXSchema.optional(UIXSchema.string()),
    disabled: UIXSchema.optional(UIXSchema.boolean(), false),
    required: UIXSchema.optional(UIXSchema.boolean(), false),
    placeholder: UIXSchema.optional(UIXSchema.string()),
    value: UIXSchema.optional(UIXSchema.string()),
    onChange: UIXSchema.optional(UIXSchema.function())
  }),

  /**
   * Validate email format
   */
  emailSchema: () => UIXSchema.string({
    pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
  }),

  /**
   * Validate URL format
   */
  urlSchema: () => UIXSchema.string({
    pattern: '^https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)$'
  }),

  /**
   * Validate color hex format
   */
  colorSchema: () => UIXSchema.string({
    pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'
  })
};

// Export default validator instance
export const defaultValidator = new UIXValidator();