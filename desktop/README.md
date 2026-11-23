# Desktop app

The Expo web app in its own window, with direct badge printing to a Brother QL-820NWB.

Every screen is the web app itself, loaded from its address. This program adds one thing a browser cannot do: sending a badge straight to the printer over the network, with no print dialog and no driver.

## Run from source

```
python3 -m venv expo-env
source expo-env/bin/activate        # Windows: expo-env\Scripts\activate
pip install -r requirements.txt
python3 app.py
```

To point at a different app address: `EXPOAPP_URL=https://example.org python3 app.py`

## First use

1. Open **Printer** in the top bar.
2. Enter the printer's address (shown on the printer's screen under its network settings) and choose the roll that is loaded.
3. Press **Save and test print**.

Settings are saved on the computer, in `.expoapp/settings.json` in the user's home folder.

## Packaged apps

The **Desktop app** workflow on GitHub builds a macOS app and a Windows program on every change under `desktop/`. Download them from the workflow run's artifacts. They are unsigned, so macOS and Windows will warn on first launch.

## Files

| File | Purpose |
|---|---|
| `app.py` | The window, the saved settings, and the functions the web app can call |
| `printing.py` | Turns a badge image into a print job and sends it to the printer |

## Known limits

- The camera scanner may not work inside the desktop window on every system. Finding attendees by name, email or badge code works everywhere.
- The app loads the live web app, so it needs an internet connection.
- Supported rolls: DK-2205 (black) and DK-2251 (black and red), both 62mm continuous.
