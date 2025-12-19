# DRISTI CCTV System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      DRISTI v2.0 System                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                      USER INTERFACE (Frontend)                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  [Connect with CCTV]        DRISTI - Lost Person Detection │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │  CCTV Preview       │  │  CCTV Preview       │             │
│  │  [Video Stream]     │  │  [Video Stream]     │             │
│  └──────────────────────┘  └──────────────────────┘             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Upload Lost Person Photo                        │  │
│  │  [Upload Area] → [Preview] → [Search Button]           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Results Display                             │  │
│  │  [Match 1] [Match 2] [Match 3] ... [Match N]            │  │
│  │  92% | Main Entrance | 00:41   92% | Lobby | 01:23      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

                           ↓↑ API Calls

┌──────────────────────────────────────────────────────────────────┐
│              BACKEND API (FastAPI)                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POST /api/search                                              │
│  ├─ Receive uploaded photo                                    │
│  ├─ Get connected cameras from localStorage                   │
│  ├─ Trigger capture from all cameras                          │
│  └─ Call search_service.search_in_videos()                    │
│                                                                  │
│  GET /api/search-results/{search_id}                          │
│  └─ Return JSON results with matches                          │
│                                                                  │
│  POST /api/cctv/config                                        │
│  └─ Save camera configuration                                │
│                                                                  │
│  GET /api/cctv/config                                         │
│  └─ Retrieve camera configuration                            │
│                                                                  │
│  GET /api/cameras                                             │
│  └─ List all available cameras (local + RTSP)                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

                           ↓↑ Processing

┌──────────────────────────────────────────────────────────────────┐
│           SEARCH SERVICE (search_service.py)                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  search_in_videos()                                            │
│  ├─ Process all video files                                   │
│  ├─ For each video:                                           │
│  │  ├─ Load video file                                        │
│  │  ├─ Extract frames                                         │
│  │  ├─ Detect faces (MediaPipe)                              │
│  │  ├─ Generate embeddings (ResNet)                          │
│  │  └─ Compare with uploaded photo                           │
│  └─ Save results to JSON                                      │
│                                                                  │
│  capture_rtsp_footage()                                        │
│  ├─ Connect to RTSP stream                                    │
│  ├─ Capture exactly 15 seconds                                │
│  ├─ Save to MP4 file                                          │
│  └─ Return path for processing                                │
│                                                                  │
│  test_rtsp_connection()                                        │
│  └─ Verify RTSP stream accessibility                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

                           ↓↑ Data Flow

┌──────────────────────────────────────────────────────────────────┐
│              DATA STORAGE & MANAGEMENT                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Browser Storage (localStorage):                               │
│  ├─ connectedCameras: [ {...}, {...}, ... ]                   │
│  └─ activeCCTVConfig: "true"                                  │
│                                                                  │
│  Local File System:                                            │
│  ├─ CCTVS/: Pre-recorded video files (.mp4)                   │
│  ├─ uploads/: Uploaded photos                                 │
│  ├─ results/: Search results (JSON + snapshots)               │
│  ├─ cctv_config.json: Camera configurations                   │
│  └─ temp_captures/: Temporary RTSP captures                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

                           ↓↑ Connections

┌──────────────────────────────────────────────────────────────────┐
│         EXTERNAL CONNECTIONS (CCTV Systems)                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  IP CCTV Camera 1 (RTSP)                                       │
│  ├─ IP: 192.168.1.100                                         │
│  ├─ Port: 554                                                 │
│  └─ Stream: /Streaming/Channels/101                           │
│                                                                  │
│  IP CCTV Camera 2 (RTSP)                                       │
│  ├─ IP: 192.168.1.101                                         │
│  ├─ Port: 554                                                 │
│  └─ Stream: /stream/main                                      │
│                                                                  │
│  IP CCTV Camera 3 (RTSP)                                       │
│  └─ [Similar configuration...]                                │
│                                                                  │
│  IP CCTV Camera N (RTSP)                                       │
│  └─ [Similar configuration...]                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### Search Process Flow

```
┌─────────────┐
│  User       │
│  Uploads    │
│  Photo      │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│  Frontend        │
│  POST /api/search│
└──────┬───────────┘
       │
       ▼
┌──────────────────────────────┐
│  Backend Receives Photo      │
│  Generate search_id          │
│  Store in uploads/           │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  Get Connected Cameras           │
│  from localStorage               │
│  • Camera 1 RTSP URL             │
│  • Camera 2 RTSP URL             │
│  • Camera 3 RTSP URL             │
│  • Camera 4 RTSP URL             │
└──────┬─────────────────────────────┘
       │
       ├─────────────────────────────────┐
       │                                 │
       ▼ (Parallel for each camera)      │
┌────────────────────────────────┐      │
│  For Each Camera:              │      │
├────────────────────────────────┤      │
│  1. Connect to RTSP stream     │      │
│  2. Capture 15 seconds video   │      │
│  3. Save to temp MP4 file      │      │
│  4. Process with face detection│      │
│  5. Extract face embeddings    │      │
│  6. Compare with uploaded      │      │
│  7. Calculate confidence       │      │
│  8. Save snapshots             │      │
│  9. Return matches             │      │
└─────────┬──────────────────────┘      │
          │                            │
          └────────────────────────────┘
           (Wait for all to complete)
       │
       ▼
┌──────────────────────────────┐
│  Combine Results             │
│  • Sort by confidence        │
│  • Take top 20               │
│  • Add camera/location info  │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Save Results to JSON        │
│  results/search_*.json       │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Return Results to User      │
│  GET /api/search-results/    │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Display Results             │
│  • Confidence %              │
│  • Camera location           │
│  • Timestamp                 │
│  • Snapshot image            │
└──────────────────────────────┘
```

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      DRISTI System                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  PRESENTATION LAYER (Frontend)                        │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │  • index.html       - Main UI                         │ │
│  │  • script.js        - JavaScript logic                │ │
│  │  • style.css        - Styling                         │ │
│  │  • localStorage     - Client-side camera config       │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↕                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API LAYER (FastAPI)                                 │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │  • main.py          - API endpoints                   │ │
│  │  • CORS middleware  - Cross-origin requests           │ │
│  │  • Background tasks - Async processing                │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↕                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  BUSINESS LOGIC LAYER (Search Service)               │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │  • search_service.py - Main processing                │ │
│  │  • Face detection    - MediaPipe                      │ │
│  │  • Face matching     - ResNet embeddings              │ │
│  │  • RTSP capture      - Stream capture                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↕                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  DATA LAYER                                          │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │  • File Storage     - Videos, photos, results         │ │
│  │  • Config Storage   - cctv_config.json                │ │
│  │  • Temporary Files  - Captures, temp data             │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↕                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  EXTERNAL INTEGRATIONS                               │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │  • IP CCTV Cameras  - RTSP streams (Port 554)         │ │
│  │  • OpenCV           - Video processing                │ │
│  │  • MediaPipe        - Face detection                  │ │
│  │  • PyTorch          - Face embeddings                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## RTSP Capture Pipeline

```
Step 1: RTSP Connection
┌─────────────────────────────┐
│  RTSP URL                   │
│  rtsp://user:pass@IP:554    │
│  /Streaming/Channels/101    │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  OpenCV VideoCapture        │
│  cap = cv2.VideoCapture()   │
└────────────┬────────────────┘
             │
Step 2: Stream Initialization
             ▼
┌─────────────────────────────┐
│  Get Stream Properties      │
│  • FPS: 30                  │
│  • Width: 1920              │
│  • Height: 1080             │
│  • Duration: 15 seconds     │
│  • Max Frames: 450          │
└────────────┬────────────────┘
             │
Step 3: Video Writer Setup
             ▼
┌─────────────────────────────┐
│  Create MP4 Writer          │
│  Codec: mp4v                │
│  Output: temp_captures/     │
└────────────┬────────────────┘
             │
Step 4: Frame Capture Loop
             ▼
┌─────────────────────────────┐
│  For each frame (450 total):│
│  • Read frame from stream   │
│  • Validate frame           │
│  • Write to MP4 file        │
│  • Update counter           │
│  • Log progress             │
│                             │
│  Progress: Every 5 seconds  │
│  Example: "150/450 frames"  │
└────────────┬────────────────┘
             │
Step 5: Completion
             ▼
┌─────────────────────────────┐
│  Release Resources          │
│  • Close RTSP connection    │
│  • Close video writer       │
│  • Flush to disk            │
└────────────┬────────────────┘
             │
Step 6: Return Result
             ▼
┌─────────────────────────────┐
│  Saved Video File           │
│  CCTVS/rtsp_capture_        │
│  main_entrance_20251220.mp4 │
└─────────────────────────────┘
```

---

## Configuration Storage

```
Browser localStorage
│
├─ connectedCameras: [
│  {
│    "id": "camera_1702831200000",
│    "name": "Main Entrance",
│    "location": "Gate A",
│    "rtspUrl": "rtsp://admin:pass@192.168.1.100:554/Streaming/Channels/101",
│    "duration": 15,
│    "addedAt": "2025-12-20T10:00:00Z"
│  },
│  {
│    "id": "camera_1702831300000",
│    "name": "Lobby",
│    "location": "Reception",
│    "rtspUrl": "rtsp://admin:pass@192.168.1.101:554/stream/main",
│    "duration": 15,
│    "addedAt": "2025-12-20T10:01:00Z"
│  }
│ ]
│
└─ activeCCTVConfig: "true"

File System Storage
│
├─ CCTVS/
│  ├─ cctv1.mp4
│  ├─ cctv2.mp4
│  ├─ cctv3.mp4
│  └─ rtsp_capture_main_entrance_*.mp4
│
├─ uploads/
│  └─ lost_person_*.jpg
│
├─ results/
│  ├─ search_*.json
│  ├─ snapshot_*.jpg
│  └─ ...
│
└─ cctv_config.json
```

---

## Response Format

```json
{
  "success": true,
  "search_id": "search_1702831000.123456",
  "results": {
    "status": "success",
    "total_matches": 5,
    "matches": [
      {
        "camera": "main_entrance",
        "camera_name": "Main Entrance",
        "location": "Gate A",
        "confidence": 92.5,
        "frame_number": 1250,
        "time": 41.67,
        "time_formatted": "00:41",
        "snapshot": "snapshot_1234567890.jpg"
      },
      {
        "camera": "lobby",
        "camera_name": "Lobby",
        "location": "Reception",
        "confidence": 88.3,
        "frame_number": 890,
        "time": 29.67,
        "time_formatted": "00:29",
        "snapshot": "snapshot_1234567891.jpg"
      }
    ]
  }
}
```

---

## Performance Timeline

```
Timeline for Single Camera Search:

T+0s    Upload photo
        │
T+0-1s  │ Save file
        │
T+1-2s  │ Connect to RTSP
        │
T+2-17s │ Capture 15 seconds
        │
T+17-40s│ Face detection & matching
        │
T+40-50s│ Save results
        │
T+50s   Results available to user

Total: ~50 seconds per camera
For 4 cameras: ~200 seconds (3-4 minutes total)
```

---

## Security Model

```
┌──────────────────────────────────────────┐
│  Security Layers                        │
├──────────────────────────────────────────┤
│                                          │
│  Layer 1: Frontend Security             │
│  ├─ Credentials stored in localStorage  │
│  ├─ Only visible to logged-in user      │
│  └─ Not transmitted to server           │
│                                          │
│  Layer 2: Transport Security            │
│  ├─ HTTPS (recommended for production)  │
│  ├─ Encrypted credentials in transit    │
│  └─ SSL/TLS certificates                │
│                                          │
│  Layer 3: Backend Security              │
│  ├─ No credential storage               │
│  ├─ RTSP URLs passed at request time    │
│  └─ No database logging                 │
│                                          │
│  Layer 4: Network Security              │
│  ├─ Firewall for camera access          │
│  ├─ VPN for remote connections          │
│  ├─ Network isolation of cameras        │
│  └─ Port restrictions (554)             │
│                                          │
└──────────────────────────────────────────┘
```

---

**DRISTI v2.0 Architecture**  
**December 2025**
