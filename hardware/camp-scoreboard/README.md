# Camp Points — hardware scoreboard (ESP32 + ILI9341)

A physical, always-on leaderboard for one camp. It reads the same Cloud Firestore
database the [Camp Points web app](../../README.md) uses and shows a live, ranked
list of every team and their total — great for propping up at the dining hall or
the evening rally.

![layout: red header with camp name + code, then ranked rows]

## How it works

The web app stores **no per-team score**. Each team's total is the sum of that
camp's `transactions`. So this sketch:

1. looks up the camp by its 5-letter code (`camps/{CAMP_ID}`),
2. lists the camp's `teams` (name + colour),
3. pages through the camp's `transactions`, adding each `points` value to the
   right team, and
4. draws the teams sorted highest-first, each in its app colour.

It reads Firestore directly over its **REST API** using only your project's Web
API key — the app's security rules allow anyone with the camp code to read a
camp's teams and transactions, so there is no login step. (This is why the old
`FirebaseESP32` / Realtime Database library is not used.)

> **Scores are raw sums.** This build intentionally ignores the app's
> "double point days," so on a 2× day the board will read lower than the app.

## Hardware / wiring

ILI9341 SPI display wired to an ESP32 (unchanged from the original sketch):

| TFT pin | ESP32 |
|--------|-------|
| CS     | GPIO 5 |
| DC     | GPIO 4 |
| RST    | GPIO 16 |
| MOSI   | GPIO 23 (VSPI) |
| SCK    | GPIO 18 (VSPI) |
| MISO   | GPIO 19 |
| LED/BL | 3V3 |
| VCC    | 3V3 |
| GND    | GND |

The touch controller (`TOUCH_CS`, GPIO 17) is not used.

## Libraries

Install via **Arduino IDE → Library Manager**:

- **Adafruit GFX Library**
- **Adafruit ILI9341**
- **ArduinoJson** — **7.x** (the sketch uses the v7 `JsonDocument` API)

`WiFi`, `WiFiClientSecure`, and `HTTPClient` come with the **esp32** board
package (Boards Manager → "esp32" by Espressif). Select an ESP32 board before
compiling.

You can remove `FirebaseESP32` if you had it installed — it is no longer used.

## Configure

Edit the block at the top of `camp-scoreboard.ino`:

```cpp
#define WIFI_SSID            "..."
#define WIFI_PASSWORD        "..."
#define FIREBASE_PROJECT_ID  "..."   // = the app's VITE_FIREBASE_PROJECT_ID
#define FIREBASE_API_KEY     "..."   // = the app's VITE_FIREBASE_API_KEY (Web API key)
#define CAMP_ID              "ABCDE" // the code on the app's Setup tab
```

Where to find each value:

- **`FIREBASE_PROJECT_ID` / `FIREBASE_API_KEY`** — Firebase console → ⚙ *Project
  settings* → *General* → *Your apps* → the Web app's SDK config (`projectId`
  and `apiKey`). These are the exact same values in the web app's `.env`
  (`VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_API_KEY`).
- **`CAMP_ID`** — open the app, go to the **Setup** tab, and use the 5-letter
  **camp code** shown there (uppercase, e.g. `P9NCF`).

Optional tuning (also near the top): `POLL_MS` (refresh interval, default 5 s),
`VISIBLE_ROWS` (rows shown, default 6), `MAX_TEAMS`, `TX_PAGE_SIZE`, `MAX_TX`.

## Flash it

1. Open `camp-scoreboard.ino` in the Arduino IDE.
2. Select your ESP32 board and port.
3. Upload. Open Serial Monitor at **115200** to watch it connect and sync.

The screen shows the camp name + code and a WiFi indicator in the header, then a
ranked row per team (rank, colour swatch, name, total). It refreshes every
`POLL_MS` and only redraws when something changed, so it stays flicker-free.

## Security note

`secureClient.setInsecure()` skips TLS certificate validation. That's fine here —
the data is public, read-only camp scores — but on an untrusted network a
man-in-the-middle could feed the display bad numbers. To harden it, replace that
call with `secureClient.setCACert(...)` using Google Trust Services' root
certificate (GTS Root R1/R4). The API key only scopes requests to your Firebase
project; it grants no more than the app's rules already allow (reading a camp's
teams and transactions by camp code).
