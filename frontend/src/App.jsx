import { useState } from "react";

export default function App() {
  const [started, setStarted] = useState(false);

  return (
    <div style={{textAlign:"center"}}>
      <h1>Secure Online Exam</h1>
      {!started ?
        <button onClick={()=>setStarted(true)}>Start Exam</button>
        :
        <h2>Exam Started — AI Monitoring Active</h2>
      }
    </div>
  );
}
