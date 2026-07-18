// ─────────────────────────────────────────────────────────────────────────────
//  Camp Points — hardware scoreboard for ESP32 + ILI9341 TFT (+ XPT2046 touch)
//
//  Reads ONE camp from the Camp Points web app's Cloud Firestore database and
//  shows a live, ranked leaderboard of every team, styled to match the app's
//  "Sandstone" (beige) theme. The app stores no per-team "score" — each team's
//  total is the sum of that camp's `transactions` (× 2 on the camp's
//  double-point days) — so this sketch reads the camp doc, teams, and
//  transactions and adds them up the same way the app does (see scoring.ts).
//
//  It talks to Firestore over its plain HTTPS REST API using only the project's
//  Web API key: the app's security rules allow anyone with the camp code to read
//  a camp's teams and transactions, so no login is required.
//
//  WiFi credentials and the camp code are entered on-screen (touch keyboard)
//  on first boot and stored in flash (NVS). Tap the gear in the header any time
//  to run setup again. You can optionally pre-fill the *_DEFAULT defines below,
//  but avoid committing real credentials to git.
//
//  Libraries (install via Arduino Library Manager):
//    - Adafruit GFX Library
//    - Adafruit ILI9341
//    - XPT2046_Touchscreen
//    - ArduinoJson  (version 7.x)
//  WiFi / WiFiClientSecure / HTTPClient / Preferences come with the ESP32
//  board package.
// ─────────────────────────────────────────────────────────────────────────────

#include <Arduino.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <XPT2046_Touchscreen.h>
#include <ArduinoJson.h>
#include <time.h>

// ── User configuration ────────────────────────────────────────────────────────

// From your Firebase project (Project settings → General → your Web app config).
// Same values as the web app's VITE_FIREBASE_PROJECT_ID / VITE_FIREBASE_API_KEY.
#define FIREBASE_PROJECT_ID  "YOUR_PROJECT_ID"
#define FIREBASE_API_KEY     "YOUR_WEB_API_KEY"

// Optional pre-fill. Leave empty ("") to configure on-screen; anything saved
// through the on-screen setup wizard (stored in NVS) wins over these.
#define WIFI_SSID_DEFAULT     ""
#define WIFI_PASSWORD_DEFAULT ""
#define CAMP_ID_DEFAULT       ""   // 5-letter camp code, e.g. "P9NCF"

// POSIX timezone of the people running the camp. Double-point days are stored
// as local dates ("2026-07-18"), so this must match the phones running the app
// or 2× multipliers will flip at the wrong hour. Default: US Central.
#define TIME_ZONE "CST6CDT,M3.2.0,M11.1.0"

// Behaviour
static const uint32_t POLL_MS      = 5000;   // refresh every 5 s
static const int      MAX_TEAMS    = 32;     // teams tracked
static const int      VISIBLE_ROWS = 6;      // rows that fit on the screen
static const int      TX_PAGE_SIZE = 250;    // transactions fetched per request
static const long     MAX_TX       = 8000;   // safety cap across all pages
static const int      MAX_2X_DAYS  = 16;     // double-point days tracked
// ─────────────────────────────────────────────────────────────────────────────

// Pin definitions (from wiring)
#define TFT_CS    5
#define TFT_DC    4
#define TFT_RST   16
#define TOUCH_CS  17
#define TOUCH_IRQ 27

// Raw touch-panel range → screen pixels. Tweak if taps land offset.
#define TS_MINX   200
#define TS_MAXX   3800
#define TS_MINY   200
#define TS_MAXY   3800

// ── Sandstone palette ─────────────────────────────────────────────────────────
// RGB565 versions of the web app's [data-theme='beige'] tokens (src/index.css).
#define C_CANVAS      0xEF3B   // --color-canvas      #ece5d8
#define C_SURFACE     0xFFBD   // --color-surface     #f8f4ec
#define C_SURFACE2    0xEF1A   // --color-surface2    #e9e0d0
#define C_SURFACE3    0xDE97   // --color-surface3    #ddd2bd
#define C_LINE        0xDE77   // --color-line        #d8cdb8
#define C_INK         0x2944   // --color-ink         #2c2822
#define C_INK_MUTED   0x6B2A   // --color-ink-muted   #6f6555
#define C_INK_FAINT   0xA4AF   // --color-ink-faint   #a1957f
#define C_ACCENT      0xC4AA   // --color-accent      #c39457
#define C_ACCENT_HI   0xD54D   // --color-accent-hi   #d2a86c
#define C_ACCENT_LO   0xABC8   // --color-accent-lo   #ab7940
#define C_ACCENT_TEXT 0x8AE4   // --color-accent-text #8a5c22
#define C_ON_ACCENT   0x2944   // --color-on-accent   #2c2822
#define C_POSITIVE    0x5BC9   // --color-positive    #5f7a4e
#define C_DANGER      0xB2A7   // --color-danger      #b0553f
#define C_SPECIAL     0x9B4F   // --color-special     #9a6b7c

// ── Layout constants (screen 320 × 240 landscape) ─────────────────────────────
#define SCR_W     320
#define SCR_H     240
#define HEADER_H  40
#define ROW_TOP   (HEADER_H + 2)
#define ROW_H     ((SCR_H - ROW_TOP) / VISIBLE_ROWS)

Adafruit_ILI9341    tft(TFT_CS, TFT_DC, TFT_RST);
XPT2046_Touchscreen ts(TOUCH_CS, TOUCH_IRQ);
WiFiClientSecure    secureClient;
Preferences         prefs;

// ── Settings (NVS-backed, editable via on-screen wizard) ──────────────────────
String cfgSSID     = "";
String cfgPassword = "";
String cfgCampID   = "";

// ── Scoreboard state ──────────────────────────────────────────────────────────
struct Team {
  String   id;
  String   name;
  uint16_t color;   // RGB565, from the team's app colour
  long     score;   // sum of transaction points × day multiplier
};

Team   teams[MAX_TEAMS];
int    teamCount = 0;
String campName  = "";

String doubleDays[MAX_2X_DAYS];   // local-date keys, "YYYY-MM-DD"
int    doubleDayCount = 0;

unsigned long lastFetch = 0;
bool          firstDraw = true;
String        lastSig   = "";   // change-detection signature

// Forward declarations
void     loadSettings();
void     saveSettings();
bool     settingsComplete();
void     runSetupWizard();
String   pickSSID();
String   promptText(const char *title, const char *fieldLabel, const String &initialVal,
                    bool isPassword, int maxLen);
void     connectWiFi();
bool     fetchAll();
bool     fetchCampMeta();
bool     fetchTeams();
bool     fetchTransactions();
int      findTeam(const String &id);
void     sortTeams();
String   buildSignature();
void     redrawScoreboard();
void     drawHeader();
void     drawRow(int row, int rank, const Team &t, long maxScore);
void     drawGear();
void     splash(const char *msg);
uint16_t hexToColor565(const String &hex);
String   fitName(const String &name, int maxW);

// ── Small helpers ─────────────────────────────────────────────────────────────

// "#RRGGBB" → RGB565. Falls back to a sandstone neutral if malformed.
uint16_t hexToColor565(const String &hex) {
  if (hex.length() < 7 || hex[0] != '#') return C_INK_FAINT;
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

// Read a millisecond epoch (`createdAt`). Needs 64 bits — ESP32 long is 32-bit.
int64_t readMillis(JsonVariantConst f) {
  if (f["integerValue"].is<const char *>())
    return strtoll(f["integerValue"].as<const char *>(), nullptr, 10);
  if (f["doubleValue"].is<double>())
    return (int64_t)f["doubleValue"].as<double>();
  return 0;
}

// Local-timezone day key for an epoch-ms timestamp, e.g. "2026-07-18".
// Mirrors the web app's dayKey() so double-point days line up.
String dayKeyLocal(int64_t ms) {
  time_t t = (time_t)(ms / 1000);
  struct tm tmv;
  localtime_r(&t, &tmv);
  char buf[11];
  snprintf(buf, sizeof(buf), "%04d-%02d-%02d",
           tmv.tm_year + 1900, tmv.tm_mon + 1, tmv.tm_mday);
  return String(buf);
}

// 2 if the transaction happened on a double-point day, else 1 (see scoring.ts).
int txMultiplier(int64_t createdAtMs) {
  if (doubleDayCount == 0 || createdAtMs <= 0) return 1;
  String key = dayKeyLocal(createdAtMs);
  for (int i = 0; i < doubleDayCount; i++)
    if (doubleDays[i] == key) return 2;
  return 1;
}

// True once the clock is NTP-synced and today is a double-point day.
bool todayIsDouble() {
  time_t now = time(nullptr);
  if (now < 1600000000) return false;   // clock not set yet
  return txMultiplier((int64_t)now * 1000) == 2;
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

// Camp doc: display name + the list of double-point days.
bool fetchCampMeta() {
  String url = firestoreBase() + "/camps/" + cfgCampID +
               "?mask.fieldPaths=name&mask.fieldPaths=doublePointDays&key=" + FIREBASE_API_KEY;
  JsonDocument filter;
  filter["fields"]["name"]["stringValue"] = true;
  filter["fields"]["doublePointDays"]["arrayValue"]["values"][0]["stringValue"] = true;
  JsonDocument doc;
  if (!getFiltered(url, doc, filter)) return false;

  const char *n = doc["fields"]["name"]["stringValue"];
  if (n && *n) campName = n;

  doubleDayCount = 0;
  for (JsonVariantConst v :
       doc["fields"]["doublePointDays"]["arrayValue"]["values"].as<JsonArrayConst>()) {
    if (doubleDayCount >= MAX_2X_DAYS) break;
    const char *d = v["stringValue"];
    if (d && *d) doubleDays[doubleDayCount++] = d;
  }
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
    String url = firestoreBase() + "/camps/" + cfgCampID +
                 "/teams?pageSize=100&mask.fieldPaths=name&mask.fieldPaths=color&key=" +
                 FIREBASE_API_KEY;
    if (pageToken.length()) url += "&pageToken=" + urlEncode(pageToken);

    JsonDocument doc;
    if (!getFiltered(url, doc, filter)) return false;

    for (JsonObjectConst d : doc["documents"].as<JsonArrayConst>()) {
      if (teamCount >= MAX_TEAMS) break;
      Team &t = teams[teamCount++];
      t.id    = lastPathSegment(d["name"].as<const char *>());
      t.name  = d["fields"]["name"]["stringValue"] | "Team";
      t.color = hexToColor565(d["fields"]["color"]["stringValue"] | "");
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
  filter["documents"][0]["fields"]["createdAt"]["integerValue"] = true;
  filter["documents"][0]["fields"]["createdAt"]["doubleValue"] = true;
  filter["nextPageToken"] = true;

  String pageToken = "";
  long   seen = 0;
  do {
    String url = firestoreBase() + "/camps/" + cfgCampID +
                 "/transactions?pageSize=" + TX_PAGE_SIZE +
                 "&mask.fieldPaths=teamId&mask.fieldPaths=points&mask.fieldPaths=createdAt&key=" +
                 FIREBASE_API_KEY;
    if (pageToken.length()) url += "&pageToken=" + urlEncode(pageToken);

    JsonDocument doc;
    if (!getFiltered(url, doc, filter)) return false;

    for (JsonObjectConst d : doc["documents"].as<JsonArrayConst>()) {
      const char *teamId = d["fields"]["teamId"]["stringValue"];
      if (!teamId) continue;
      int idx = findTeam(teamId);
      if (idx >= 0) {
        long points = readPoints(d["fields"]["points"]);
        teams[idx].score += points * txMultiplier(readMillis(d["fields"]["createdAt"]));
      }
      seen++;
    }
    pageToken = doc["nextPageToken"] | "";
  } while (pageToken.length() && seen < MAX_TX);

  return true;
}

bool fetchAll() {
  if (!WiFi.isConnected()) return false;
  fetchCampMeta();                 // non-fatal; name/2× days can lag a cycle
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
  s += todayIsDouble() ? "2x|" : "1x|";
  s += campName + "|";
  for (int i = 0; i < teamCount; i++) { s += teams[i].id; s += ':'; s += teams[i].score; s += ';'; }
  return s;
}

// ── Settings (NVS) ────────────────────────────────────────────────────────────

void loadSettings() {
  prefs.begin("camppts", true);
  cfgSSID     = prefs.getString("ssid",     WIFI_SSID_DEFAULT);
  cfgPassword = prefs.getString("password", WIFI_PASSWORD_DEFAULT);
  cfgCampID   = prefs.getString("campid",   CAMP_ID_DEFAULT);
  prefs.end();
  Serial.printf("Settings: SSID='%s' Camp='%s'\n", cfgSSID.c_str(), cfgCampID.c_str());
}

void saveSettings() {
  prefs.begin("camppts", false);
  prefs.putString("ssid",     cfgSSID);
  prefs.putString("password", cfgPassword);
  prefs.putString("campid",   cfgCampID);
  prefs.end();
}

bool settingsComplete() {
  return cfgSSID.length() > 0 && cfgCampID.length() > 0;
}

// ── Touch input ───────────────────────────────────────────────────────────────

bool getTouchPoint(int &sx, int &sy) {
  if (!ts.touched()) return false;
  long ax = 0, ay = 0;
  int samples = 0;
  for (int i = 0; i < 3; i++) {
    TS_Point p = ts.getPoint();
    if (p.z > 100) { ax += p.x; ay += p.y; samples++; }
    delay(5);
  }
  if (samples == 0) return false;
  ax /= samples; ay /= samples;
  sx = map(ax, TS_MINX, TS_MAXX, 0, SCR_W);
  sy = map(ay, TS_MINY, TS_MAXY, 0, SCR_H);
  sx = constrain(sx, 0, SCR_W - 1);
  sy = constrain(sy, 0, SCR_H - 1);
  return true;
}

// Block until a tap (with debounce + release). Returns false on timeout.
bool waitTap(int &sx, int &sy, uint32_t timeoutMs = 0) {
  uint32_t start = millis();
  while (ts.touched()) delay(10);
  while (true) {
    if (timeoutMs && (millis() - start > timeoutMs)) return false;
    if (getTouchPoint(sx, sy)) {
      delay(60);
      while (ts.touched()) delay(10);
      return true;
    }
    delay(20);
  }
}

// ── On-screen keyboard ────────────────────────────────────────────────────────

static const char *KB_ROW0 = "1234567890";
static const char *KB_ROW1 = "QWERTYUIOP";
static const char *KB_ROW2 = "ASDFGHJKL.";
static const char *KB_ROW3 = "ZXCVBNM-_ ";

#define KB_ROWS     4
#define KB_COLS     10
#define KB_KEY_W    28
#define KB_KEY_H    26
#define KB_X0       10
#define KB_Y0       100
#define KB_GAP      2

#define KEY_BACK_X  10
#define KEY_BACK_Y  (KB_Y0 + KB_ROWS * (KB_KEY_H + KB_GAP) + 4)
#define KEY_BACK_W  60
#define KEY_BACK_H  24

#define KEY_CAPS_X  80
#define KEY_CAPS_Y  KEY_BACK_Y
#define KEY_CAPS_W  60
#define KEY_CAPS_H  24

#define KEY_DONE_X  210
#define KEY_DONE_Y  KEY_BACK_Y
#define KEY_DONE_W  100
#define KEY_DONE_H  24

static bool kbCaps = true;

void drawKeyboard(const char *prompt) {
  tft.fillRect(0, 80, SCR_W, SCR_H - 80, C_CANVAS);
  tft.setTextSize(1);
  tft.setTextColor(C_INK_MUTED);
  tft.setCursor(10, 82);
  tft.print(prompt);

  const char *rows[KB_ROWS] = {KB_ROW0, KB_ROW1, KB_ROW2, KB_ROW3};
  for (int r = 0; r < KB_ROWS; r++) {
    for (int c = 0; c < KB_COLS; c++) {
      int x = KB_X0 + c * (KB_KEY_W + KB_GAP);
      int y = KB_Y0 + r * (KB_KEY_H + KB_GAP);
      tft.fillRoundRect(x, y, KB_KEY_W, KB_KEY_H, 3, C_SURFACE);
      tft.drawRoundRect(x, y, KB_KEY_W, KB_KEY_H, 3, C_LINE);
      tft.setTextSize(1);
      tft.setTextColor(C_INK);
      char ch = rows[r][c];
      if (r > 0 && ch >= 'A' && ch <= 'Z' && !kbCaps) ch = ch - 'A' + 'a';
      char label[2] = {ch, 0};
      int16_t bx, by; uint16_t bw, bh;
      tft.getTextBounds(label, 0, 0, &bx, &by, &bw, &bh);
      tft.setCursor(x + (KB_KEY_W - bw) / 2, y + (KB_KEY_H - bh) / 2);
      tft.print(label);
    }
  }

  tft.fillRoundRect(KEY_BACK_X, KEY_BACK_Y, KEY_BACK_W, KEY_BACK_H, 3, C_DANGER);
  tft.setTextSize(1); tft.setTextColor(C_SURFACE);
  tft.setCursor(KEY_BACK_X + 8, KEY_BACK_Y + 8); tft.print("< DEL");

  tft.fillRoundRect(KEY_CAPS_X, KEY_CAPS_Y, KEY_CAPS_W, KEY_CAPS_H, 3,
                    kbCaps ? C_ACCENT : C_SURFACE2);
  tft.drawRoundRect(KEY_CAPS_X, KEY_CAPS_Y, KEY_CAPS_W, KEY_CAPS_H, 3,
                    kbCaps ? C_ACCENT_LO : C_LINE);
  tft.setTextColor(kbCaps ? C_ON_ACCENT : C_INK_MUTED);
  tft.setCursor(KEY_CAPS_X + 6, KEY_CAPS_Y + 8); tft.print(kbCaps ? "CAPS ON" : "CAPS off");

  tft.fillRoundRect(KEY_DONE_X, KEY_DONE_Y, KEY_DONE_W, KEY_DONE_H, 3, C_POSITIVE);
  tft.setTextColor(C_SURFACE);
  tft.setCursor(KEY_DONE_X + 34, KEY_DONE_Y + 8); tft.print("DONE");
}

void drawInputLine(const String &val, bool isPassword) {
  tft.fillRect(0, 56, SCR_W, 28, C_SURFACE);
  tft.drawRect(0, 56, SCR_W, 28, C_LINE);
  tft.setTextSize(2);
  tft.setTextColor(C_INK);
  String display = val;
  if (isPassword) {
    display = "";
    for (size_t i = 0; i < val.length(); i++) display += '*';
  }
  if (display.length() > 19) display = display.substring(display.length() - 19);
  tft.setCursor(8, 63);
  tft.print(display);
  int cx = 8 + display.length() * 12;
  if (cx < SCR_W - 10) {
    tft.setTextColor(C_ACCENT_TEXT);
    tft.setCursor(cx, 63);
    tft.print('_');
  }
}

String promptText(const char *title, const char *fieldLabel, const String &initialVal,
                  bool isPassword, int maxLen) {
  String val = initialVal;

  tft.fillScreen(C_CANVAS);
  tft.fillRect(0, 0, SCR_W, 30, C_ACCENT);
  tft.setTextSize(2); tft.setTextColor(C_ON_ACCENT);
  tft.setCursor(8, 8); tft.print(title);

  tft.setTextSize(1); tft.setTextColor(C_INK_MUTED);
  tft.setCursor(8, 38); tft.print(fieldLabel);

  drawInputLine(val, isPassword);
  drawKeyboard(fieldLabel);

  while (true) {
    int sx, sy;
    if (!waitTap(sx, sy)) continue;

    if (sx >= KEY_DONE_X && sx < KEY_DONE_X + KEY_DONE_W &&
        sy >= KEY_DONE_Y && sy < KEY_DONE_Y + KEY_DONE_H) {
      return val;
    }
    if (sx >= KEY_BACK_X && sx < KEY_BACK_X + KEY_BACK_W &&
        sy >= KEY_BACK_Y && sy < KEY_BACK_Y + KEY_BACK_H) {
      if (val.length() > 0) val.remove(val.length() - 1);
      drawInputLine(val, isPassword);
      continue;
    }
    if (sx >= KEY_CAPS_X && sx < KEY_CAPS_X + KEY_CAPS_W &&
        sy >= KEY_CAPS_Y && sy < KEY_CAPS_Y + KEY_CAPS_H) {
      kbCaps = !kbCaps;
      drawKeyboard(fieldLabel);
      continue;
    }

    const char *rows[KB_ROWS] = {KB_ROW0, KB_ROW1, KB_ROW2, KB_ROW3};
    for (int r = 0; r < KB_ROWS; r++) {
      for (int c = 0; c < KB_COLS; c++) {
        int kx = KB_X0 + c * (KB_KEY_W + KB_GAP);
        int ky = KB_Y0 + r * (KB_KEY_H + KB_GAP);
        if (sx >= kx && sx < kx + KB_KEY_W && sy >= ky && sy < ky + KB_KEY_H) {
          char ch = rows[r][c];
          if (r > 0 && ch >= 'A' && ch <= 'Z' && !kbCaps) ch = ch - 'A' + 'a';
          if ((int)val.length() < maxLen) val += ch;
          drawInputLine(val, isPassword);
        }
      }
    }
  }
}

// ── WiFi network picker ───────────────────────────────────────────────────────

#define NET_ROWS    5
#define NET_ROW_H   34
#define NET_Y0      38

String pickSSID() {
  tft.fillScreen(C_CANVAS);
  tft.fillRect(0, 0, SCR_W, 34, C_ACCENT);
  tft.setTextSize(2); tft.setTextColor(C_ON_ACCENT);
  tft.setCursor(8, 10); tft.print("Select Network");

  tft.setTextSize(1); tft.setTextColor(C_INK_MUTED);
  tft.setCursor(10, NET_Y0); tft.print("Scanning...");

  int found = WiFi.scanNetworks();
  if (found <= 0) {
    tft.fillRect(0, NET_Y0, SCR_W, 20, C_CANVAS);
    tft.setCursor(10, NET_Y0);
    tft.setTextColor(C_DANGER);
    tft.print("No networks found.");
    delay(2000);
    return cfgSSID;
  }

  int scroll = 0;
  auto drawList = [&]() {
    tft.fillRect(0, NET_Y0, SCR_W, SCR_H - NET_Y0, C_CANVAS);
    int rows = min(found - scroll, NET_ROWS);
    for (int i = 0; i < rows; i++) {
      int idx = scroll + i;
      int y = NET_Y0 + i * NET_ROW_H;
      tft.fillRoundRect(4, y, SCR_W - 8, NET_ROW_H - 3, 4, (i & 1) ? C_SURFACE2 : C_SURFACE);
      tft.drawRoundRect(4, y, SCR_W - 8, NET_ROW_H - 3, 4, C_LINE);
      tft.setTextSize(2); tft.setTextColor(C_INK);
      tft.setCursor(12, y + 8);
      String ssid = WiFi.SSID(idx);
      if (ssid.length() > 14) ssid = ssid.substring(0, 13) + ".";
      tft.print(ssid);
      int rssi = WiFi.RSSI(idx);
      int bars = map(constrain(rssi, -90, -40), -90, -40, 1, 5);
      for (int b = 0; b < 5; b++) {
        uint16_t c = (b < bars) ? C_ACCENT_LO : C_SURFACE3;
        tft.fillRect(SCR_W - 56 + b * 8, y + NET_ROW_H - 12 - b * 2, 6, 2 + b * 2, c);
      }
      tft.setTextSize(1); tft.setTextColor(C_INK_FAINT);
      tft.setCursor(SCR_W - 56, y + 6);
      tft.print(WiFi.encryptionType(idx) == WIFI_AUTH_OPEN ? "open" : "lock");
    }
    if (scroll + NET_ROWS < found) {
      tft.setTextSize(1); tft.setTextColor(C_INK_FAINT);
      tft.setCursor(SCR_W - 66, SCR_H - 12);
      tft.print("tap below v");
    }
  };

  drawList();

  while (true) {
    int sx, sy;
    if (!waitTap(sx, sy)) continue;

    if (sy >= NET_Y0 && sy < NET_Y0 + NET_ROWS * NET_ROW_H) {
      int row = (sy - NET_Y0) / NET_ROW_H;
      int idx = scroll + row;
      if (idx < found) return WiFi.SSID(idx);
    }
    if (sy >= NET_Y0 + NET_ROWS * NET_ROW_H) {
      if (scroll + NET_ROWS < found) { scroll++; drawList(); }
    }
    if (sy < NET_Y0 && sy >= 34) {
      if (scroll > 0) { scroll--; drawList(); }
    }
  }
}

// ── Setup wizard ──────────────────────────────────────────────────────────────

void runSetupWizard() {
  kbCaps = true;

  WiFi.mode(WIFI_STA);
  cfgSSID = pickSSID();

  String pwLabel = String("Enter password for: ") + cfgSSID;
  cfgPassword = promptText("WiFi Password", pwLabel.c_str(), cfgPassword, true, 63);

  String cid = promptText("Camp ID", "Enter 5-letter camp code:", cfgCampID, false, 20);
  cid.trim();
  cid.toUpperCase();
  cfgCampID = cid;

  saveSettings();

  tft.fillScreen(C_CANVAS);
  tft.fillRect(0, 0, SCR_W, 34, C_POSITIVE);
  tft.setTextSize(2); tft.setTextColor(C_SURFACE);
  tft.setCursor(8, 10); tft.print("Settings Saved!");
  tft.setTextSize(1); tft.setTextColor(C_INK);
  tft.setCursor(10, 50); tft.print("Network : " + cfgSSID);
  tft.setCursor(10, 68); tft.print("Camp    : " + cfgCampID);
  tft.setCursor(10, 100); tft.setTextColor(C_INK_MUTED); tft.print("Restarting...");
  delay(2000);
  ESP.restart();
}

// ── Rendering ─────────────────────────────────────────────────────────────────

#define GEAR_X  (SCR_W - 26)
#define GEAR_Y  6
#define GEAR_W  22
#define GEAR_H  22

void drawGear() {
  int cx = GEAR_X + GEAR_W / 2, cy = GEAR_Y + GEAR_H / 2;
  tft.fillCircle(cx, cy, 8, C_INK_MUTED);
  tft.fillCircle(cx, cy, 4, C_CANVAS);
  tft.fillRect(cx - 2, GEAR_Y,              4, 4, C_INK_MUTED);
  tft.fillRect(cx - 2, GEAR_Y + GEAR_H - 4, 4, 4, C_INK_MUTED);
  tft.fillRect(GEAR_X,              cy - 2, 4, 4, C_INK_MUTED);
  tft.fillRect(GEAR_X + GEAR_W - 4, cy - 2, 4, 4, C_INK_MUTED);
}

void drawHeader() {
  tft.fillRect(0, 0, SCR_W, HEADER_H, C_CANVAS);

  tft.setTextSize(1);
  tft.setTextColor(C_INK_FAINT);
  tft.setCursor(8, 5);
  tft.print("STANDINGS");

  tft.setTextSize(2);
  tft.setTextColor(C_INK);
  tft.setCursor(8, 18);
  // Truncate camp name so it doesn't collide with the status text
  String title = campName.length() ? campName : cfgCampID;
  if (title.length() > 12) title = title.substring(0, 12);
  tft.print(title);

  if (todayIsDouble()) {
    tft.fillRoundRect(160, 17, 26, 15, 4, C_SPECIAL);
    tft.setTextSize(1);
    tft.setTextColor(C_SURFACE);
    tft.setCursor(167, 21);
    tft.print("2x");
  }

  tft.setTextSize(1);
  tft.setTextColor(C_INK_MUTED);
  tft.setCursor(SCR_W - 96, 8);
  tft.print("Camp ");
  tft.print(cfgCampID);
  tft.setTextColor(WiFi.isConnected() ? C_INK_MUTED : C_DANGER);
  tft.setCursor(SCR_W - 96, 22);
  tft.print(WiFi.isConnected() ? "WiFi OK" : "No WiFi");

  drawGear();
  tft.drawFastHLine(0, HEADER_H - 1, SCR_W, C_LINE);
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

// One leaderboard row, mirroring the app's ScoreboardView: rank, name, total,
// and a rounded progress bar in the team's colour scaled to the leader.
void drawRow(int row, int rank, const Team &t, long maxScore) {
  int y = ROW_TOP + row * ROW_H;
  tft.fillRect(0, y, SCR_W, ROW_H, C_CANVAS);

  // Rank — leader gets the accent, the rest fade back
  tft.setTextSize(2);
  uint16_t rankCol = (rank == 1) ? C_ACCENT_TEXT : (rank <= 3 ? C_INK_MUTED : C_INK_FAINT);
  tft.setTextColor(rankCol);
  tft.setCursor(6, y + 3);
  tft.print(rank);

  // Score (right-aligned), measured first so the name knows its room
  String sc = String(t.score);
  int16_t bx, by; uint16_t bw, bh;
  tft.getTextBounds(sc.c_str(), 0, 0, &bx, &by, &bw, &bh);

  int nameX = 40;
  int nameMaxW = SCR_W - nameX - bw - 14;
  tft.setTextColor(C_INK);
  tft.setCursor(nameX, y + 3);
  tft.print(fitName(t.name, nameMaxW));

  tft.setCursor(SCR_W - 8 - bw, y + 3);
  tft.print(sc);

  // Progress bar in the team's colour on a surface2 track
  int barX = nameX, barW = SCR_W - barX - 8, barH = 7;
  int barY = y + 22;
  tft.fillRoundRect(barX, barY, barW, barH, 3, C_SURFACE2);
  long span = maxScore > 0 ? maxScore : 1;
  long val  = t.score > 0 ? t.score : 0;
  int  w    = (int)((int64_t)barW * val / span);
  if (w < 10) w = 10;   // minimum sliver, like the app's 3% floor
  tft.fillRoundRect(barX, barY, w, barH, 3, t.color);
}

void redrawScoreboard() {
  tft.fillScreen(C_CANVAS);
  drawHeader();
  if (teamCount == 0) {
    tft.setTextSize(2);
    tft.setTextColor(C_INK_FAINT);
    tft.setCursor(20, SCR_H / 2 - 8);
    tft.print("No teams yet");
    return;
  }
  long maxScore = teams[0].score;   // sorted highest-first
  int rows = min(teamCount, VISIBLE_ROWS);
  for (int i = 0; i < rows; i++)
    drawRow(i, i + 1, teams[i], maxScore);
}

void splash(const char *msg) {
  tft.fillScreen(C_CANVAS);
  tft.setTextColor(C_INK);
  tft.setTextSize(2);
  tft.setCursor(20, SCR_H / 2 - 8);
  tft.print(msg);
}

// ── WiFi ──────────────────────────────────────────────────────────────────────
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(cfgSSID.c_str(), cfgPassword.c_str());
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
  SPI.begin();
  tft.begin();
  tft.setRotation(1);   // landscape
  ts.begin();
  ts.setRotation(3);

  // TZ must be set before any localtime_r so double-point-day keys are right
  // even before NTP syncs — transaction timestamps are absolute epochs.
  setenv("TZ", TIME_ZONE, 1);
  tzset();

  loadSettings();

  if (!settingsComplete()) {
    splash("Setup starting...");
    delay(1000);
    runSetupWizard();   // restarts the board when done
  }

  splash("Connecting WiFi...");
  connectWiFi();

  // Firestore's cert is not validated (the data is public, read-only). To
  // harden, replace with secureClient.setCACert(...) using the GTS root R1/R4.
  secureClient.setInsecure();

  configTzTime(TIME_ZONE, "pool.ntp.org");   // clock for the "2x today" badge

  splash("Loading camp...");
  fetchAll();
  redrawScoreboard();
  lastSig   = buildSignature();
  firstDraw = false;
}

void loop() {
  // Gear tap → re-run the setup wizard
  if (ts.touched()) {
    int sx, sy;
    if (getTouchPoint(sx, sy)) {
      if (sx >= GEAR_X - 4 && sy < GEAR_Y + GEAR_H + 4) {
        delay(60);
        while (ts.touched()) delay(10);
        runSetupWizard();
      }
    }
  }

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
