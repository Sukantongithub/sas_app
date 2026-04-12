// ml-service.js - Integrate ML predictions with Node.js server

const { spawn } = require("child_process");
const net = require("net");

class MLPredictor {
  constructor(pythonScriptPath, port = 9999) {
    this.port = port;
    this.pythonProcess = null;
    this.socket = null;
    this.predictions = [];
    this.startPythonServer(pythonScriptPath);
  }

  startPythonServer(scriptPath) {
    console.log("Starting Python ML service...");
    this.pythonProcess = spawn("python", [scriptPath]);

    this.pythonProcess.stdout.on("data", (data) => {
      console.log(`[ML] ${data.toString()}`);
    });

    this.pythonProcess.stderr.on("data", (data) => {
      console.error(`[ML Error] ${data.toString()}`);
    });

    // Give Python time to start, then connect
    setTimeout(() => {
      this.connectToML();
    }, 2000);
  }

  connectToML() {
    this.socket = net.createConnection(this.port, "localhost", () => {
      console.log("✅ Connected to ML service");
    });

    this.socket.on("data", (data) => {
      try {
        const prediction = JSON.parse(data.toString());
        this.predictions.unshift(prediction);
        if (this.predictions.length > 50) this.predictions.pop();
      } catch (e) {
        console.error("Failed to parse ML response:", e);
      }
    });

    this.socket.on("end", () => {
      console.log("ML service disconnected");
      setTimeout(() => this.connectToML(), 5000);
    });
  }

  predictMotion(ax, ay, az, motion, rssi) {
    if (this.socket && !this.socket.destroyed) {
      const data = JSON.stringify({ ax, ay, az, motion, rssi }) + "\n";
      this.socket.write(data);
    }
  }

  getLastPrediction() {
    return this.predictions.length > 0 ? this.predictions[0] : null;
  }

  getAllPredictions() {
    return this.predictions;
  }
}

module.exports = MLPredictor;
