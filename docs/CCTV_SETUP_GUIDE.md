# CCTV Integration Setup Guide

## Quick Start: 3 Simple Steps

### Step 1: Start the Application
```bash
python main.py
```
Server runs at `http://localhost:8000`

### Step 2: Click "Connect with CCTV" Button
- Located at top-right corner of the page
- Shows setup instructions and configuration form

### Step 3: Add Your Cameras
- Enter camera details (name, location, RTSP URL)
- Click "Save Configuration"
- System ready for live CCTV search!

---

## Finding Your Camera's RTSP URL

### For Different Camera Brands

#### Hikvision
1. Find camera IP on router or camera manual
2. Open `http://camera-ip` in browser
3. Login (default: admin/12345)
4. Go to: Settings → Network → Advanced Settings → Streaming
5. Copy RTSP URL from "RTSP" section

**Example RTSP URL:**
```
rtsp://admin:12345@192.168.1.100:554/Streaming/Channels/101
```

#### Dahua
1. Open `http://camera-ip:8080`
2. Login (default: admin/admin)
3. Go to: Settings → Network → Streaming
4. Find RTSP URL in stream configuration

**Example RTSP URL:**
```
rtsp://admin:admin@192.168.1.101:554/stream/main
```

#### Uniview
1. Open `http://camera-ip`
2. Go to: Network → Streaming
3. Look for "Stream URL" or "RTSP" option

**Example RTSP URL:**
```
rtsp://admin:password@192.168.1.102:554/stream/profile1
```

#### Axis
1. Open `http://camera-ip`
2. Go to: System Options → Streams
3. Find RTSP URL under selected stream

**Example RTSP URL:**
```
rtsp://admin:password@192.168.1.103/axis-media/media.amp
```

#### Reolink
1. Open `http://camera-ip`
2. Go to: Network → Advanced
3. Find RTSP port (default 554) and stream path

**Example RTSP URL:**
```
rtsp://admin:password@192.168.1.104:554/h264Preview_01_main
```

#### Generic IP Camera
1. Check camera manual for RTSP format
2. Default RTSP port: 554
3. Common stream paths: `/stream1`, `/live`, `/h264`

**Common Format:**
```
rtsp://username:password@camera-ip:554/stream1
```

---

## Step-by-Step Network Setup

### 1. Find Camera IP Address

**Method A: Router Admin Panel**
- Open browser: `192.168.1.1` (or your router address)
- Login with router credentials
- Look in "Connected Devices" or "DHCP Clients"
- Find device with camera name/model

**Method B: Camera Manual/Sticker**
- Check camera body for IP address sticker
- Usually printed on bottom or back

**Method C: IP Camera Discovery Tool**
- Download: Hikvision SADP, Dahua ConfigTool, etc.
- Run on same network
- Displays all cameras with IPs

### 2. Test Camera Connection

```bash
# Ping camera to verify network access
ping camera-ip
```

Expected response:
```
Reply from 192.168.1.100: bytes=32 time=5ms TTL=64
```

### 3. Access Camera Web Interface

1. Open browser
2. Go to: `http://camera-ip`
3. Login with credentials:
   - Default username: `admin`
   - Default password: `12345` or `admin`
   - (Check camera manual for correct defaults)

### 4. Navigate to Streaming Settings

Each brand has different menu structure:

- **Hikvision**: Settings → Network → Advanced Settings → Streaming
- **Dahua**: Settings → Network → Streaming
- **Uniview**: Network → Streaming
- **Axis**: System Options → Streams
- **Reolink**: Network → Advanced

### 5. Get RTSP URL

Look for sections labeled:
- "RTSP URL"
- "Stream URL"
- "RTSP Server"
- "Stream Configuration"

Copy the complete URL including:
- Protocol: `rtsp://`
- Username and password
- IP address and port
- Stream path

---

## Adding Camera to DRISTI

### Fill in the Form:

```
Camera Name:     Main Entrance
Location:        Gate A
RTSP URL:        rtsp://admin:12345@192.168.1.100:554/Streaming/Channels/101
Duration (sec):  15
Port:            554
```

### Button Actions:

1. **Test Connection** - Verifies RTSP access (optional)
2. **Add Camera** - Saves camera configuration
3. **Save Configuration** - Activates for searching

### Connected Cameras Section:

Shows all added cameras with:
- Camera name and location
- RTSP URL (hidden for security)
- Capture duration
- Delete option (X button)

---

## Troubleshooting

### "Cannot connect to RTSP stream"

**Check these:**
1. Camera is powered on and network connected
2. RTSP URL format is correct (no typos)
3. Username and password are correct
4. Port 554 is not blocked by firewall
5. Camera IP is reachable: `ping camera-ip`

**Solution:**
```bash
# Test RTSP connectivity using ffmpeg
ffplay rtsp://username:password@camera-ip:554/stream-path
```

### "Lost connection during capture"

**Possible causes:**
1. Network instability
2. Camera rebooted during capture
3. Firewall blocking connection
4. Camera disconnected

**Solution:**
- Restart camera
- Check network stability
- Increase capture duration tolerance
- Check firewall rules

### "Invalid RTSP URL format"

**Check URL structure:**
```
✅ Correct:  rtsp://admin:pass@192.168.1.100:554/stream1
❌ Wrong:    http://192.168.1.100/stream1
❌ Wrong:    rtsp://192.168.1.100 (no port/path)
```

### "No video in preview"

1. Verify RTSP URL is correct
2. Check camera is streaming
3. Test with: `ffplay rtsp://url`
4. Verify camera hasn't gone to sleep mode

---

## Multiple Cameras Setup

### Example Configuration with 4 Cameras:

```
Camera 1:
- Name: Main Entrance
- Location: Gate A
- RTSP: rtsp://admin:pass@192.168.1.100:554/Streaming/Channels/101

Camera 2:
- Name: Lobby
- Location: Reception
- RTSP: rtsp://admin:pass@192.168.1.101:554/stream/main

Camera 3:
- Name: Parking Area
- Location: Ground Floor
- RTSP: rtsp://admin:pass@192.168.1.102:554/stream/profile1

Camera 4:
- Name: Main Corridor
- Location: 2nd Floor
- RTSP: rtsp://admin:pass@192.168.1.103:554/h264Preview_01_main
```

### Search Process:
1. Upload person photo
2. Click "Search CCTV Footage"
3. System captures 15 seconds from EACH camera
4. Searches all captured footage
5. Shows all matches from all cameras with timestamps

---

## Security Best Practices

### Credential Management:

1. **Change Default Passwords**
   - Don't use `12345` or `admin/admin`
   - Set strong unique passwords

2. **RTSP URL Security**
   - Don't share RTSP URLs publicly
   - Credentials are embedded in URL
   - Treat as sensitive information

3. **Network Isolation**
   - Keep cameras on isolated network if possible
   - Use VPN/firewall for remote access
   - Don't expose RTSP port (554) to internet

4. **Local Storage**
   - DRISTI stores RTSP URLs in browser localStorage
   - Clear browser data to remove configurations
   - Credentials not saved on server

---

## Performance Optimization

### Capture Duration:
- **5-10 sec**: Quick searches, low resource usage
- **15 sec**: Balanced (default)
- **30+ sec**: Thorough search, higher resource usage

### Recommended Settings:
```
For quick searches:      10 seconds
For detailed searches:   15 seconds
For archive searches:    20-30 seconds
```

### System Resources:
- Minimum: 4GB RAM
- Recommended: 8GB RAM
- CPU: Dual-core minimum, quad-core recommended

---

## Testing Your Setup

### 1. Connection Test
```bash
ffplay rtsp://username:password@camera-ip:554/stream-path
```

Should show live video stream.

### 2. Web Interface Test
1. Enter RTSP URL in DRISTI
2. Click "Test Connection"
3. Should show confirmation

### 3. Full Search Test
1. Upload test photo
2. Select camera
3. Click "Search CCTV Footage"
4. Monitor console for capture progress
5. Check results

---

## Common RTSP URL Formats by Manufacturer

| Brand | Format | Port |
|-------|--------|------|
| Hikvision | `/Streaming/Channels/101` | 554 |
| Dahua | `/stream/main` | 554 |
| Uniview | `/stream/profile1` | 554 |
| Axis | `/axis-media/media.amp` | 554 |
| Reolink | `/h264Preview_01_main` | 554 |
| TP-Link | `/stream1` | 554 |
| Foscam | `/stream/video.h264` | 88 |
| Mobotix | `/live/users/current/live` | 8080 |

---

## Support Resources

### Useful Tools:
- **VLC Media Player**: Test RTSP URLs
- **ffplay**: Command-line RTSP player
- **Wireshark**: Network traffic analyzer
- **Router Admin Panel**: Find device IPs

### Documentation:
- Check camera manual for RTSP format
- Visit manufacturer's support site
- Search: "[Camera Model] RTSP URL"

---

**Last Updated**: December 2025
**DRISTI Version**: 2.0.0
