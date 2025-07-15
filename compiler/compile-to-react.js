// UIX Compiler with Integrated Props Validation System
import fs from "fs";
import * as parser from "./parser.js";

// Import the validation system
import { UIXSchema, UIXValidator, UIXComponentValidator, UIXValidationError } from './uix-validation.js';

const code = fs.readFileSync("uix/example.uix", "utf-8");
const tagMap = {
  // App is now a special top-level construct, not a generic div
  Title: "h1",
  Row: "div",
  Button: "button",
  Input: "input",
  Text: "span"
};

// Built-in component validation schemas
const builtInValidationSchemas = {
  Title: {
    text: UIXSchema.string({ required: true }),
    className: UIXSchema.optional(UIXSchema.string()),
    id: UIXSchema.optional(UIXSchema.string())
  },
  Row: {
    className: UIXSchema.optional(UIXSchema.string()),
    style: UIXSchema.optional(UIXSchema.string()),
    onClick: UIXSchema.optional(UIXSchema.function())
  },
  Button: {
    text: UIXSchema.string({ required: true }),
    onClick: UIXSchema.function({ required: true }),
    disabled: UIXSchema.optional(UIXSchema.boolean(), false),
    type: UIXSchema.optional(UIXSchema.enum(['button', 'submit', 'reset']), 'button'),
    className: UIXSchema.optional(UIXSchema.string()),
    variant: UIXSchema.optional(UIXSchema.enum(['primary', 'secondary', 'danger', 'success']), 'primary')
  },
  Input: {
    bind: UIXSchema.optional(UIXSchema.string()),
    initial: UIXSchema.optional(UIXSchema.union([UIXSchema.string(), UIXSchema.number()])),
    type: UIXSchema.optional(UIXSchema.enum(['text', 'email', 'password', 'number', 'tel', 'url']), 'text'),
    placeholder: UIXSchema.optional(UIXSchema.string()),
    required: UIXSchema.optional(UIXSchema.boolean(), false),
    disabled: UIXSchema.optional(UIXSchema.boolean(), false),
    minLength: UIXSchema.optional(UIXSchema.number({ min: 0 })),
    maxLength: UIXSchema.optional(UIXSchema.number({ min: 1 })),
    pattern: UIXSchema.optional(UIXSchema.string())
  },
  Text: {
    text: UIXSchema.string({ required: true }),
    className: UIXSchema.optional(UIXSchema.string()),
    style: UIXSchema.optional(UIXSchema.string())
  }
};

// Component validation registry
const componentValidators = new Map();

// Register built-in component validators
Object.entries(builtInValidationSchemas).forEach(([componentName, schema]) => {
  componentValidators.set(componentName, new UIXComponentValidator(componentName, schema));
});

const parsedAst = parser.parse(code);

// Tracking
const usedIdentifiers = new Set();
const bindCandidates = new Map();
const componentParameters = new Set();

// Custom component definitions with validation
const customComponentDefinitions = new Map();

function capitalize(str) {
  const actualStr = (typeof str === "object" && str !== null && str.value !== undefined) ? str.value : str;
  return typeof actualStr === "string" ? actualStr.charAt(0).toUpperCase() + actualStr.slice(1) : "";
}

function extractIdentifiers(value) {
  if (typeof value === "object" && value !== null) {
    if (value.type === 'expression' || value.type === 'identifier') {
      const parts = value.value.split(/[\. \( \+]/)[0];
      if (parts && /^[a-zA-Z_$][a-zA-Z0-9_]*$/.test(parts)) {
        usedIdentifiers.add(parts);
      }
    } else if (value.type === 'string' || value.type === 'number') {
      return;
    }
  } else if (typeof value === "string" && /^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(value)) {
    const parts = value.split(".");
    usedIdentifiers.add(parts[0]);
  }
}

// Enhanced component definition processing with validation schema inference
function processComponentDefinition(compDef) {
  const componentName = compDef.name.value;
  const componentParams = compDef.params.map(p => p.value);
  
  // Store component definition for validation
  customComponentDefinitions.set(componentName, {
    name: componentName,
    params: componentParams,
    body: compDef.body
  });
  
  // Infer validation schema from component usage patterns
  const inferredSchema = inferValidationSchema(compDef);
  
  // Register validator for this custom component
  componentValidators.set(componentName, new UIXComponentValidator(componentName, inferredSchema));
  
  return { componentName, componentParams, inferredSchema };
}

// Infer validation schema from component definition
function inferValidationSchema(compDef) {
  const schema = {};
  const componentParams = compDef.params.map(p => p.value);
  
  // Analyze component body to infer prop types
  componentParams.forEach(param => {
    // Start with a flexible schema - we'll refine based on usage
    schema[param] = UIXSchema.any({ required: true });
    
    // Analyze usage patterns in the component body
    const usage = analyzeParameterUsage(param, compDef.body);
    
    if (usage.usedAsText) {
      schema[param] = UIXSchema.string({ required: true });
    } else if (usage.usedAsNumber) {
      schema[param] = UIXSchema.number({ required: true });
    } else if (usage.usedAsBoolean) {
      schema[param] = UIXSchema.boolean({ required: true });
    } else if (usage.usedAsArray) {
      schema[param] = UIXSchema.array({ 
        required: true, 
        items: UIXSchema.any() 
      });
    } else if (usage.usedAsFunction) {
      schema[param] = UIXSchema.function({ required: true });
    }
    
    // Check if parameter has default values or is optional
    if (usage.hasDefaultValue || usage.conditionalUsage) {
      schema[param] = UIXSchema.optional(schema[param]);
    }
  });
  
  return schema;
}

// Analyze how a parameter is used within a component body
function analyzeParameterUsage(param, body) {
  const usage = {
    usedAsText: false,
    usedAsNumber: false,
    usedAsBoolean: false,
    usedAsArray: false,
    usedAsFunction: false,
    hasDefaultValue: false,
    conditionalUsage: false
  };
  
  function analyzeNode(node) {
    if (!node) return;
    
    // Check props for parameter usage
    if (node.props) {
      Object.entries(node.props).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null && 
            (value.type === 'expression' || value.type === 'identifier')) {
          
          if (value.value === param) {
            // Direct parameter usage
            if (key === 'text') usage.usedAsText = true;
            if (key === 'onClick' || key === 'onSubmit') usage.usedAsFunction = true;
            if (key === 'disabled' || key === 'required') usage.usedAsBoolean = true;
          } else if (value.value.includes(param)) {
            // Parameter used in expressions
            if (value.value.includes(`${param}.map`) || value.value.includes(`${param}.length`)) {
              usage.usedAsArray = true;
            }
            if (value.value.includes(`${param}.toString()`) || value.value.includes(`${param}.toUpperCase()`)) {
              usage.usedAsText = true;
            }
            if (value.value.includes(`${param} ===`) || value.value.includes(`${param} !==`)) {
              usage.usedAsBoolean = true;
            }
            
            if (value.value.includes(`${param}(`) || value.value.includes(`${param}.call`)) {
              usage.usedAsFunction = true;
            }
          }
        }
      });
    }
    
    // Check for conditional usage
    if (node.type === 'If' && node.condition && 
        typeof node.condition === 'object' && node.condition.value && 
        node.condition.value.includes(param)) {
      usage.conditionalUsage = true;
    }
    
    // Check for array usage in For loops
    if (node.type === 'For' && node.list && 
        typeof node.list === 'object' && node.list.value === param) {
      usage.usedAsArray = true;
    }
    
    // Recursively analyze children
    if (node.children) {
      node.children.forEach(analyzeNode);
    }
    if (node.body) {
      node.body.forEach(analyzeNode);
    }
  }
  
  body.forEach(analyzeNode);
  return usage;
}

// Enhanced props validation during compilation
function validateProps(componentName, props) {
  const validator = componentValidators.get(componentName);
  if (!validator) {
    console.warn(`⚠️  No validator found for component: ${componentName}`);
    return props; // Return original props if no validator
  }
  
  try {
    // Convert UIX AST props to plain JavaScript objects for validation
    const plainProps = {};
    
    if (props) {
      Object.entries(props).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          if (value.type === 'string') {
            plainProps[key] = value.value;
          } else if (value.type === 'number') {
            plainProps[key] = value.value;
          } else if (value.type === 'expression' || value.type === 'identifier') {
            // For expressions, we'll validate at runtime, but check basic structure
            plainProps[key] = value.value;
          }
        } else {
          plainProps[key] = value;
        }
      });
    }
    
    // Validate props
    const validatedProps = validator.validate(plainProps);
    
    console.log(`✅ Props validated for ${componentName}:`, Object.keys(validatedProps));
    return props; // Return original AST props for further processing
    
  } catch (error) {
    if (error instanceof UIXValidationError) {
      console.error(`❌ Validation error in ${componentName}:`, error.message);
      
      // In development, we might want to halt compilation
      if (process.env.NODE_ENV === 'development') {
        throw new Error(`UIX Compilation failed due to validation error in ${componentName}: ${error.message}`);
      }
      
      // In production, log error but continue with original props
      console.warn(`⚠️  Continuing compilation despite validation error in ${componentName}`);
      return props;
    }
    throw error;
  }
}

// Function to recursively collect all bind candidates and used identifiers from a given AST node or subtree
function collectAllIdentifiers(node) {
  if (!node) return;

  // Validate props if this is a component with a validator
  if (node.type && componentValidators.has(node.type)) {
    validateProps(node.type, node.props);
  }

  // Handle props for standard elements
  if (node.props) {
    for (const [key, value] of Object.entries(node.props)) {
      if (key === "bind") {
        if (typeof value === 'object' && value !== null && value.type === 'expression') {
          const varName = value.value;
          if (/^[a-zA-Z_$][a-zA-Z0-9_]*$/.test(varName)) {
            const initialValue = node.props.initial !== undefined
              ? (typeof node.props.initial === 'object' && node.props.initial !== null && (node.props.initial.type === 'expression' || node.props.initial.type === 'string' || node.props.initial.type === 'number') ? node.props.initial.value : node.props.initial)
              : "";
            bindCandidates.set(varName, initialValue);
            usedIdentifiers.add(varName);
            usedIdentifiers.add(`set${capitalize(varName)}`);
          } else {
            console.warn(`Warning: 'bind' prop requires a simple identifier string. Found: '${varName}'.`);
          }
        }
      } else if (key !== "text" && key !== "initial" && key !== "bindDefault") {
        extractIdentifiers(value);
      }
    }
  }

  // Handle If block condition
  if (node.type === "If" && node.condition) {
    extractIdentifiers(node.condition);
  }

  // Handle For block list and item
  if (node.type === "For" && node.list) {
    extractIdentifiers(node.list);
    usedIdentifiers.add(node.item.value);
  }

  // Recursively process children
  (node.children || []).forEach(collectAllIdentifiers);

  // If it's a ComponentDefinition, process it and register validator
  if (node.type === "ComponentDefinition") {
    const { componentName, componentParams } = processComponentDefinition(node);
    
    componentParams.forEach(param => {
      componentParameters.add(param);
    });
    
    node.body.forEach(collectAllIdentifiers);
  }
  
  // If it's the main AppElement, process its body
  if (node.type === "App" && node.body) {
    node.body.forEach(collectAllIdentifiers);
  }
}

// Initial pass to collect all identifiers and bind candidates from the entire AST
parsedAst.components.forEach(collectAllIdentifiers);
if (parsedAst.app) {
  collectAllIdentifiers(parsedAst.app);
}