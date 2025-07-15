Start
  = _ elements:ElementList? _ {
      return elements ?? [];
    }

ElementList
  = head:Element tail:(_ Element)* {
      return [head, ...tail.map(t => t[1])];
    }

Element
  = IfBlock
  / ForBlock
  / StandardElement

StandardElement
  = name:Identifier _ props:Props? _ children:Block? {
      return {
        type: name,
        props: props ?? {},
        children: children ?? []
      };
    }

IfBlock
  = "if" _ "(" _ cond:Expression _ ")" _ children:Block { // Condition is now explicitly an Expression
      return {
        type: "If",
        condition: cond, // cond will be { type: 'expression', value: '...' }
        children: children ?? []
      };
    }

ForBlock
  = "for" _ "(" _ item:Identifier _ "in" _ list:Expression _ ")" _ children:Block { // List is now explicitly an Expression
      return {
        type: "For",
        item,
        list: list, // list will be { type: 'expression', value: '...' }
        children: children ?? []
      };
    }

Block
  = "{" _ elements:ElementList? _ "}" {
      return elements ?? [];
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
  = key:Identifier _ ":" _ value:Value { // Value can be a String or an Expression
      return [key, value];
    }

Value = String / Expression

Expression
  = val:$(Identifier ("." Identifier)*) { return { type: 'expression', value: val }; } // Returns an object for expressions

Identifier
  = $([a-zA-Z_][a-zA-Z0-9_]*)

String
  = "\"" chars:Char* "\"" { return chars.join(""); } // Returns a plain string for literals

Char
  = '\\"'  { return '"'; }
  / '\\\\' { return '\\'; }
  / [^"\\] { return text(); }

_ "whitespace"
  = [ \t\n\r]*