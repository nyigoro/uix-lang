{{
  // Helper function to convert a parsed Term object into its JavaScript string representation
  // This is used by the Expression rule to build a valid JS string for concatenation.
  function formatTermForJs(term) {
    if (term.type === 'string') {
      return JSON.stringify(term.value); // Properly quote string literals for JS
    } else if (term.type === 'number') {
      return term.value.toString(); // Numbers are fine as-is in JS
    } else if (term.type === 'identifier') {
      return term.value; // Identifiers are fine as-is in JS
    }
    // Fallback for unexpected types, though all terms should be handled above
    return String(term);
  }
}}

Start
  = items:(TopLevelItem)* _ { // Allow zero or more top-level items, followed by optional trailing whitespace for the whole file
      const allItems = items;
      const components = allItems.filter(item => item.type === "ComponentDefinition");
      const app = allItems.find(item => item.type === "App");
      return { components: components, app: app };
    }

TopLevelItem // Each top-level item consumes its own leading and trailing whitespace
  = _ item:(ComponentDefinition / AppElement) _ { return item; }

ComponentDefinition
  = "component" _ name:Identifier _ "(" params:ParameterList? ")" _ body:Block {
      return { type: "ComponentDefinition", name: name, params: params ?? [], body: body };
    }

ParameterList
  = head:Identifier tail:(_ "," _ Identifier)* {
      return [head, ...tail.map(t => t[3])];
    }

AppElement "App"
  = "App" _ body:Block {
      return { type: "App", body: body };
    }

Element
  = IfBlock
  / ForBlock
  / StandardElement

StandardElement
  = name:Identifier _ props:Props? _ children:Block? {
      return {
        type: name.value, // Return the string value of the identifier
        props: props ?? {},
        children: children ?? []
      };
    }

IfBlock
  = "if" _ "(" _ cond:Expression _ ")" _ children:Block {
      return {
        type: "If",
        condition: cond,
        children: children ?? []
      };
    }

ForBlock
  = "for" _ "(" _ item:Identifier _ "in" _ list:Expression _ ")" _ children:Block {
      return {
        type: "For",
        item,
        list: list,
        children: children ?? []
      };
    }

Block
  = "{" _ elements:ElementList? _ "}" {
      return elements ?? [];
    }

ElementList
  = head:Element tail:(_ Element)* {
      return [head, ...tail.map(t => t[1])];
    }

Props
  = "(" _ pairs:PropList? _ ")" {
      return Object.fromEntries(pairs ?? []);
    }

PropList
  = head:Prop tail:(_ "," _ Prop)* {
      return [head, ...tail.map(t => t[3])];
    }

Prop
  = key:Identifier _ ":" _ value:Value {
      return [key.value, value]; // Store key as its string value
    }

Value // Can be a simple String, Number, or a complex Expression
  = String / Number / Expression

Expression
  = first:Term rest:(_ "+" _ Term)* {
      let resultParts = [];
      resultParts.push(formatTermForJs(first));
      for (const r of rest) {
        resultParts.push(" + "); // Add the operator as a literal string
        resultParts.push(formatTermForJs(r[3]));
      }
      return { type: 'expression', value: resultParts.join("") };
    }

Term
  = IdentifierWithAccess / String / Number

IdentifierWithAccess
  = base:Identifier access:("." Identifier ("(" _ ")")? )* { // Added optional () for method calls
      let fullNameParts = [base.value];
      access.forEach(a => {
        fullNameParts.push(a[1].value + (a[2] ? "()" : ""));
      });
      return { type: 'identifier', value: fullNameParts.join(".") };
    }

Identifier
  = $([a-zA-Z_][a-zA-Z0-9_]*) { return { type: 'identifier', value: text() }; } // Return object for Identifier

String
  = "\"" chars:Char* "\"" {
      return { type: 'string', value: chars.join("") };
    }

Number
  = digits:$([0-9]+) {
      return { type: 'number', value: parseInt(digits, 10) };
    }

Char
  = '\\"'  { return '"'; }
  / '\\\\' { return '\\'; }
  / [^"\\] { return text(); }

_ "whitespace"
  = [ \t\n\r]*