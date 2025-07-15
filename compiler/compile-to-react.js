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
// console.log("--- DEBUG: Parsed AST ---");
// console.log(JSON.stringify(ast, null, 2));
// console.log("--- END DEBUG ---");

// Tracking
const usedIdentifiers = new Set();
// This map will temporarily store all variables targeted by 'bind' directives
// It does NOT mean they will become internal state yet.
const bindCandidates = new Map(); // Stores varName -> initialValue

function capitalize(str) {
  // Ensure str is a string before capitalizing
  if (typeof str === "object" && str !== null && str.type === "expression") {
    str = str.value;
  }
  return typeof str === "string" ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

function extractIdentifiers(value) {
  // Ensure value is a string before attempting regex match
  if (typeof value === "object" && value !== null && value.type === "expression") {
    value = value.value;
  }
  if (typeof value === "string" && /^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(value)) {
    const parts = value.split(".");
    usedIdentifiers.add(parts[0]); // Add the root identifier (e.g., 'user' from 'user.name')
  }
}

// Function to recursively collect all bind candidates from the AST
function collectBindCandidatesFromAST(node) {
  if (!node) return;

  // Check for 'bind' prop on the current node
  if (node.props) {
    for (const [key, value] of Object.entries(node.props)) {
      if (key === "bind") {
        if (typeof value === 'object' && value !== null && value.type === 'expression') {
          const varName = value.value;
          // Validate bind target is a simple identifier
          if (/^[a-zA-Z_$][a-zA-Z0-9_]*$/.test(varName)) {
            const initialValue = node.props.initial !== undefined
              ? (typeof node.props.initial === 'object' && node.props.initial !== null && node.props.initial.type === 'expression' ? node.props.initial.value : node.props.initial)
              : "";
            bindCandidates.set(varName, initialValue);
            // Also mark the bind target and its setter as used identifiers
            usedIdentifiers.add(varName);
            usedIdentifiers.add(`set${capitalize(varName)}`);
          } else {
            console.warn(`Warning: 'bind' prop requires a simple identifier string. Found: '${varName}'. This input might be uncontrolled.`);
          }
        } else {
          console.warn(`Warning: 'bind' prop value must be an expression. Found: ${JSON.stringify(value)}. Ignoring bind.`);
        }
      }
    }
  }

  // Recursively process children
  (node.children || []).forEach(collectBindCandidatesFromAST);

  // Recursively process conditions and lists for If/For blocks
  if (node.type === "If" && node.condition) {
    extractIdentifiers(node.condition.value); // Ensure condition identifier is tracked
    collectBindCandidatesFromAST(node.condition); // Not strictly needed as condition is expression, but for consistency
  }
  if (node.type === "For" && node.list) {
    extractIdentifiers(node.list.value); // Ensure list identifier is tracked
    collectBindCandidatesFromAST(node.list); // Not strictly needed
    usedIdentifiers.add(node.item); // Ensure loop item is tracked
  }
}

// Initial pass to populate bindCandidates and usedIdentifiers
ast.forEach(collectBindCandidatesFromAST);


// Now, determine which of the bindCandidates should be internal state
// and which should be treated as props (because they are passed by the parent).
const internalStates = new Map(); // varName -> initialValue for actual internal state

bindCandidates.forEach((initialValue, varName) => {
  const setterName = `set${capitalize(varName)}`;
  // If the variable name OR its setter are NOT explicitly listed in the propsToInject,
  // then it means they are not being passed down from the parent, so they should be internal state.
  // We determine propsToInject *after* this, so we need to rely on `usedIdentifiers`
  // and the assumption that if `setName` is used, it's a prop.
  if (usedIdentifiers.has(varName) && usedIdentifiers.has(setterName)) {
    // If both the variable and its setter are used, assume they are props
    // Do NOT add to internalStates
  } else {
    // Otherwise, it's internal state
    internalStates.set(varName, initialValue);
  }
});


// Converts a props object to JSX string
function renderProps(props) {
  const safeProps = props || {};
  const jsxProps = [];

  for (const [key, value] of Object.entries(safeProps)) {
    // Skip internal compiler props
    if (key === "bind" || key === "initial" || key === "bindDefault") {
      continue;
    }

    // 'text' prop is handled in generateJSX for inner content
    if (key === "text") {
      continue;
    }

    // Handle 'bind' related props for Input elements
    // This logic is now handled by the `internalStates` map and `propsToInject`
    // So, if the key is 'value' or 'onChange' and it corresponds to a bind target,
    // we generate it here based on whether it's an internal state or a prop.
    // This part needs to be careful not to double-process.

    // If this prop is for a variable that is determined to be internal state:
    if (internalStates.has(key)) { // e.g., if 'name' is internal state
        // This case should ideally not happen if 'bind' is handled correctly,
        // as 'value' and 'onChange' are generated directly from the bind logic.
        // But as a fallback, ensure it's not treated as a regular prop.
        continue;
    }

    // Handle event handlers (e.g., onClick, onInput)
    if (key.startsWith("on")) {
      if (typeof value === "object" && value !== null && value.type === "expression") {
        extractIdentifiers(value.value);
        // Special handling for 'greet' function: call it without arguments
        // as it closes over parent's state.
        if (value.value === 'greet') {
          jsxProps.push(`${key}={greet}`); // Simply pass the function reference
        } else {
          jsxProps.push(`${key}={${value.value}}`);
        }
      } else if (typeof value === "string") {
        extractIdentifiers(value);
        if (value === 'greet') {
          jsxProps.push(`${key}={greet}`); // Simply pass the function reference
        } else {
          jsxProps.push(`${key}={${value}}`);
        }
      } else {
        jsxProps.push(`${key}={${JSON.stringify(value)}}`);
      }
    }
    // Handle expression values from the parser
    else if (typeof value === 'object' && value !== null && value.type === 'expression') {
      extractIdentifiers(value.value); // Extract identifiers from the expression string
      jsxProps.push(`${key}={${value.value}}`);
    }
    // Handle string literal values for other props
    else if (typeof value === "string") {
      jsxProps.push(`${key}=${JSON.stringify(value)}`); // Ensure string literals are quoted in JSX
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
    // node.condition is now { type: 'expression', value: '...' }
    extractIdentifiers(node.condition.value); // Track the condition variable
    const innerChildren = children.map(c => generateJSX(c, childIndent)).join("\n");
    // Generate a ternary operator for conditional rendering
    return `${indent}{${node.condition.value} ? (\n${innerChildren}\n${indent}) : null}`;
  }

  // Handle 'For' blocks (list rendering)
  if (type === "For") {
    // node.list is now { type: 'expression', value: '...' }
    extractIdentifiers(node.list.value); // Track the list variable
    usedIdentifiers.add(node.item); // Track the loop item variable
    const innerChildren = children.map(c => generateJSX(c, childIndent + "  ")).join("\n"); // Extra indent for children inside map
    // Generate a list.map() function for rendering items
    return `${indent}{${node.list.value}.map((${node.item}, index) => (\n${childIndent}  <React.Fragment key={typeof ${node.item} === 'object' && ${node.item} !== null && 'id' in ${node.item} ? ${node.item}.id : index}>\n${innerChildren}\n${childIndent}  </React.Fragment>\n${indent}))}`;
  }

  // Handle standard elements
  const jsxTag = tagMap[type] || type; // Translate UIX tag to HTML tag or use as-is

  // Special handling for Input with 'bind'
  let specialInputProps = '';
  if (type === 'Input' && props && props.bind && typeof props.bind === 'object' && props.bind.type === 'expression') {
    const varName = props.bind.value;
    const setterName = `set${capitalize(varName)}`;
    if (internalStates.has(varName)) {
      // It's internal state
      specialInputProps = `value={${varName}} onChange={e => ${setterName}(e.target.value)}`;
    } else {
      // It's a prop
      specialInputProps = `value={${varName}} onChange={e => ${setterName}(e.target.value)}`;
    }
  }

  const propStr = renderProps(props); // Get the string of JSX attributes

  let innerContent = [];
  // Handle 'text' prop for direct text content within the element
  if (props !== null && typeof props === 'object' && props.text !== undefined) { // Check for props and props.text safely
    const textValue = props.text;
    // If textValue is an expression object from the parser (e.g., { type: 'expression', value: 'user.name' })
    if (typeof textValue === 'object' && textValue !== null && textValue.type === 'expression') {
      extractIdentifiers(textValue.value); // Track the identifier
      innerContent.push(`{${textValue.value}}`);
    } else {
      // If textValue is a plain string literal from the parser (e.g., "Hello World")
      // No need to call extractIdentifiers for literal strings
      innerContent.push(textValue); // Direct text content in JSX does not need JSON.stringify
    }
  }

  // Add children JSX after the text content
  innerContent.push(...(children || []).map(c => generateJSX(c, childIndent)));

  const inner = innerContent.filter(Boolean).join("\n"); // Filter out empty strings/nulls and join

  // Combine generated props and special input props
  const finalPropString = [propStr, specialInputProps].filter(Boolean).join(" ");

  // Determine if it's a self-closing tag or has children/text content
  if (inner.trim() === "") {
    return `${indent}<${jsxTag}${finalPropString ? " " + finalPropString : ""} />`;
  } else {
    return `${indent}<${jsxTag}${finalPropString ? " " + finalPropString : ""}>\n${inner}\n${indent}</${jsxTag}>`;
  }
}

// Generate the main JSX body from the AST
const jsxBody = ast.map(node => generateJSX(node)).join("\n");

// Determine which variables should be passed as props to CompiledUI
// Filter out internal states and their setters
const propsToInject = Array.from(usedIdentifiers).filter(id => {
  const varName = id.startsWith("set") ? id.slice(3) : id; // Get base var name from setter
  const isInternalStateVar = internalStates.has(varName);
  const isInternalStateSetter = id.startsWith("set") && internalStates.has(varName);
  return !isInternalStateVar && !isInternalStateSetter;
}).sort(); // Sort for consistent output

// Generate useState hooks for internal states
const autoStates = Array.from(internalStates.entries())
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
  // IMPORTANT: Ensure that any props like 'greet', 'users', 'showMore', 'toggle',
  // and any 'bind' targets that are managed by the parent (e.g., 'name', 'setName')
  // are passed down from the parent component that renders <CompiledUI />.
  //
  // Example in your App.jsx:
  // import React, { useState } from 'react';
  // import CompiledUI from './CompiledUI.jsx';
  //
  // function App() {
  //   const [name, setName] = useState(""); // State for the input, managed by App
  //   const [showMore, setShowMore] = useState(true);
  //   const users = [{ name: "Alice" }, { name: "Bob" }];
  //
  //   const greet = () => alert(\`Hello, \${name}\`); // greet uses App's 'name' via closure
  //   const toggle = () => setShowMore(prev => !prev);
  //
  //   return (
  //     <div style={{ fontFamily: "sans-serif", padding: 24 }}>
  //       <CompiledUI
  //         name={name} // Pass name as prop
  //         setName={setName} // Pass setName as prop
  //         showMore={showMore}
  //         toggle={toggle}
  //         users={users}
  //         greet={greet} // Pass greet as prop
  //       />
  //     </div>
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
if (internalStates.size > 0) {
  console.log("✅ Injected state for:", Array.from(internalStates.keys()).join(", "));
}
