# DamnBruh Reference Source Code

The DamnBruh source code referenced in this analysis is available at:

**Repository:** https://github.com/enes3774/damnbruh

## How to Access

To examine the actual implementation code while working through the tasks:

```bash
# Clone the reference repository (not tracked in this repo)
git clone https://github.com/enes3774/damnbruh.git damnbruh_source

# Now you can reference the code in damnbruh_source/
```

## Key Files to Reference

### Game Engine
- `damnbruh_source/snake_game_engine.py` - Core physics implementation
- `damnbruh_source/snake_game_simulator.py` - Playable game simulator
- `damnbruh_source/game_config.py` - Game constants and configuration

### Protocol Documentation
- `damnbruh_source/PROTOCOL_ANALYSIS.md` - Complete protocol specification
- `damnbruh_source/QUICK_REFERENCE.md` - Protocol quick reference
- `damnbruh_source/CORRECT_PROTOCOL.md` - Protocol corrections

### WebSocket & Networking
- `damnbruh_source/websocket_capture_tool.py` - WebSocket traffic capture
- `damnbruh_source/realtime_websocket_capture.py` - Real-time capture
- `damnbruh_source/mitm_*.py` - Man-in-the-middle proxy tools

### Frontend Code
- `damnbruh_source/www.damnbruh.com/` - Next.js frontend chunks
- `damnbruh_source/auth.privy.io/` - Privy authentication UI

### Game Mechanics Documentation
- `damnbruh_source/GAME_INITIALIZATION.md` - Player spawning
- `damnbruh_source/SPAWN_MECHANICS.md` - Spawn system
- `damnbruh_source/FOOD_SYSTEM.md` - Food spawning and clusters
- `damnbruh_source/SEGMENT_ALGORITHM_EXPLAINED.md` - Segment calculation

### Training & AI
- `damnbruh_source/train_snake_ai.py` - AI training scripts
- `damnbruh_source/selenium_ai_bot.py` - Automated bot

## Note

The `damnbruh_source/` directory is excluded from git tracking (see `.gitignore`) because:
1. It's a large directory (33MB, 598 files)
2. It's reference material from another repository
3. It's not our original code

Clone it locally when you need to reference the implementation details.
