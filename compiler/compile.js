import fs from "fs";
import * as parser from "./parser.js";

const code = fs.readFileSync("uix/example.uix", "utf-8");
const tagMap = {
  App: "div",
  Title: "h1",
  Row: "div",
  Button: "button",
  Input: "input",
  Text: "span"
};

const ast = parser.parse(code);

// Tracking
const usedIdentifiers = new Set();
const boundVariables = new Map(); // Stores varName -> initialValue

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

function extractIdentifiers(value) {
  // Only treat as identifier if it's a valid JS expression (e.g., user.name)
  if (typeof value === "string" && /^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(value)) {
    const parts = value.split(".");
    usedIdentifiers.add(parts[0]); // Add the root identifier (e.g., 'user' from 'user.name')
  }
}

// Converts a props object to JSX string
function renderProps(props) {
  const safeProps = props || {};
  const jsxProps = [];
  let bindPropValue = null;
  let initialPropValue = null;

  // First pass: Extract special props like 'bind' and 'initial'
  for (const [key, value] of Object.entries(safeProps)) {
    if (key === "bind") {
      bindPropValue = value;
    } else if (key === "initial") {
      initialPropValue = value;
    }
  }

  // Process 'bind' and 'initial' together
  if (bindPropValue !== null) {
    // Validate that 'bind' value is a simple identifier (no dots)
    if (typeof bindPropValue !== "string" || !/^[a-zA-Z_$][a-zA-Z0-9_]*$/.test(bindPropValue)) {
      console.warn(`Warning: 'bind' prop requires a simple identifier string. Found: '${bindPropValue}'. This input might be uncontrolled.`);
      // Fallback to read-only value if bind target is complex
      jsxProps.push(`value={${bindPropValue}}`);
    } else {
      const varName = bindPropValue;
      // Store the initial value for the bound variable. Default to empty string if no 'initial' prop.
      boundVariables.set(varName, initialPropValue !== null ? initialPropValue : "");
      // Add the setter function name to usedIdentifiers so it's not passed as a prop
      usedIdentifiers.add(`set${capitalize(varName)}`);
      // Generate the value and onChange handler for the controlled input
      jsxProps.push(`value={${varName}} onChange={e => set${capitalize(varName)}(e.target.value)}`);
    }
  }

  // Second pass: Process all other props
  for (const [key, value] of Object.entries(safeProps)) {
    // Skip 'bind' and 'initial' as they are already processed
    if (key === "bind" || key === "initial") {
      continue;
    }

    // 'text' prop is handled in generateJSX for inner content, not as a JSX attribute
    if (key === "text") {
      continue;
    }

    // Extract identifiers from other prop values (e.g., onClick={myFunction})
    extractIdentifiers(value);

    // Handle event handlers (e.g., onClick, onInput)
    if (key.startsWith("on")) {
      jsxProps.push(`${key}={${value}}`);
    }
    // Handle string literal values for other props
    else if (typeof value === "string") {
      jsxProps.push(`${key}="${value}"`);
    }
    // Handle other types (numbers, booleans, objects) by stringifying and wrapping in curly braces
    else {
      jsxProps.push(`${key}={${JSON.stringify(value)}}`);
    }
  }

  return jsxProps.join(" ");
}

// Generate JSX for the entire AST
function generateJSX(node, indent = "  ") {
  const { type, props, children } = node;
  const childIndent = indent + "  "; // Deeper indent for children

  // Handle 'If' blocks (conditional rendering)
  if (type === "If") {
    extractIdentifiers(node.condition); // Track the condition variable
    const innerChildren = children.map(c => generateJSX(c, childIndent)).join("\n");
    // Generate a ternary operator for conditional rendering
    return `${indent}{${node.condition} ? (\n${innerChildren}\n${indent}) : null}`;
  }

  // Handle 'For' blocks (list rendering)
  if (type === "For") {
    extractIdentifiers(node.list); // Track the list variable
    usedIdentifiers.add(node.item); // Track the loop item variable
    const innerChildren = children.map(c => generateJSX(c, childIndent + "  ")).join("\n"); // Extra indent for children inside map
    // Generate a list.map() function for rendering items
    return `${indent}{${node.list}.map((${node.item}, index) => (\n${childIndent}  <React.Fragment key={typeof ${node.item} === 'object' && ${node.item} !== null && 'id' in ${node.item} ? ${node.item}.id : index}>\n${innerChildren}\n${childIndent}  </React.Fragment>\n${indent}))}`;
  }

  // Handle standard elements
  const jsxTag = tagMap[type] || type; // Translate UIX tag to HTML tag or use as-is
  const propStr = renderProps(props); // Get the string of JSX attributes

  let innerContent = [];
  // Handle 'text' prop for direct text content within the element
  if (props?.text !== undefined) {
    const textValue = props.text;
    if (typeof textValue === "string" && /^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(textValue)) {
      // If 'text' is an identifier/expression, wrap in curly braces
      extractIdentifiers(textValue); // Track the identifier
      innerContent.push(`{${textValue}}`);
    } else {
      // If 'text' is a literal string, use it directly
      innerContent.push(textValue);
    }
  }

  // Add children JSX after the text content
  innerContent.push(...(children || []).map(c => generateJSX(c, childIndent)));

  const inner = innerContent.filter(Boolean).join("\n"); // Filter out empty strings/nulls and join

  // Determine if it's a self-closing tag or has children/text content
  if (inner.trim() === "") {
    return `${indent}<${jsxTag}${propStr ? " " + propStr : ""} />`;
  } else {
    return `${indent}<${jsxTag}${propStr ? " " + propStr : ""}>\n${inner}\n${indent}</${jsxTag}>`;
  }
}

// Generate the main JSX body from the AST
const jsxBody = ast.map(node => generateJSX(node)).join("\n");

// Determine which variables should be passed as props to CompiledUI
// Filter out bound variables (which become state) and their setters
const propsToInject = Array.from(usedIdentifiers).filter(id => {
  return !boundVariables.has(id) && !id.startsWith("set") && !Array.from(boundVariables.keys()).some(bv => id === `set${capitalize(bv)}`);
}).sort(); // Sort for consistent output

// Generate useState hooks for bound variables
const autoStates = Array.from(boundVariables.entries())
  .map(([varName, initialValue]) => {
    // If initialValue is a string that looks like an identifier/expression, use it directly.
    // Otherwise, stringify it for literal values (e.g., "hello", 123, true).
    const stateInit = typeof initialValue === 'string' && /^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(initialValue)
      ? initialValue // It's an expression/identifier, use directly (e.g., 'someInitialVar')
      : JSON.stringify(initialValue); // It's a literal string or other type, stringify (e.g., '"Hello"', '123')
    return `  const [${varName}, set${capitalize(varName)}] = React.useState(${stateInit});`;
  })
  .join("\n");

const propDestructure = propsToInject.join(", ");

// Final React component wrapper
const output = `// Auto-generated by UIX compiler
import React from "react";

export default function CompiledUI({ ${propDestructure} }) {
${autoStates ? autoStates + "\n" : ""}
  // IMPORTANT: Ensure that any props like 'greet', 'users', 'showMore', 'toggle' are passed down
  // from the parent component that renders <CompiledUI />.
  // Example in your App.jsx:
  // import React from 'react';
  // import CompiledUI from './CompiledUI.jsx';
  //
  // function App() {
  //   const [users, setUsers] = React.useState([{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]);
  //   const greet = () => console.log("Hello!");
  //   const [showMore, setShowMore] = React.useState(false);
  //   const toggle = () => setShowMore(!showMore);
  //
  //   return (
  //     <CompiledUI
  //       users={users}
  //       greet={greet}
  //       showMore={showMore}
  //       toggle={toggle}
  //     />
  //   );
  // }
  // export default App;

  return (
    <>
${jsxBody}
    </>
  );
}
`;

// Write the compiled JSX to a file
fs.writeFileSync("src/CompiledUI.jsx", output);
console.log("✅ Compiled: src/CompiledUI.jsx");
console.log("--- START OF GENERATED JSX ---");
console.log(output); // Log the full generated output for debugging
console.log("--- END OF GENERATED JSX ---");
console.log("✅ Injected props:", propDestructure || "(none)");
if (boundVariables.size > 0) {
  console.log("✅ Injected state for:", Array.from(boundVariables.keys()).join(", "));
}
