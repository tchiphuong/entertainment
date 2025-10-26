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
    $scope.autoPlayNext =
        localStorage.getItem("autoPlayNext") === "true" || false; // Auto-play next episode setting
    $scope.isPanelHidden = false; // Theater mode toggle

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
                        // Check URL for server group preference
                        const params = new URLSearchParams(
                            window.location.search,
                        );
                        const serverGroup = params.get("group");

                        let targetEpisode = $scope.episodes[0]; // Default to first episode

                        // Find episode tab that matches server group from URL
                        if (serverGroup) {
                            const matchingEpisode = $scope.episodes.find(
                                (episode) =>
                                    episode.server_name === serverGroup,
                            );
                            if (matchingEpisode) {
                                targetEpisode = matchingEpisode;
                            }
                        }

                        $scope.setActiveEpisode(targetEpisode);
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
            const serverName = params.get("server");

            let currentEpisode = episode.server_data[0]; // Default to the first server

            // If we have URL parameters, try to find matching server
            if (episodeSlug) {
                // Try to find exact match with server name if provided
                if (serverName) {
                    // First try to find by episode slug (exact match)
                    let matchingServer = episode.server_data.find(
                        (server) => server.slug === episodeSlug,
                    );

                    // If not found by slug, try to find by server name (to preserve server when switching episodes)
                    if (!matchingServer) {
                        matchingServer = episode.server_data.find(
                            (server) => server.name === serverName,
                        );
                    }

                    if (matchingServer) {
                        currentEpisode = matchingServer;
                    }
                } else {
                    // Just find by episode slug in current group
                    const matchingServer = episode.server_data.find(
                        (server) => server.slug === episodeSlug,
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

    // Episode Navigation Functions
    $scope.getCurrentEpisodeIndex = function () {
        if (!$scope.activeEpisode || !$scope.currentEpisodeId) return -1;
        return $scope.activeEpisode.server_data.findIndex(
            (server) => server.slug === $scope.currentEpisodeId,
        );
    };

    $scope.canGoToPrevious = function () {
        return $scope.getCurrentEpisodeIndex() > 0;
    };

    $scope.canGoToNext = function () {
        const currentIndex = $scope.getCurrentEpisodeIndex();
        return (
            currentIndex >= 0 &&
            currentIndex < $scope.activeEpisode.server_data.length - 1
        );
    };

    $scope.previousEpisode = function () {
        if (!$scope.canGoToPrevious()) return;

        const currentIndex = $scope.getCurrentEpisodeIndex();
        const previousServer =
            $scope.activeEpisode.server_data[currentIndex - 1];
        $scope.openEpisode(previousServer);
    };

    $scope.nextEpisode = function () {
        if (!$scope.canGoToNext()) return;

        const currentIndex = $scope.getCurrentEpisodeIndex();
        const nextServer = $scope.activeEpisode.server_data[currentIndex + 1];
        $scope.openEpisode(nextServer);
    };

    // Watch autoPlayNext changes and save to localStorage
    $scope.$watch("autoPlayNext", function (newVal, oldVal) {
        if (newVal !== oldVal) {
            localStorage.setItem("autoPlayNext", newVal.toString());
        }
    });

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
                image: $scope.movie.thumb_url,
                stretching: "fill",
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
                    { key: "N", desc: "Tập tiếp theo" },
                    { key: "P", desc: "Tập trước" },
                    { key: "Shift+N", desc: "Tập trước" },
                    { key: "F", desc: "Toàn màn hình" },
                    { key: "0-9", desc: "Nhảy tới % video" },
                    { key: "?", desc: "Hiện phím tắt" },
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
                        case "n": // Next episode (Shift+N for previous)
                            e.preventDefault();
                            if (e.shiftKey) {
                                $scope.$apply(() => {
                                    if ($scope.canGoToPrevious()) {
                                        $scope.previousEpisode();
                                        tooltips.show("Chuyển tập trước");
                                    } else {
                                        tooltips.show("Đã ở tập đầu tiên");
                                    }
                                });
                            } else {
                                $scope.$apply(() => {
                                    if ($scope.canGoToNext()) {
                                        $scope.nextEpisode();
                                        tooltips.show("Chuyển tập tiếp theo");
                                    } else {
                                        tooltips.show("Đã ở tập cuối cùng");
                                    }
                                });
                            }
                            break;
                        case "p": // Previous episode
                            e.preventDefault();
                            $scope.$apply(() => {
                                if ($scope.canGoToPrevious()) {
                                    $scope.previousEpisode();
                                    tooltips.show("Chuyển tập trước");
                                } else {
                                    tooltips.show("Đã ở tập đầu tiên");
                                }
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
                    if ($scope.autoPlayNext && $scope.canGoToNext()) {
                        setTimeout(() => {
                            $scope.nextEpisode();
                        }, 1000); // Delay 1 second before auto-playing next episode
                    }
                });
            });
        } else {
            console.error("JW Player library is not loaded.");
            $scope.errorMessage = "Video player is unavailable.";
        }
    };

    // Play the next episode (legacy function - handles cross-tab navigation)
    $scope.playNextEpisodeAdvanced = function () {
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

        // Get current server info
        const currentServer = $scope.activeEpisode.server_data.find(
            (server) => server.slug === episodeSlug,
        );

        if (!currentServer) {
            console.error(
                "Cannot find current server for episode:",
                episodeSlug,
            );
            return;
        }

        const serverName = currentServer.name;
        const serverGroup = $scope.activeEpisode.server_name;

        // Simple display: just show what episode and which server group
        const episodeValue = `${serverName} (${serverGroup})`;

        if (existingHistoryIndex !== -1) {
            // Update the existing history entry
            history[existingHistoryIndex].timestamp = new Date();
            history[existingHistoryIndex].lastWatchedEpisode = {
                key: episodeSlug,
                value: episodeValue,
                serverName: serverName,
                serverGroup: serverGroup,
            };
        } else if ($scope.movie) {
            // Add a new history entry
            history.push({
                slug: $scope.movie.slug,
                name: $scope.movie.name,
                poster: $scope.movie.poster_url,
                lastWatchedEpisode: {
                    key: episodeSlug,
                    value: episodeValue,
                    serverName: serverName,
                    serverGroup: serverGroup,
                },
                timestamp: new Date(),
            });
        }

        // Save updated history to localStorage
        localStorage.setItem("viewHistory", JSON.stringify(history));
    };

    // Update setWatchlist to call saveWatchHistory
    $scope.setWatchlist = function (episodeSlug, position = null) {
        const lastWatchedList = $scope.getLastWatchedList();

        // Get current server
        const currentServer = $scope.activeEpisode.server_data.find(
            (server) => server.slug === episodeSlug,
        );

        // Find or create movie entry
        let movieData = lastWatchedList.find((item) => item.movieSlug === slug);
        if (!movieData) {
            movieData = {
                movieSlug: slug,
                lastWatched: {
                    episodeSlug: episodeSlug,
                    serverName: currentServer.name,
                    serverGroup: $scope.activeEpisode.server_name,
                },
                episodes: {},
            };
            lastWatchedList.push(movieData);
        } else {
            movieData.lastWatched = {
                episodeSlug: episodeSlug,
                serverName: currentServer.name,
                serverGroup: $scope.activeEpisode.server_name,
            };
        }

        // Save position with server info
        movieData.episodes[episodeSlug] = {
            position:
                position || movieData.episodes[episodeSlug]?.position || 0,
            timestamp: new Date().toISOString(),
            serverName: currentServer.name,
            serverGroup: $scope.activeEpisode.server_name,
        };

        localStorage.setItem(
            "lastWatchedEpisodes",
            JSON.stringify(lastWatchedList),
        );

        // Update URL with episode and server info only
        const params = new URLSearchParams(window.location.search);
        params.set("episode", episodeSlug);
        params.set("server", currentServer.name);
        window.history.replaceState({}, "", `?${params.toString()}`);

        $scope.saveWatchHistory(episodeSlug);
    };

    $scope.initializeFromUrl = function () {
        const params = new URLSearchParams(window.location.search);
        const episodeSlug = params.get("episode");
        const serverName = params.get("server");

        // Find episode by slug, prefer matching server name if provided
        if (episodeSlug && $scope.episodes.length > 0) {
            let foundServer = null;
            let fallbackServer = null;

            for (const episode of $scope.episodes) {
                for (const server of episode.server_data) {
                    if (server.slug === episodeSlug) {
                        if (!fallbackServer)
                            fallbackServer = { episode, server };

                        if (serverName && server.name === serverName) {
                            foundServer = { episode, server };
                            break;
                        }
                    }
                }
                if (foundServer) break;
            }

            const target = foundServer || fallbackServer;
            if (target) {
                $scope.setActiveEpisode(target.episode);
                $scope.openEpisode(target.server);
                return;
            }
        }

        // Default: first episode and first server
        if ($scope.episodes.length > 0) {
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
