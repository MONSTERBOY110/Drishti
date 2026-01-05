document.addEventListener("DOMContentLoaded", () => {
        const uploadArea = document.getElementById('uploadArea');
        const photoInput = document.getElementById('photoInput');
        const previewSection = document.getElementById('previewSection');
        const previewImage = document.getElementById('previewImage');
        const loadingSection = document.getElementById('loadingSection');
        const resultsSection = document.getElementById('resultsSection');
        let selectedFile = null;

        // CCTV Preview Variables
        let cctvVideos = [
            'https://res.cloudinary.com/dzsodqdi4/video/upload/v1766172774/cctv1_rir0ud.mp4',
            'https://res.cloudinary.com/dzsodqdi4/video/upload/v1766172774/cctv2_n7wcvd.mp4',
            'https://res.cloudinary.com/dzsodqdi4/video/upload/v1766172773/cctv3_nl6z5p.mp4',
            'https://res.cloudinary.com/dzsodqdi4/video/upload/v1766172773/cctv4_tcxawb.mp4'
        ];
        let videoElements = [];
        let cctvPlaying = false;

        // Initialize CCTV preview
        function initializeCCTVPreview() {
            loadCCTVFeedList();
        }

        function loadCCTVFeedList() {
            const container = document.getElementById('cctvContainer');
            
            // Check if videos already loaded
            if (container.children.length > 0) return;

            // Create video container for each video
            cctvVideos.forEach((videoUrl, index) => {
                const videoContainer = document.createElement('div');
                videoContainer.className = 'cctv-video-container';
                
                const videoElement = document.createElement('video');
                videoElement.muted = true;
                videoElement.autoplay = true;
                videoElement.loop = true;
                videoElement.src = videoUrl;
                videoElement.style.objectFit = 'contain';
                
                videoContainer.appendChild(videoElement);
                container.appendChild(videoContainer);
                videoElements.push(videoElement);

                // Handle errors
                videoElement.addEventListener('error', (e) => {
                    console.log('Error loading video ' + (index + 1) + ':', e);
                });
            });

            cctvPlaying = true;
        }

        function toggleCCTVPlayback() {
            if (videoElements.length === 0) return;

            if (cctvPlaying) {
                videoElements.forEach(video => video.pause());
                cctvPlaying = false;
            } else {
                videoElements.forEach(video => {
                    video.play().catch(e => {
                        console.log('Could not autoplay video:', e);
                    });
                });
                cctvPlaying = true;
            }
        }

        function pauseCCTVPlayback() {
            videoElements.forEach(video => video.pause());
            cctvPlaying = false;
        }

        // Upload area click
        uploadArea.addEventListener('click', () => photoInput.click());

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        });

        // File input change
        photoInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });

        function handleFileSelect(file) {
            // Validate file
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file');
                return;
            }

            if (file.size > 10 * 1024 * 1024) {
                alert('File size must be less than 10MB');
                return;
            }

            selectedFile = file;

            // Show preview
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImage.src = e.target.result;
                previewSection.classList.add('show');
            };
            reader.readAsDataURL(file);
        }

        async function startSearch() {
            if (!selectedFile) {
                alert('Please select a photo first');
                return;
            }

            try {
                // Show loading
                previewSection.classList.remove('show');
                loadingSection.classList.add('show');
                resultsSection.classList.remove('show');

                // Prepare form data
                const formData = new FormData();
                formData.append('file', selectedFile);

                // Send request
                const BACKEND_URL = window.location.hostname === 'localhost' 
                    ? 'http://localhost:8000'
                    : 'https://drishtii.onrender.com';
                const response = await fetch("/api/search", {
                     method: "POST",
                    body: formData
                });

                const data = await response.json();

                if (!data.success) {
                    showError(data.message || 'Search failed');
                    loadingSection.classList.remove('show');
                    return;
                }

                const searchId = data.search_id;

                // Poll for results
                const maxAttempts = 120; // 2 minutes with 1 second intervals
                let attempts = 0;

                const pollResults = async () => {
                    try {
                        const resultsResponse = await fetch(`/api/search-results/${searchId}`);
                        const resultsData = await resultsResponse.json();

                        if (resultsResponse.ok && resultsData.results) {
                            loadingSection.classList.remove('show');
                            displayResults(resultsData.results);
                            resultsSection.classList.add('show');
                        } else if (attempts < maxAttempts) {
                            attempts++;
                            setTimeout(pollResults, 1000);
                        } else {
                            showError('Search timeout. Please try again.');
                            loadingSection.classList.remove('show');
                        }
                    } catch (error) {
                        if (attempts < maxAttempts) {
                            attempts++;
                            setTimeout(pollResults, 1000);
                        } else {
                            showError('Error retrieving results: ' + error.message);
                            loadingSection.classList.remove('show');
                        }
                    }
                };

                pollResults();

            } catch (error) {
                showError('Error: ' + error.message);
                loadingSection.classList.remove('show');
            }
        }

        function displayResults(results) {
            const errorDiv = document.getElementById('errorDiv');
            const noResultsDiv = document.getElementById('noResultsDiv');
            const summaryDiv = document.getElementById('summaryDiv');
            const matchesContainer = document.getElementById('matchesContainer');

            errorDiv.style.display = 'none';
            noResultsDiv.style.display = 'none';
            matchesContainer.innerHTML = '';

            if (results.status === 'error') {
                errorDiv.style.display = 'block';
                errorDiv.textContent = results.error || 'Search error';
                return;
            }

            let matches = results.matches || [];

            // Limit to top 20 results
            const topMatches = matches.slice(0, 20);

            if (topMatches.length === 0) {
                noResultsDiv.style.display = 'block';
                summaryDiv.style.display = 'none';
                return;
            }

            // Show summary with total matches info
            summaryDiv.style.display = 'block';
            document.getElementById('totalMatches').textContent = topMatches.length + (matches.length > 20 ? ` of ${matches.length}` : '');
            document.getElementById('bestConfidence').textContent = topMatches[0].confidence.toFixed(1) + '%';
            document.getElementById('camerasCount').textContent = new Set(topMatches.map(m => m.camera)).size;

            // Display top 20 matches
            topMatches.forEach((match, index) => {
                const card = document.createElement('div');
                card.className = 'match-card';
                card.innerHTML = `
                    <img src="/api/snapshot/${match.snapshot}" class="match-image" alt="Match snapshot" onerror="this.style.opacity='0.3'">
                    <div class="match-info">
                        <div class="match-camera"><i class="fas fa-camera"></i> ${match.camera_name}</div>
                        <div class="match-confidence">${match.confidence.toFixed(1)}% Match</div>
                        <div class="match-time"><i class="fas fa-clock"></i> ${match.time_formatted}</div>
                        <div class="match-frame">Frame: ${match.frame_number}</div>
                    </div>
                `;
                matchesContainer.appendChild(card);
            });
        }

        function showError(message) {
            const errorDiv = document.getElementById('errorDiv');
            errorDiv.style.display = 'block';
            errorDiv.textContent = message;
            resultsSection.classList.add('show');
        }

        function clearUpload() {
            selectedFile = null;
            photoInput.value = '';
            previewSection.classList.remove('show');
            previewImage.src = '';
        }

        function newSearch() {
            clearUpload();
            resultsSection.classList.remove('show');
            document.getElementById('errorDiv').style.display = 'none';
            document.getElementById('noResultsDiv').style.display = 'none';
            document.getElementById('summaryDiv').style.display = 'none';
            document.getElementById('matchesContainer').innerHTML = '';
            previewSection.classList.add('show');
        }

        // Initialize CCTV preview on page load
        window.addEventListener('load', () => {
            initializeCCTVPreview();
            loadConnectedCameras();
        });

        // CCTV Modal Management
        function showCCTVSetup() {
            document.getElementById('cctvSetupModal').style.display = 'block';
            loadConnectedCameras();
        }

        function closeCCTVSetup() {
            document.getElementById('cctvSetupModal').style.display = 'none';
        }

        // Close modal when clicking outside
        document.getElementById('cctvSetupModal')?.addEventListener('click', function(e) {
            if (e.target === this) {
                closeCCTVSetup();
            }
        });

        // Add Camera
        function addCamera(event) {
            event.preventDefault();

            const cameraName = document.getElementById('cameraName').value;
            const cameraLocation = document.getElementById('cameraLocation').value;
            const rtspUrl = document.getElementById('cctvRtspUrl').value;
            const duration = document.getElementById('captureDuration').value;

            if (!cameraName || !cameraLocation || !rtspUrl) {
                alert('Please fill in all fields');
                return;
            }

            // Save to localStorage
            let cameras = JSON.parse(localStorage.getItem('connectedCameras') || '[]');
            
            const newCamera = {
                id: 'camera_' + Date.now(),
                name: cameraName,
                location: cameraLocation,
                rtspUrl: rtspUrl,
                duration: parseInt(duration),
                addedAt: new Date().toISOString()
            };

            cameras.push(newCamera);
            localStorage.setItem('connectedCameras', JSON.stringify(cameras));

            // Reset form
            document.getElementById('addCameraForm').reset();
            document.getElementById('testConnectionResult').style.display = 'none';

            // Reload list
            loadConnectedCameras();

            alert('Camera added successfully! Note: RTSP connectivity will be tested during search.');
        }

        // Test CCTV Connection
        async function testCCTVConnection() {
            const rtspUrl = document.getElementById('cctvRtspUrl').value;
            
            if (!rtspUrl) {
                alert('Please enter RTSP URL first');
                return;
            }

            const resultDiv = document.getElementById('testConnectionResult');
            resultDiv.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; margin-right: 10px; display: inline-block;"></div>Testing connection...';
            resultDiv.style.display = 'block';
            resultDiv.style.background = 'rgba(0, 119, 182, 0.1)';

            try {
                // Note: Direct RTSP testing from browser is limited. This is a placeholder.
                // Real testing happens on the server side during capture.
                
                // For now, we'll show a message that testing happens during actual search
                setTimeout(() => {
                    resultDiv.innerHTML = '<i class="fas fa-info-circle"></i> Connection will be tested during search execution.';
                    resultDiv.style.background = 'rgba(0, 119, 182, 0.1)';
                    resultDiv.style.color = 'var(--bright-teal-blue)';
                }, 1000);

            } catch (error) {
                resultDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error: ' + error.message;
                resultDiv.style.background = 'rgba(255, 0, 0, 0.1)';
                resultDiv.style.color = 'red';
            }
        }

        // Load Connected Cameras
        function loadConnectedCameras() {
            const cameras = JSON.parse(localStorage.getItem('connectedCameras') || '[]');
            const listDiv = document.getElementById('connectedCamerasList');

            if (cameras.length === 0) {
                listDiv.innerHTML = '<p style="color: var(--ink-black); opacity: 0.6; grid-column: 1/-1;">No cameras connected yet</p>';
                return;
            }

            listDiv.innerHTML = cameras.map(camera => `
                <div style="background: var(--white); border: 1px solid var(--border-dark); border-radius: 8px; padding: 15px; position: relative;">
                    <button onclick="deleteCamera('${camera.id}')" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: red; cursor: pointer; font-size: 18px;">
                        <i class="fas fa-trash"></i>
                    </button>
                    <div style="margin-bottom: 8px;">
                        <strong style="color: var(--bright-teal-blue);">${camera.name}</strong>
                        <br>
                        <small style="color: var(--ink-black); opacity: 0.7;"><i class="fas fa-map-marker-alt"></i> ${camera.location}</small>
                    </div>
                    <div style="background: rgba(0, 0, 0, 0.05); padding: 8px; border-radius: 4px; margin-bottom: 8px; font-family: monospace; font-size: 11px; color: var(--ink-black); opacity: 0.7; word-break: break-all;">
                        ${camera.rtspUrl}
                    </div>
                    <small style="color: var(--ink-black); opacity: 0.6;">Capture: ${camera.duration}s</small>
                </div>
            `).join('');
        }

        // Delete Camera
        function deleteCamera(cameraId) {
            if (confirm('Delete this camera configuration?')) {
                let cameras = JSON.parse(localStorage.getItem('connectedCameras') || '[]');
                cameras = cameras.filter(c => c.id !== cameraId);
                localStorage.setItem('connectedCameras', JSON.stringify(cameras));
                loadConnectedCameras();
            }
        }

        // Save CCTV Config
        function saveCCTVConfig() {
            const cameras = JSON.parse(localStorage.getItem('connectedCameras') || '[]');
            
            if (cameras.length === 0) {
                alert('Please add at least one camera first');
                return;
            }

            // Store config as active
            localStorage.setItem('activeCCTVConfig', 'true');
            
            alert('CCTV configuration saved! You can now search using connected cameras.');
            closeCCTVSetup();
        }

        // Check if using live CCTV and modify search
        async function startSearchWithCCTV() {
            const cameras = JSON.parse(localStorage.getItem('connectedCameras') || '[]');
            const activeCCTV = localStorage.getItem('activeCCTVConfig') === 'true';

            if (activeCCTV && cameras.length > 0) {
                // Search will include live CCTV captures
                console.log('Searching with', cameras.length, 'connected CCTV cameras');
                // Add cameras info to the search request
                localStorage.setItem('searchCameras', JSON.stringify(cameras));
            }

            startSearch();
        }

        // Override original startSearch to use CCTV if available
        const originalStartSearch = startSearch;
        startSearch = async function() {
            const cameras = JSON.parse(localStorage.getItem('connectedCameras') || '[]');
            
            if (cameras.length > 0) {
                // Show info that we're using live CCTV
                console.log('Using', cameras.length, 'connected CCTV camera(s) for search');
                // Continue with original search which will capture from CCTV
            }
            
            return originalStartSearch.apply(this, arguments);
        };
});