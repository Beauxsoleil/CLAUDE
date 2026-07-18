# Camp Points — hardware scoreboard (ESP32 + ILI9341 + touch)

A physical, always-on leaderboard for one camp. It reads the same Cloud Firestore
database the [Camp Points web app](../../README.md) uses and shows a live, ranked
list of every team and their total — great for propping up at the dining hall or
the evening rally. The display is styled after the app's **Sandstone** (beige)
theme: warm sandstone canvas, dark ink text, and a colour bar per team scaled to
the leader, just like the app's cast-to-TV scoreboard.

## How it works

The web app stores **no per-team score**. Each team's total is the sum of that
camp's `transactions`. So this sketch:

1. looks up the camp by its 5-letter code (`camps/{code}`) for its display name,
2. lists the camp's `teams` (name + colour),
3. pages through the camp's `transactions`, adding each `points` value to the
   right team, and
4. draws the teams sorted highest-first, each with a progress bar in its app
   colour.

It reads Firestore directly over its **REST API** using only your project's Web
API key — the app's security rules allow anyone with the camp code to read a
camp's teams and transactions, so there is no login step. (This is why the old
`FirebaseESP32` / Realtime Database library is not used.)

> **Scores are raw sums.** This build intentionally ignores the app's
> "double point days," so on a 2× day the board will read lower than the app.

## On-screen setup (touch)

No credentials need to be compiled in. On first boot the board runs a touch
wizard: pick a WiFi network from a scan, type the password on an on-screen
keyboard, and enter the 5-letter camp code. Settings are stored in flash (NVS)
and survive reboots and re-flashes. **Tap the gear** in the top-right of the
scoreboard any time to run setup again.

If you prefer, you can pre-fill `WIFI_SSID_DEFAULT` / `WIFI_PASSWORD_DEFAULT` /
`CAMP_ID_DEFAULT` at the top of the sketch — values saved by the wizard always
win over these. Avoid committing real WiFi passwords to git.

## Hardware / wiring

ILI9341 SPI display with an XPT2046 touch controller, wired to an ESP32:

| TFT pin  | ESP32 |
|----------|-------|
| CS       | GPIO 5 |
| DC       | GPIO 4 |
| RST      | GPIO 16 |
| MOSI     | GPIO 23 (VSPI) |
| SCK      | GPIO 18 (VSPI) |
| MISO     | GPIO 19 |
| LED/BL   | 3V3 |
| VCC      | 3V3 |
| GND      | GND |
| T_CS     | GPIO 17 |
| T_IRQ    | GPIO 27 |
| T_DIN/T_DO/T_CLK | shared with MOSI/MISO/SCK |

If taps land offset from where you press, tweak `TS_MINX/MAXX/MINY/MAXY` near
the top of the sketch.

## Libraries

Install via **Arduino IDE → Library Manager**:

- **Adafruit GFX Library**
- **Adafruit ILI9341**
- **XPT2046_Touchscreen**
- **ArduinoJson** — **7.x** (the sketch uses the v7 `JsonDocument` API)

`WiFi`, `WiFiClientSecure`, `HTTPClient`, and `Preferences` come with the
**esp32** board package (Boards Manager → "esp32" by Espressif). Select an
ESP32 board before compiling.

## Configure

Edit the block at the top of `camp-scoreboard.ino`:

```cpp
#define FIREBASE_PROJECT_ID  "..."   // = the app's VITE_FIREBASE_PROJECT_ID
#define FIREBASE_API_KEY     "..."   // = the app's VITE_FIREBASE_API_KEY (Web API key)
```

Where to find each value:

- **`FIREBASE_PROJECT_ID` / `FIREBASE_API_KEY`** — Firebase console → ⚙ *Project
  settings* → *General* → *Your apps* → the Web app's SDK config (`projectId`
  and `apiKey`). These are the exact same values in the web app's `.env`
  (`VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_API_KEY`).
- **Camp code** — entered on-screen (or `CAMP_ID_DEFAULT`): open the app, go to
  the **Setup** tab, and use the 5-letter code shown there (e.g. `P9NCF`).

Optional tuning (also near the top): `POLL_MS` (refresh interval, default 5 s),
`VISIBLE_ROWS` (rows shown, default 6), `MAX_TEAMS`, `TX_PAGE_SIZE`, `MAX_TX`.

## Flash it

1. Open `camp-scoreboard.ino` in the Arduino IDE.
2. Select your ESP32 board and port.
3. Upload. Open Serial Monitor at **115200** to watch it connect and sync.
4. Follow the on-screen setup wizard on the display.

The screen shows the camp name + code and a WiFi indicator in the header, then a
ranked row per team (rank, name, total, colour bar). It refreshes every
`POLL_MS` and only redraws when something changed, so it stays flicker-free.

## Security note

`secureClient.setInsecure()` skips TLS certificate validation. That's fine here —
the data is public, read-only camp scores — but on an untrusted network a
man-in-the-middle could feed the display bad numbers. To harden it, replace that
call with `secureClient.setCACert(...)` using Google Trust Services' root
certificate (GTS Root R1/R4). The API key only scopes requests to your Firebase
project; it grants no more than the app's rules already allow (reading a camp's
teams and transactions by camp code).
