Start
  = _ items:(ComponentDefinition / AppElement)* _ {
      // Separate components and app element after parsing
      const components = items.filter(item => item.type === "ComponentDefinition");
      const app = items.find(item => item.type === "App");
      return { components: components, app: app };
    }

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
      // Ensure 'App' is not matched here, as it's now AppElement
      if (name === "App") {
        // This error should ideally not be hit if AppElement is correctly parsed at top-level
        // but acts as a safeguard.
        error("Unexpected 'App' element here. 'App' should be a top-level declaration.");
      }
      return {
        type: name,
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
      return [key, value];
    }

Value = String / Expression

Expression
  = val:$(Identifier ("." Identifier)*) { return { type: 'expression', value: val }; }

Identifier
  = $([a-zA-Z_][a-zA-Z0-9_]*)

String
  = "\"" chars:Char* "\"" { return chars.join(""); }

Char
  = '\\"'  { return '"'; }
  / '\\\\' { return '\\'; }
  / [^"\\] { return text(); }

_ "whitespace"
  = [ \t\n\r]*