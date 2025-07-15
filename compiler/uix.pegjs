Start
  = _ elements:ElementList? _ {
      return elements ?? [];
    }

ElementList
  = head:Element tail:(_ Element)* {
      return [head, ...tail.map(t => t[1])];
    }

Element
  = name:Identifier _ props:Props? _ children:Block? {
      return {
        type: name,
        props: props ?? {},
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
  = key:Identifier _ ":" _ value:Value {
      return [key, value];
    }

Value
  = String / Identifier

Identifier
  = $([a-zA-Z_][a-zA-Z0-9_]*)

String
  = "\"" chars:Char* "\"" { return chars.join(""); }

Char
  = "\\" "\"" { return "\"" }
  / [^"]

_ "whitespace"
  = [ \t\n\r]*  // ✅ skip any whitespace