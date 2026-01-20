const express = require("express");
const app = express();
app.use(express.json());

app.get("/", (req,res)=>res.send("Backend Running"));

app.post("/ai-alert", (req,res)=>{
  console.log("Cheating Alert:", req.body);
  res.sendStatus(200);
});

app.listen(5000, ()=>console.log("Backend started"));
