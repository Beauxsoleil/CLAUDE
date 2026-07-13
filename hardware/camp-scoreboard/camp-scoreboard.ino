// ─────────────────────────────────────────────────────────────────────────────
//  Camp Points — hardware scoreboard for ESP32 + ILI9341 TFT
//
//  Reads ONE camp from the Camp Points web app's Cloud Firestore database and
//  shows a live, ranked leaderboard of every team. The app stores no per-team
//  "score" — each team's total is the sum of that camp's `transactions` — so
//  this sketch reads the teams and transactions and adds them up itself.
//
//  It talks to Firestore over its plain HTTPS REST API using only the project's
//  Web API key: the app's security rules allow anyone with the camp code to read
//  a camp's teams and transactions, so no login is required. (This also means
//  the older RTDB-oriented FirebaseESP32 library is NOT used.)
//
//  Libraries (install via Arduino Library Manager):
//    - Adafruit GFX Library
//    - Adafruit ILI9341
//    - ArduinoJson  (version 7.x)
//  WiFi / WiFiClientSecure / HTTPClient come with the ESP32 board package.
// ─────────────────────────────────────────────────────────────────────────────

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <ArduinoJson.h>

// ── User configuration ────────────────────────────────────────────────────────
#define WIFI_SSID            "YOUR_WIFI_SSID"
#define WIFI_PASSWORD        "YOUR_WIFI_PASSWORD"

// From your Firebase project (Project settings → General → your Web app config).
// These are the SAME values the web app uses as VITE_FIREBASE_PROJECT_ID and
// VITE_FIREBASE_API_KEY.
#define FIREBASE_PROJECT_ID  "YOUR_PROJECT_ID"
#define FIREBASE_API_KEY     "YOUR_WEB_API_KEY"

// The 5-letter camp code shown on the app's Setup tab (e.g. "P9NCF").
#define CAMP_ID              "ABCDE"

// Behaviour
static const uint32_t POLL_MS      = 5000;   // refresh every 5 s
static const int      MAX_TEAMS    = 32;     // teams tracked
static const int      VISIBLE_ROWS = 6;      // rows that fit on the screen
static const int      TX_PAGE_SIZE = 250;    // transactions fetched per request
static const long     MAX_TX       = 8000;   // safety cap across all pages
// ─────────────────────────────────────────────────────────────────────────────

// Pin definitions (from wiring)
#define TFT_CS    5
#define TFT_DC    4
#define TFT_RST   16
#define TOUCH_CS  17   // unused here

Adafruit_ILI9341 tft = Adafruit_ILI9341(TFT_CS, TFT_DC, TFT_RST);
WiFiClientSecure secureClient;

// ── Colour palette ────────────────────────────────────────────────────────────
#define C_BG      ILI9341_BLACK
#define C_PANEL   0x1082          // dark charcoal
#define C_ROW_ALT 0x0841          // slightly lighter row
#define C_ACCENT  0xF800          // red
#define C_TEXT    ILI9341_WHITE
#define C_DIM     0x8410          // mid-grey
#define C_SCORE   ILI9341_YELLOW

// ── Layout constants (screen 320 × 240 landscape) ─────────────────────────────
#define SCR_W     320
#define SCR_H     240
#define HEADER_H  36
#define ROW_TOP   (HEADER_H + 2)
#define ROW_H     ((SCR_H - ROW_TOP) / VISIBLE_ROWS)

// ── Scoreboard state ──────────────────────────────────────────────────────────
struct Team {
  String   id;
  String   name;
  uint16_t color;   // RGB565
  long     score;   // sum of transaction points
};

Team   teams[MAX_TEAMS];
int    teamCount = 0;
String campName  = CAMP_ID;

unsigned long lastFetch = 0;
bool          firstDraw = true;
String        lastSig   = "";   // change-detection signature

// Forward declarations
void   connectWiFi();
bool   fetchAll();
bool   fetchCampName();
bool   fetchTeams();
bool   fetchTransactions();
int    findTeam(const String &id);
void   sortTeams();
String buildSignature();
void   redrawScoreboard();
void   drawHeader();
void   drawRow(int row, int rank, const Team &t, bool leader);
void   splash(const char *msg);

// ── Small helpers ─────────────────────────────────────────────────────────────

// "#RRGGBB" → RGB565. Falls back to grey if the string is malformed.
uint16_t hexToColor565(const String &hex) {
  if (hex.length() < 7 || hex[0] != '#') return C_DIM;
  long v = strtol(hex.c_str() + 1, nullptr, 16);
  uint8_t r = (v >> 16) & 0xFF, g = (v >> 8) & 0xFF, b = v & 0xFF;
  return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
}

// The document id is the final path segment of the Firestore resource name.
String lastPathSegment(const String &resourceName) {
  int slash = resourceName.lastIndexOf('/');
  return slash < 0 ? resourceName : resourceName.substring(slash + 1);
}

// Percent-encode a value for safe use in a query string (page tokens contain
// '=', '/', '+').
String urlEncode(const String &s) {
  static const char *hexd = "0123456789ABCDEF";
  String out;
  out.reserve(s.length() * 3);
  for (size_t i = 0; i < s.length(); i++) {
    char c = s[i];
    if (isalnum((unsigned char)c) || c == '-' || c == '_' || c == '.' || c == '~') {
      out += c;
    } else {
      out += '%';
      out += hexd[(c >> 4) & 0xF];
      out += hexd[c & 0xF];
    }
  }
  return out;
}

String firestoreBase() {
  return String("https://firestore.googleapis.com/v1/projects/") + FIREBASE_PROJECT_ID +
         "/databases/(default)/documents";
}

// Read a `points` field that may arrive as integerValue (a JSON string) or
// doubleValue (a JSON number).
long readPoints(JsonVariantConst pointsField) {
  if (pointsField["integerValue"].is<const char *>())
    return atol(pointsField["integerValue"].as<const char *>());
  if (pointsField["doubleValue"].is<double>())
    return lround(pointsField["doubleValue"].as<double>());
  return 0;
}

// ── HTTP + parsing ────────────────────────────────────────────────────────────

// GET `url`, stream-parse the body into `out` keeping only the fields in
// `filter`. Returns true on HTTP 200 + successful parse.
bool getFiltered(const String &url, JsonDocument &out, JsonDocument &filter) {
  HTTPClient https;
  if (!https.begin(secureClient, url)) return false;
  int code = https.GET();
  if (code != HTTP_CODE_OK) {
    Serial.printf("HTTP %d for %s\n", code, url.c_str());
    https.end();
    return false;
  }
  DeserializationError err =
      deserializeJson(out, https.getStream(), DeserializationOption::Filter(filter));
  https.end();
  if (err) {
    Serial.printf("JSON parse error: %s\n", err.c_str());
    return false;
  }
  return true;
}

bool fetchCampName() {
  String url = firestoreBase() + "/camps/" + CAMP_ID + "?mask.fieldPaths=name&key=" + FIREBASE_API_KEY;
  JsonDocument filter;
  filter["fields"]["name"]["stringValue"] = true;
  JsonDocument doc;
  if (!getFiltered(url, doc, filter)) return false;
  const char *n = doc["fields"]["name"]["stringValue"];
  if (n && *n) campName = n;
  return true;
}

bool fetchTeams() {
  JsonDocument filter;
  filter["documents"][0]["name"] = true;
  filter["documents"][0]["fields"]["name"]["stringValue"] = true;
  filter["documents"][0]["fields"]["color"]["stringValue"] = true;
  filter["nextPageToken"] = true;

  teamCount = 0;
  String pageToken = "";
  do {
    String url = firestoreBase() + "/camps/" + CAMP_ID +
                 "/teams?pageSize=100&mask.fieldPaths=name&mask.fieldPaths=color&key=" + FIREBASE_API_KEY;
    if (pageToken.length()) url += "&pageToken=" + urlEncode(pageToken);

    JsonDocument doc;
    if (!getFiltered(url, doc, filter)) return false;

    for (JsonObjectConst d : doc["documents"].as<JsonArrayConst>()) {
      if (teamCount >= MAX_TEAMS) break;
      Team &t = teams[teamCount++];
      t.id    = lastPathSegment(d["name"].as<const char *>());
      t.name  = d["fields"]["name"]["stringValue"] | "Team";
      t.color = hexToColor565(d["fields"]["color"]["stringValue"] | "#8410");
      t.score = 0;
    }
    pageToken = doc["nextPageToken"] | "";
  } while (pageToken.length() && teamCount < MAX_TEAMS);

  return true;
}

bool fetchTransactions() {
  JsonDocument filter;
  filter["documents"][0]["fields"]["teamId"]["stringValue"] = true;
  filter["documents"][0]["fields"]["points"]["integerValue"] = true;
  filter["documents"][0]["fields"]["points"]["doubleValue"] = true;
  filter["nextPageToken"] = true;

  String pageToken = "";
  long   seen = 0;
  do {
    String url = firestoreBase() + "/camps/" + CAMP_ID +
                 "/transactions?pageSize=" + TX_PAGE_SIZE +
                 "&mask.fieldPaths=teamId&mask.fieldPaths=points&key=" + FIREBASE_API_KEY;
    if (pageToken.length()) url += "&pageToken=" + urlEncode(pageToken);

    JsonDocument doc;
    if (!getFiltered(url, doc, filter)) return false;

    for (JsonObjectConst d : doc["documents"].as<JsonArrayConst>()) {
      const char *teamId = d["fields"]["teamId"]["stringValue"];
      if (!teamId) continue;
      int idx = findTeam(teamId);
      if (idx >= 0) teams[idx].score += readPoints(d["fields"]["points"]);
      seen++;
    }
    pageToken = doc["nextPageToken"] | "";
  } while (pageToken.length() && seen < MAX_TX);

  return true;
}

bool fetchAll() {
  if (!WiFi.isConnected()) return false;
  fetchCampName();                 // non-fatal; header falls back to CAMP_ID
  if (!fetchTeams()) return false; // teams are the source of leaderboard rows
  if (!fetchTransactions()) return false;
  sortTeams();
  return true;
}

// ── Team helpers ──────────────────────────────────────────────────────────────
int findTeam(const String &id) {
  for (int i = 0; i < teamCount; i++)
    if (teams[i].id == id) return i;
  return -1;
}

void sortTeams() {  // selection sort, N is small
  for (int i = 0; i < teamCount - 1; i++) {
    int best = i;
    for (int j = i + 1; j < teamCount; j++)
      if (teams[j].score > teams[best].score) best = j;
    if (best != i) { Team tmp = teams[i]; teams[i] = teams[best]; teams[best] = tmp; }
  }
}

String buildSignature() {
  String s = WiFi.isConnected() ? "on|" : "off|";
  s += campName + "|";
  for (int i = 0; i < teamCount; i++) { s += teams[i].id; s += ':'; s += teams[i].score; s += ';'; }
  return s;
}

// ── Rendering ─────────────────────────────────────────────────────────────────
void drawHeader() {
  tft.fillRect(0, 0, SCR_W, HEADER_H, C_ACCENT);
  tft.setTextColor(C_TEXT);
  tft.setTextSize(2);
  tft.setCursor(8, 10);
  // Truncate camp name so it doesn't collide with the status text
  String title = campName;
  if (title.length() > 14) title = title.substring(0, 14);
  tft.print(title);

  tft.setTextSize(1);
  tft.setCursor(SCR_W - 76, 6);
  tft.print("Camp ");
  tft.print(CAMP_ID);
  tft.setCursor(SCR_W - 76, 20);
  tft.print(WiFi.isConnected() ? "WiFi OK" : "No WiFi");
}

// Fit `name` into `maxW` pixels at the current text size, trimming with a dot.
String fitName(const String &name, int maxW) {
  int16_t x, y; uint16_t w, h;
  String s = name;
  tft.getTextBounds(s.c_str(), 0, 0, &x, &y, &w, &h);
  while (w > maxW && s.length() > 1) {
    s = s.substring(0, s.length() - 1);
    tft.getTextBounds((s + ".").c_str(), 0, 0, &x, &y, &w, &h);
  }
  return (s == name) ? s : (s + ".");
}

void drawRow(int row, int rank, const Team &t, bool leader) {
  int y = ROW_TOP + row * ROW_H;
  uint16_t bg = leader ? C_PANEL : (row & 1 ? C_ROW_ALT : C_BG);
  tft.fillRect(0, y, SCR_W, ROW_H, bg);

  // Rank
  tft.setTextSize(2);
  tft.setTextColor(leader ? C_SCORE : C_DIM);
  tft.setCursor(6, y + (ROW_H - 16) / 2);
  tft.print(rank);

  // Team colour swatch
  tft.fillRoundRect(34, y + (ROW_H - 16) / 2, 16, 16, 3, t.color);

  // Team name
  tft.setTextColor(C_TEXT);
  int nameX = 58;
  int scoreW = 66;                       // reserved width for the score
  int nameMaxW = SCR_W - nameX - scoreW - 6;
  tft.setCursor(nameX, y + (ROW_H - 16) / 2);
  tft.print(fitName(t.name, nameMaxW));

  // Score (right-aligned)
  String sc = String(t.score);
  int16_t bx, by; uint16_t bw, bh;
  tft.getTextBounds(sc.c_str(), 0, 0, &bx, &by, &bw, &bh);
  tft.setTextColor(C_SCORE);
  tft.setCursor(SCR_W - 6 - bw, y + (ROW_H - 16) / 2);
  tft.print(sc);

  tft.drawFastHLine(0, y + ROW_H - 1, SCR_W, C_PANEL);
}

void redrawScoreboard() {
  tft.fillScreen(C_BG);
  drawHeader();
  if (teamCount == 0) {
    tft.setTextSize(2);
    tft.setTextColor(C_DIM);
    tft.setCursor(20, SCR_H / 2 - 8);
    tft.print("No teams yet");
    return;
  }
  int rows = min(teamCount, VISIBLE_ROWS);
  for (int i = 0; i < rows; i++)
    drawRow(i, i + 1, teams[i], i == 0);
}

void splash(const char *msg) {
  tft.fillScreen(C_BG);
  tft.setTextColor(C_TEXT);
  tft.setTextSize(2);
  tft.setCursor(20, SCR_H / 2 - 8);
  tft.print(msg);
}

// ── WiFi ──────────────────────────────────────────────────────────────────────
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries++ < 40) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();
  if (WiFi.isConnected())
    Serial.println("WiFi connected: " + WiFi.localIP().toString());
  else
    Serial.println("WiFi failed — will keep retrying");
}

// ── Setup / Loop ──────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  tft.begin();
  tft.setRotation(1);   // landscape
  splash("Connecting WiFi...");

  connectWiFi();

  // Firestore's cert is not validated (the data is public, read-only). To
  // harden, replace with secureClient.setCACert(...) using the GTS root R1/R4.
  secureClient.setInsecure();

  splash("Loading camp...");
  fetchAll();
  redrawScoreboard();
  lastSig   = buildSignature();
  firstDraw = false;
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(500);
  }

  unsigned long now = millis();
  if (now - lastFetch >= POLL_MS) {
    lastFetch = now;
    fetchAll();
    String sig = buildSignature();
    if (firstDraw || sig != lastSig) {
      redrawScoreboard();
      lastSig   = sig;
      firstDraw = false;
    }
  }
}
