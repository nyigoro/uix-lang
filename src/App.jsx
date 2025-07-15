import React, { useState } from "react";
import CompiledUI from "./CompiledUI";

export default function App() {
  const [name, setName] = useState("");
  const [showMore, setShowMore] = useState(true);
  const users = [{ name: "Alice" }, { name: "Bob" }];

  const greet = () => alert(`Hello, ${name}!`);
  const toggle = () => setShowMore(prev => !prev);

  return (
    <div style={{ fontFamily: "sans-serif", padding: 24 }}>
      <CompiledUI
        name={name}
        setName={setName}
        showMore={showMore}
        toggle={toggle}
        users={users}
        greet={greet}
      />
    </div>
  );
}
