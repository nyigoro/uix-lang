import React, { useState } from "react";
import CompiledUI from "./CompiledUI";

export default function App() {
  const [name, setName] = useState("");

  const greet = () => {
    alert(`Hello, ${name || "stranger"}!`);
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: 24 }}>
      <CompiledUI name={name} setName={setName} greet={greet} />
    </div>
  );
}
