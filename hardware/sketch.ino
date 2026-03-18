#include <WiFi.h>
#include <WebSocketsClient.h>
#include <MPU6050.h>
#include <Wire.h>

const char* ssid     = "Wokwi-GUEST";
const char* password = "";

// ngrok public WSS endpoint — ngrok terminates TLS and forwards to localhost:80
const char* wsHost = "bladeless-nichol-nondistractedly.ngrok-free.dev";
const int   wsPort = 443;   // WSS over HTTPS (ngrok always uses 443 externally)
const char* wsPath = "/";

WebSocketsClient webSocket;
MPU6050 mpu;
bool wsConnected = false;

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.println("✅ WebSocket connected to server");
      wsConnected = true;
      break;

    case WStype_DISCONNECTED:
      Serial.println("❌ WebSocket disconnected");
      wsConnected = false;
      break;

    case WStype_TEXT:
      Serial.print("📥 Server response: ");
      Serial.println((char*)payload);
      break;

    case WStype_ERROR:
      Serial.println("⚠️ WebSocket error");
      break;

    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  mpu.initialize();

  // Connect WiFi
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected! IP: " + WiFi.localIP().toString());

  // Connect via WSS (SSL) — ngrok exposes HTTPS/WSS on port 443
  webSocket.beginSSL(wsHost, wsPort, wsPath);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000);

  // Required ngrok header to bypass browser warning page
  webSocket.setExtraHeaders("ngrok-skip-browser-warning: true");
}

void loop() {
  webSocket.loop(); // Must be first — keeps connection alive

  if (wsConnected) {
    int16_t ax, ay, az, gx, gy, gz;
    mpu.getAcceleration(&ax, &ay, &az);
    mpu.getRotation(&gx, &gy, &gz);

    float motion = abs(gx) + abs(gy) + abs(gz);

    // Send JSON payload
    String data = "{\"motion\":" + String((int)motion) +
                  ",\"acceleration\":{\"x\":" + String(ax) +
                  ",\"y\":" + String(ay) +
                  ",\"z\":" + String(az) + "}" +
                  ",\"gyro\":{\"x\":" + String(gx) +
                  ",\"y\":" + String(gy) +
                  ",\"z\":" + String(gz) + "}}";

    Serial.print("📤 Sending: ");
    Serial.println(data);

    webSocket.sendTXT(data);
  } else {
    Serial.println("⏳ Waiting for WebSocket connection...");
  }

  delay(500);
}
