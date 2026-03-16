# 🎵 PlayMusic

CLI utility for searching and playing music from terminal.

## Features

- 🔍 **Search** - Find tracks on YouTube directly from terminal
- ▶️ **Playback** - Stream music with mpv player
- ⏸️ **Controls** - Play, pause, resume, stop, skip tracks
- 💾 **Caching** - Offline playback with local cache
- 📜 **History** - Track playback history
- 🎯 **Queue** - Build playlists and manage queue
- 🎨 **Colored Output** - Beautiful terminal UI

## Installation

### 1. System Dependencies

```bash
# Debian/Ubuntu/Parrot OS
sudo apt update
sudo apt install -y yt-dlp mpv ffmpeg

# Verify installation
yt-dlp --version
mpv --version
```

### 2. Install Node.js Dependencies

```bash
cd playmusic
npm install
```

### 3. Global Installation (Optional)

```bash
npm link
# or
sudo npm install -g
```

After linking, you can use `mplay` command from anywhere.

## Usage

### Basic Commands

```bash
# Search and play a track
mplay "never gonna give you up"
mplay "Queen - Bohemian Rhapsody"
mplay "кино - группа крови"  # Cyrillic support

# Control playback
mplay --stop      # Stop playback
mplay --next      # Next track
mplay --prev      # Previous track

# View status
mplay --status    # Current track info
mplay --history   # Playback history

# Cache management
mplay --clear-cache  # Clear all cached tracks

# Queue management
mplay -q "track name"  # Add to queue without playing

# Configure behavior
mplay --on-end next    # Auto-play next track
mplay --on-end loop    # Loop current track
mplay --on-end stop    # Stop after track (default)

# Help
mplay --help
mplay --version
```


## Configuration

Configuration is stored in `~/.playmusic/`:

- `config.json` - User settings
- `state.json` - Current playback state
- `history.json` - Playback history
- `queue.json` - Current queue
- `cache/` - Cached audio files

### Default Settings

```json
{
  "volume": 100,
  "onEnd": "stop",
  "cacheLimit": 100,
  "useCache": true,
  "autoSelect": true,
  "useColors": true
}
```

## Keyboard Shortcuts

When a track is playing, you can control mpv directly:

- `Space` - Toggle pause
- `q` - Quit player
- `9` / `0` - Volume down/up
- `←` / `→` - Seek backward/forward

## Troubleshooting

### "yt-dlp не установлен"

```bash
sudo apt install yt-dlp
```

### "mpv не установлен"

```bash
sudo apt install mpv
```


### Cache issues

```bash
# Clear cache
mplay --clear-cache

# Manual cleanup
rm -rf ~/.playmusic/cache
```

### Permission errors

```bash
# Fix permissions
chmod -R 755 ~/.playmusic
```

## Architecture

```
playmusic/
├── bin/mplay             # Executable entry point
├── src/
│   ├── cli.js            # CLI commands & argument parsing
│   ├── search.js         # YouTube search (yt-dlp)
│   ├── player.js         # Audio playback (mpv + IPC)
│   ├── queue.js          # Queue management
│   ├── history.js        # History tracking
│   ├── cache.js          # Cache system
│   ├── config.js         # Configuration constants
│   └── utils/
│       ├── logger.js     # Colored console output
│       └── validators.js # Input validation
├── tests/                # Unit tests
└── package.json
```

## Development

### Running from source

```bash
npm start -- "search query"
# or
node bin/mplay "search query"
```

### Running tests

```bash
npm test
```

## Tech Stack

- **Runtime:** Node.js 16+
- **CLI Framework:** Commander.js
- **Search:** yt-dlp
- **Player:** mpv with IPC
- **Styling:** Chalk

## License

ISC

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube download tool
- [mpv](https://mpv.io/) - Media player
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
