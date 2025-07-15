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
  = "if" _ "(" _ cond:Identifier _ ")" _ children:Block {
      return {
        type: "If",
        condition: cond,
        children: children ?? []
      };
    }

ForBlock
  = "for" _ "(" _ item:Identifier _ "in" _ list:Identifier _ ")" _ children:Block {
      return {
        type: "For",
        item,
        list,
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
  = key:Identifier _ ":" _ value:BindOrValue {
      return [key, value];
    }

BindOrValue
  = "bind" _ ":" _ id:Identifier _ "=" _ val:String {
      return { bind: id, bindDefault: val };
    }
  / "bind" _ ":" _ id:Identifier {
      return { bind: id };
    }
  / value:Value {
      return value;
    }

Value = String / Expression

Expression
  = first:Identifier rest:("." Identifier)* { // Redefined to explicitly match identifiers separated by dots
      let result = first;
      for (let i = 0; i < rest.length; i++) {
        result += "." + rest[i][1]; // Concatenate the dot and the subsequent identifier
      }
      return result;
    }

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