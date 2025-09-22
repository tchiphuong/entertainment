const app = angular.module("iptvApp", []);

app.constant("CONFIG", {
    API_ENDPOINT: "https://phimapi.com/phim",
});

app.controller("PlayController", function ($scope, $http, CONFIG) {
    $scope.movie = null;
    $scope.episodes = [];
    $scope.activeEpisode = null;
    $scope.currentEpisodeId = null;
    $scope.errorMessage = null;
    $scope.activeTab = "dashboard"; // Default active tab
    $scope.isLoading = true; // Initialize with loading state

    // Extract slug from URL
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get("slug");

    // Helper function to retrieve the last watched episodes list
    $scope.getLastWatchedList = function () {
        return JSON.parse(localStorage.getItem("lastWatchedEpisodes")) || [];
    };

    // Fetch movie details
    $scope.fetchMovieDetails = function () {
        $scope.isLoading = true; // Show loading overlay
        const url = `${CONFIG.API_ENDPOINT}/${slug}`;
        return $http.get(url).then(
            function (response) {
                const data = response.data;
                if (data.status && data.movie) {
                    $scope.movie = data.movie;
                    console.log("Movie data:", $scope.movie);
                    $scope.episodes = data.episodes || [];
                    if ($scope.episodes.length > 0) {
                        $scope.setActiveEpisode($scope.episodes[0]); // Default to the first episode
                    } else {
                        $scope.errorMessage = "No episodes available.";
                    }
                } else {
                    $scope.errorMessage = "Failed to load movie details.";
                }
                $scope.isLoading = false; // Hide loading overlay
            },
            function (error) {
                console.error("Error fetching movie details:", error);
                $scope.errorMessage = "Failed to load movie details.";
                $scope.isLoading = false; // Hide loading overlay
            },
        );
    };

    // Set the active episode
    $scope.setActiveEpisode = function (episode) {
        $scope.isLoading = true; // Show loading overlay
        $scope.activeEpisode = episode;

        if (episode.server_data.length > 0) {
            const params = new URLSearchParams(window.location.search);
            const episodeSlug = params.get("episode");

            let currentEpisode = episode.server_data[0]; // Default to the first server

            // Prioritize the episode from the URL parameter
            if (episodeSlug) {
                const matchingServer = episode.server_data.find(
                    (server) => server.slug === episodeSlug,
                );
                if (matchingServer) {
                    currentEpisode = matchingServer;
                }
            } else {
                // Fallback to the last watched server if available
                const lastWatchedList = $scope.getLastWatchedList();
                const lastWatchedData = lastWatchedList.find(
                    (item) => item.movieSlug === slug,
                );

                if (lastWatchedData?.currentEpisode) {
                    const matchingServer = episode.server_data.find(
                        (server) =>
                            server.slug === lastWatchedData.currentEpisode,
                    );
                    if (matchingServer) {
                        currentEpisode = matchingServer;
                    }
                }
            }

            $scope.currentEpisodeId = currentEpisode.slug;
            $scope.initializePlayer(currentEpisode.link_m3u8);

            // Use setWatchlist to save the current episode
            $scope.setWatchlist(currentEpisode.slug);
        } else {
            $scope.errorMessage = "No servers available for this episode.";
        }
        $scope.isLoading = false; // Hide loading overlay
    };

    // Switch to a new tab and load the same episode number if available
    $scope.switchTab = function (newEpisode) {
        const currentSlug = $scope.currentEpisodeId;
        $scope.activeEpisode = newEpisode;

        // Find the server with the same slug in the new tab
        const matchingServer = newEpisode.server_data.find(
            (server) => server.slug === currentSlug,
        );

        if (matchingServer) {
            $scope.openEpisode(matchingServer);
        } else if (newEpisode.server_data.length > 0) {
            // Fallback to the first server if no match is found
            $scope.openEpisode(newEpisode.server_data[0]);
        } else {
            $scope.errorMessage = "No servers available for this episode.";
        }
    };

    // Initialize JW Player
    $scope.initializePlayer = function (file) {
        if (typeof jwplayer === "function") {
            // Add custom CSS to hide default rewind/forward buttons
            const customCSS = `
                .jw-display-icon-rewind, 
                .jw-display-icon-next,
                .jw-icon-rewind { 
                    display: none !important; 
                }
            `;
            const styleSheet = document.createElement("style");
            styleSheet.textContent = customCSS;
            document.head.appendChild(styleSheet);

            const player = jwplayer("player").setup({
                file: file,
                image: $scope.movie.poster_url,
                title: $scope.movie.name,
                width: "100%",
                aspectratio: "16:9",
                controls: true,
                autostart: true,
                displaytitle: true,
                rewind: false, // Disable default rewind
                nextUpDisplay: false, // Disable next up display
            });

            // Add tooltip utility
            const tooltips = {
                container: null,
                timeout: null,
                init() {
                    if (!this.container) {
                        this.container = document.createElement("div");
                        this.container.className = "shortcut-tooltip";
                        this.container.style.cssText = `
                            position: absolute;
                            top: 20px;
                            right: 20px;
                            background: rgba(28, 28, 28, 0.9);
                            color: white;
                            padding: 8px 12px;
                            border-radius: 4px;
                            z-index: 9999;
                            font-size: 14px;
                            transition: opacity 0.2s;
                            pointer-events: none;
                        `;
                        player.getContainer().appendChild(this.container);
                    }
                },
                show(text, duration = 700) {
                    this.init();
                    this.container.textContent = text;
                    this.container.style.opacity = "1";

                    clearTimeout(this.timeout);
                    this.timeout = setTimeout(() => {
                        this.container.style.opacity = "0";
                    }, duration);
                },
            };

            // Add theater mode button with updated icon
            const theaterModeIcon = `
                <svg xmlns="http://www.w3.org/2000/svg" height="0.875rem" fill="rgba(255, 255, 255, 0.8)" viewBox="0 0 512 512">
                    <path d="M64 64C28.7 64 0 92.7 0 128V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H64zm48 96H400c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H400c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H400c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16z"/>
                </svg>
            `;

            player.addButton(
                "data:image/svg+xml;base64," + btoa(theaterModeIcon),
                $scope.isPanelHidden
                    ? "Hiện danh sách tập"
                    : "Ẩn danh sách tập",
                function () {
                    $scope.$apply(() => {
                        $scope.isPanelHidden = !$scope.isPanelHidden;
                    });
                },
                "togglePanel",
            );

            // Add next episode button
            const nextEpisodeIcon = `
                <svg xmlns="http://www.w3.org/2000/svg" height="0.875rem" fill="rgba(255, 255, 255, 0.8)" viewBox="0 0 512 512">
                    <path d="M52.5 440.6c-9.5 7.9-22.8 9.7-34.1 4.4S0 428.4 0 416V96C0 83.6 7.2 72.3 18.4 67s24.5-3.6 34.1 4.4L224 214.3V256v41.7L52.5 440.6zM256 352V256 128 96c0-12.4 7.2-23.7 18.4-29s24.5-3.6 34.1 4.4l192 160c7.3 6.1 11.5 15.1 11.5 24.6s-4.2 18.5-11.5 24.6l-192 160c-9.5 7.9-22.8 9.7-34.1 4.4S256 428.4 256 416V352z"/>
                </svg>
            `;

            player.addButton(
                "data:image/svg+xml;base64," + btoa(nextEpisodeIcon),
                "Tập tiếp theo",
                function () {
                    $scope.$apply(() => {
                        $scope.playNextEpisode();
                    });
                },
                "nextEpisode",
            );

            // Add forward 10s button
            const forward10Icon = `
                <svg xmlns="http://www.w3.org/2000/svg" height="0.875rem" fill="rgba(255, 255, 255, 0.8)" viewBox="0 0 512 512">
                    <path d="M386.4 160H336c-17.7 0-32 14.3-32 32s14.3 32 32 32h128c17.7 0 32-14.3 32-32V64c0-17.7-14.3-32-32-32s-32 14.3-32 32v51.2L414.4 97.6c-87.5-87.5-229.3-87.5-316.8 0s-87.5 229.3 0 316.8s229.3 87.5 316.8 0c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0c-62.5 62.5-163.8 62.5-226.3 0s-62.5-163.8 0-226.3s163.8-62.5 226.3 0L386.4 160z"/>
                </svg>
            `;

            player.addButton(
                "data:image/svg+xml;base64," + btoa(forward10Icon),
                "Tua tới 10 giây",
                function () {
                    const currentTime = player.getPosition();
                    player.seek(currentTime + 10);
                },
                "forward10s",
            );

            // Add backward 10s button
            const backward10Icon = `
                <svg xmlns="http://www.w3.org/2000/svg" height="0.875rem" fill="rgba(255, 255, 255, 0.8)" viewBox="0 0 512 512">
                    <path d="M125.7 160H176c17.7 0 32 14.3 32 32s-14.3 32-32 32H48c-17.7 0-32-14.3-32-32V64c0-17.7 14.3-32 32-32s32 14.3 32 32v51.2L97.6 97.6c87.5-87.5 229.3-87.5 316.8 0s87.5 229.3 0 316.8s-229.3 87.5-316.8 0c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0c62.5 62.5 163.8 62.5 226.3 0s62.5-163.8 0-226.3s-163.8-62.5-226.3 0L125.7 160z"/>
                </svg>
            `;

            // Add backward 10s button
            player.addButton(
                "data:image/svg+xml;base64," + btoa(backward10Icon),
                "Tua lại 10 giây",
                function () {
                    const currentTime = player.getPosition();
                    player.seek(Math.max(0, currentTime - 10));
                },
                "backward10s",
            );

            // Restore playback position if available
            const lastWatchedList = $scope.getLastWatchedList();
            const movieData = lastWatchedList.find(
                (item) => item.movieSlug === slug,
            );
            const lastPosition =
                movieData?.episodes?.[$scope.currentEpisodeId]?.position || 0;

            player.on("ready", function () {
                // Define shortcuts list
                const shortcuts = [
                    { key: "Space/K", desc: "Phát/Dừng" },
                    { key: "J", desc: "Lùi 10 giây" },
                    { key: "L", desc: "Tới 10 giây" },
                    { key: "←", desc: "Lùi 5 giây" },
                    { key: "→", desc: "Tới 5 giây" },
                    { key: "↑", desc: "Tăng âm lượng" },
                    { key: "↓", desc: "Giảm âm lượng" },
                    { key: "M", desc: "Tắt/Bật tiếng" },
                    { key: "F", desc: "Toàn màn hình" },
                    { key: "0-9", desc: "Nhảy tới % video" },
                ];

                if (lastPosition > 0) {
                    console.log(
                        `Resuming playback from position: ${lastPosition}`,
                    );
                    player.seek(lastPosition);
                }

                // Add keyboard shortcuts
                document.addEventListener("keydown", function (e) {
                    // Chỉ xử lý khi không nhập text
                    if (
                        e.target.tagName === "INPUT" ||
                        e.target.tagName === "TEXTAREA"
                    ) {
                        return;
                    }

                    // Xử lý phím số 0-9
                    const num = parseInt(e.key);
                    if (!isNaN(num) && num >= 0 && num <= 9) {
                        e.preventDefault();
                        const duration = player.getDuration();
                        const seekPosition = (duration * num * 10) / 100; // Chuyển số thành phần trăm
                        player.seek(seekPosition);
                        tooltips.show(`Đã nhảy tới ${num}0%`);
                        return;
                    }

                    switch (e.key.toLowerCase()) {
                        case " ": // Space bar
                        case "k":
                            e.preventDefault();
                            if (player.getState() === "playing") {
                                player.pause();
                                tooltips.show("Đã dừng");
                            } else {
                                player.play();
                                tooltips.show("Đang phát");
                            }
                            break;
                        case "j": // Tua lùi 10s
                            e.preventDefault();
                            const currentTime1 = player.getPosition();
                            player.seek(Math.max(0, currentTime1 - 10));
                            tooltips.show("Tua lại 10s");
                            break;
                        case "l": // Tua tới 10s
                            e.preventDefault();
                            const currentTime2 = player.getPosition();
                            player.seek(currentTime2 + 10);
                            tooltips.show("Tua tới 10s");
                            break;
                        case "arrowleft": // Tua lùi 5s
                            e.preventDefault();
                            const currentTime3 = player.getPosition();
                            player.seek(Math.max(0, currentTime3 - 5));
                            tooltips.show("Tua lại 5s");
                            break;
                        case "arrowright": // Tua tới 5s
                            e.preventDefault();
                            const currentTime4 = player.getPosition();
                            player.seek(currentTime4 + 5);
                            tooltips.show("Tua tới 5s");
                            break;
                        case "f": // Fullscreen
                            e.preventDefault();
                            player.setFullscreen(!player.getFullscreen());
                            tooltips.show("Chế độ toàn màn hình");
                            break;
                        case "arrowup": // Tăng âm lượng 10%
                            e.preventDefault();
                            const newVolUp = Math.min(
                                100,
                                player.getVolume() + 10,
                            );
                            player.setVolume(newVolUp);
                            tooltips.show(`Âm lượng: ${newVolUp}%`);
                            break;
                        case "arrowdown": // Giảm âm lượng 10%
                            e.preventDefault();
                            const newVolDown = Math.max(
                                0,
                                player.getVolume() - 10,
                            );
                            player.setVolume(newVolDown);
                            tooltips.show(`Âm lượng: ${newVolDown}%`);
                            break;
                        case "m": // Tắt/bật tiếng
                            e.preventDefault();
                            player.setMute(!player.getMute());
                            if (player.getMute()) {
                                tooltips.show("Đã tắt tiếng");
                            } else {
                                tooltips.show(
                                    `Âm lượng: ${player.getVolume()}%`,
                                );
                            }
                            break;
                        case "n": // Next episode
                            e.preventDefault();
                            $scope.$apply(() => {
                                $scope.playNextEpisode();
                                tooltips.show("Chuyển tập tiếp theo");
                            });
                            break;
                        case "?": // Hiển thị bảng phím tắt
                            e.preventDefault();
                            alert(
                                shortcuts
                                    .map((s) => `${s.key}: ${s.desc}`)
                                    .join("\n"),
                            );
                            break;
                    }
                });
            });

            let lastSavedTime = 0;
            // Save playback position periodically
            player.on("time", function (event) {
                if (Math.floor(event.position) - lastSavedTime >= 0) {
                    lastSavedTime = Math.floor(event.position);

                    // Use setWatchlist to update the current episode's position
                    $scope.setWatchlist(
                        $scope.currentEpisodeId,
                        event.position,
                    );
                }
            });

            // Automatically play the next episode when the current one finishes
            player.on("complete", function () {
                $scope.$apply(function () {
                    $scope.playNextEpisode();
                });
            });
        } else {
            console.error("JW Player library is not loaded.");
            $scope.errorMessage = "Video player is unavailable.";
        }
    };

    // Play the next episode
    $scope.playNextEpisode = function () {
        const currentEpisodeIndex = $scope.activeEpisode.server_data.findIndex(
            (server) => server.slug === $scope.currentEpisodeId,
        );

        if (currentEpisodeIndex !== -1) {
            // Check if there is another server in the current episode
            if (
                currentEpisodeIndex + 1 <
                $scope.activeEpisode.server_data.length
            ) {
                $scope.openEpisode(
                    $scope.activeEpisode.server_data[currentEpisodeIndex + 1],
                );
            } else {
                // Move to the next episode if available
                const currentEpisodeIndexInList = $scope.episodes.findIndex(
                    (episode) => episode === $scope.activeEpisode,
                );

                if (currentEpisodeIndexInList + 1 < $scope.episodes.length) {
                    $scope.setActiveEpisode(
                        $scope.episodes[currentEpisodeIndexInList + 1],
                    );
                } else {
                    $scope.errorMessage = "No more episodes available.";
                }
            }
        }
    };

    // Load a specific server
    $scope.openEpisode = function (server) {
        $scope.currentEpisodeId = server.slug;
        $scope.initializePlayer(server.link_m3u8);

        // Update the page title
        document.title = `[${server.name}] - ${$scope.movie.name}`;

        // Use setWatchlist to save the current episode
        $scope.setWatchlist(server.slug);
    };

    // Save watch history
    $scope.saveWatchHistory = function (episodeSlug) {
        const history = JSON.parse(localStorage.getItem("viewHistory")) || [];
        const existingHistoryIndex = history.findIndex(
            (item) => item.slug === slug,
        );

        if (existingHistoryIndex !== -1) {
            // Update the existing history entry
            history[existingHistoryIndex].timestamp = new Date();
            history[existingHistoryIndex].lastWatchedEpisode = {
                key: episodeSlug,
                value: `Tập ${episodeSlug.split("-").pop()}`, // Example: Extract episode number from slug
            };
        } else if ($scope.movie) {
            // Add a new history entry
            history.push({
                slug: $scope.movie.slug,
                name: $scope.movie.name,
                poster: $scope.movie.poster_url,
                lastWatchedEpisode: {
                    key: episodeSlug,
                    value: `Tập ${episodeSlug.split("-").pop()}`,
                },
                timestamp: new Date(),
            });
        }

        // Save updated history to localStorage
        localStorage.setItem("viewHistory", JSON.stringify(history));
    };

    // Update setWatchlist to call saveWatchHistory
    $scope.setWatchlist = function (episodeSlug, position = null) {
        // Retrieve the last watched episodes list from localStorage
        const lastWatchedList = $scope.getLastWatchedList();

        // Find or create the movie entry
        let movieData = lastWatchedList.find((item) => item.movieSlug === slug);
        if (!movieData) {
            movieData = {
                movieSlug: slug,
                currentEpisode: episodeSlug,
                episodes: {},
            };
            lastWatchedList.push(movieData);
        }

        const lastPosition =
            movieData?.episodes?.[$scope.currentEpisodeId]?.position || 0;

        // Update the current episode and its details
        movieData.currentEpisode = episodeSlug;
        movieData.episodes[episodeSlug] = {
            position: position || lastPosition, // Save position if provided
            timestamp: new Date().toISOString(), // Optional: Add timestamp
        };

        // Save the updated list back to localStorage
        localStorage.setItem(
            "lastWatchedEpisodes",
            JSON.stringify(lastWatchedList),
        );

        // Update the URL with the current episode
        const params = new URLSearchParams(window.location.search);
        params.set("episode", episodeSlug);
        window.history.replaceState({}, "", `?${params.toString()}`);

        // Save to watch history
        $scope.saveWatchHistory(episodeSlug);
    };

    $scope.initializeFromUrl = function () {
        const params = new URLSearchParams(window.location.search);
        const episodeSlug = params.get("episode");

        if (episodeSlug) {
            // Find the episode and set it as active
            const matchingEpisode = $scope.episodes.find((episode) =>
                episode.server_data.some(
                    (server) => server.slug === episodeSlug,
                ),
            );

            if (matchingEpisode) {
                const matchingServer = matchingEpisode.server_data.find(
                    (server) => server.slug === episodeSlug,
                );
                if (matchingServer) {
                    $scope.setActiveEpisode(matchingEpisode);
                    $scope.openEpisode(matchingServer);
                    return; // Play the episode from the URL
                }
            } else {
                console.warn("Episode not found in the current data.");
            }
        }

        // Fallback to the first episode only if no `episode` parameter is present
        if (!episodeSlug && $scope.episodes.length > 0) {
            $scope.setActiveEpisode($scope.episodes[0]);
        }
    };

    // Delete watch history item
    $scope.deleteHistoryItem = function (slug) {
        const history = JSON.parse(localStorage.getItem("viewHistory")) || [];
        const newHistory = history.filter((item) => item.slug !== slug);
        localStorage.setItem("viewHistory", JSON.stringify(newHistory));
        $scope.history = newHistory;
    };

    // Initialize
    $scope.fetchMovieDetails().then(() => {
        $scope.initializeFromUrl(); // Initialize episode from URL
    });
});
