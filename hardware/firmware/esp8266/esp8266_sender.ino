/**
 * ESP8266 Sender Firmware – Smart Attendance System
 *
 * Connects to PC WiFi hotspot and sends attendance/motion data
 * via HTTP POST to http://192.168.137.1:5000/api/hardware/data
 *
 * Board: NodeMCU / Generic ESP8266
 * Arduino IDE: Tools → Board → ESP8266 Boards → NodeMCU 1.0
 * Required libraries (install via Library Manager):
 *   - ESP8266WiFi       (bundled with ESP8266 board package)
 *   - ESP8266HTTPClient (bundled with ESP8266 board package)
 *   - ArduinoJson       v6.x  (by Benoit Blanchon)
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>

// ─── WiFi Credentials ────────────────────────────────────────────────────────
// Set these to your PC/Laptop hotspot SSID and password.
const char* WIFI_SSID     = "YOUR_HOTSPOT_SSID";
const char* WIFI_PASSWORD = "YOUR_HOTSPOT_PASSWORD";

// ─── Server Config ────────────────────────────────────────────────────────────
const char* SERVER_HOST   = "192.168.137.1";
const int   SERVER_PORT   = 5000;
const char* DATA_ENDPOINT = "/api/hardware/data";
const char* DEVICE_API_KEY = "sas-hardware-secret-2024"; // Must match backend HARDWARE_API_KEY

// ─── Device Identity ──────────────────────────────────────────────────────────
const char* DEVICE_ID     = "ESP8266-001";  // Unique ID for this ESP8266 unit

// ─── Send interval ────────────────────────────────────────────────────────────
const unsigned long SEND_INTERVAL_MS = 10000; // Send every 10 seconds

// ─── State ────────────────────────────────────────────────────────────────────
unsigned long lastSendTime = 0;
int           failCount    = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: read sensors (stubs — replace with real sensor reads)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read motion flag from a PIR/MPU sensor.
 * Replace this stub with actual GPIO or I2C sensor read.
 * Returns: 1 = motion detected, 0 = no motion
 */
int readMotionFlag() {
  // Example for a PIR sensor on D1 (GPIO5):
  // return digitalRead(D1);
  return 0; // stub: no motion
}

/**
 * Read battery level percentage (0–100).
 * ESP8266 has no built-in ADC for battery; use A0 with a voltage divider.
 * Vbat → 100kΩ → A0 → 47kΩ → GND  (for ~4.2V full scale on 1.0V ADC)
 */
int readBatteryLevel() {
  int raw = analogRead(A0);           // 0–1023
  int pct = map(raw, 0, 1023, 0, 100);
  return constrain(pct, 0, 100);
}

/**
 * Read RSSI of the current WiFi connection.
 */
int readRSSI() {
  return WiFi.RSSI(); // dBm, e.g. -65
}

// ─────────────────────────────────────────────────────────────────────────────
// WiFi Management
// ─────────────────────────────────────────────────────────────────────────────

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("\n[WiFi] Connecting to %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WiFi] Signal: %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("\n[WiFi] Connection FAILED — will retry next cycle");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Send
// ─────────────────────────────────────────────────────────────────────────────

bool sendData() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Not connected — skipping send");
    return false;
  }

  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["deviceId"]     = DEVICE_ID;
  doc["motionFlag"]   = readMotionFlag();
  doc["batteryLevel"] = readBatteryLevel();
  doc["rssi"]         = readRSSI();
  doc["timestamp"]    = millis(); // milliseconds since boot; server can use arrival time

  String jsonBody;
  serializeJson(doc, jsonBody);

  // Build URL
  String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + DATA_ENDPOINT;

  WiFiClient client;
  HTTPClient http;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  http.setTimeout(8000); // 8 second timeout

  Serial.printf("[HTTP] POST %s\n", url.c_str());
  Serial.printf("[HTTP] Payload: %s\n", jsonBody.c_str());

  int httpCode = http.POST(jsonBody);

  bool success = false;
  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("[HTTP] Response %d: %s\n", httpCode, response.c_str());
    success = (httpCode == 200 || httpCode == 201);
    failCount = 0;
  } else {
    Serial.printf("[HTTP] Error: %s\n", http.errorToString(httpCode).c_str());
    failCount++;
  }

  http.end();
  return success;
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup & Loop
// ─────────────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n\n========================================");
  Serial.println("  SAS ESP8266 Sender  v1.0");
  Serial.printf ("  Device ID : %s\n", DEVICE_ID);
  Serial.printf ("  Server    : %s:%d\n", SERVER_HOST, SERVER_PORT);
  Serial.println("========================================\n");

  // Sensor pin setup (add your real pins here)
  // pinMode(D1, INPUT); // PIR sensor example

  connectWiFi();
}

void loop() {
  // Reconnect WiFi if lost
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Disconnected — reconnecting...");
    connectWiFi();
    delay(2000);
    return;
  }

  // Send data at the configured interval
  unsigned long now = millis();
  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = now;
    bool ok = sendData();
    if (!ok) {
      Serial.printf("[WARN] Send failed (consecutive failures: %d)\n", failCount);
      // Back off if many failures — avoid hammering the server
      if (failCount >= 5) {
        Serial.println("[WARN] Too many failures, waiting 60 seconds...");
        delay(60000);
        failCount = 0;
      }
    }
  }

  delay(100);
}
