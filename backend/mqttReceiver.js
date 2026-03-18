const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

// Motion endpoint
app.post("/motion", (req, res) => {

  const data = req.body;

  console.log("📡 Motion Data Received:", data);

  const motion = data.motion || 0;

  const status = motion > 20000 ? "PRESENT ✅" : "PROXY ❌";

  res.json({
    status: status,
    motion: motion,
    timestamp: new Date().toISOString()
  });

});

app.listen(8080, () => {
  console.log("🚀 HTTP Server running on http://localhost:8080");
});