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
            const player = jwplayer("player").setup({
                file: file,
                image: $scope.movie.poster_url,
                title: $scope.movie.name,
                width: "100%",
                aspectratio: "16:9",
                controls: true,
                autostart: true,
            });

            // Add a custom "Theater Mode" button with a white SVG icon
            let isTheaterMode = false; // Track theater mode state
            const theaterModeIcon = `
                <!-- rectangle-list icon by Free Icons (https://free-icons.github.io/free-icons/) -->
                <svg xmlns="http://www.w3.org/2000/svg" height="1em" fill="white" viewBox="0 0 512 512">
                <path
                    d="M 56.888888888888886 99.55555555555556 Q 43.55555555555556 100.44444444444444 42.666666666666664 113.77777777777777 L 42.666666666666664 398.22222222222223 L 42.666666666666664 398.22222222222223 Q 43.55555555555556 411.55555555555554 56.888888888888886 412.44444444444446 L 455.1111111111111 412.44444444444446 L 455.1111111111111 412.44444444444446 Q 468.44444444444446 411.55555555555554 469.3333333333333 398.22222222222223 L 469.3333333333333 113.77777777777777 L 469.3333333333333 113.77777777777777 Q 468.44444444444446 100.44444444444444 455.1111111111111 99.55555555555556 L 56.888888888888886 99.55555555555556 L 56.888888888888886 99.55555555555556 Z M 0 113.77777777777777 Q 0.8888888888888888 89.77777777777777 16.88888888888889 73.77777777777777 L 16.88888888888889 73.77777777777777 L 16.88888888888889 73.77777777777777 Q 32.888888888888886 57.77777777777778 56.888888888888886 56.888888888888886 L 455.1111111111111 56.888888888888886 L 455.1111111111111 56.888888888888886 Q 479.1111111111111 57.77777777777778 495.1111111111111 73.77777777777777 Q 511.1111111111111 89.77777777777777 512 113.77777777777777 L 512 398.22222222222223 L 512 398.22222222222223 Q 511.1111111111111 422.22222222222223 495.1111111111111 438.22222222222223 Q 479.1111111111111 454.22222222222223 455.1111111111111 455.1111111111111 L 56.888888888888886 455.1111111111111 L 56.888888888888886 455.1111111111111 Q 32.888888888888886 454.22222222222223 16.88888888888889 438.22222222222223 Q 0.8888888888888888 422.22222222222223 0 398.22222222222223 L 0 113.77777777777777 L 0 113.77777777777777 Z M 85.33333333333333 170.66666666666666 Q 85.33333333333333 158.22222222222223 93.33333333333333 150.22222222222223 L 93.33333333333333 150.22222222222223 L 93.33333333333333 150.22222222222223 Q 101.33333333333333 142.22222222222223 113.77777777777777 142.22222222222223 Q 126.22222222222223 142.22222222222223 134.22222222222223 150.22222222222223 Q 142.22222222222223 158.22222222222223 142.22222222222223 170.66666666666666 Q 142.22222222222223 183.11111111111111 134.22222222222223 191.11111111111111 Q 126.22222222222223 199.11111111111111 113.77777777777777 199.11111111111111 Q 101.33333333333333 199.11111111111111 93.33333333333333 191.11111111111111 Q 85.33333333333333 183.11111111111111 85.33333333333333 170.66666666666666 L 85.33333333333333 170.66666666666666 Z M 177.77777777777777 170.66666666666666 Q 179.55555555555554 151.11111111111111 199.11111111111111 149.33333333333334 L 398.22222222222223 149.33333333333334 L 398.22222222222223 149.33333333333334 Q 417.77777777777777 151.11111111111111 419.55555555555554 170.66666666666666 Q 417.77777777777777 190.22222222222223 398.22222222222223 192 L 199.11111111111111 192 L 199.11111111111111 192 Q 179.55555555555554 190.22222222222223 177.77777777777777 170.66666666666666 L 177.77777777777777 170.66666666666666 Z M 177.77777777777777 256 Q 179.55555555555554 236.44444444444446 199.11111111111111 234.66666666666666 L 398.22222222222223 234.66666666666666 L 398.22222222222223 234.66666666666666 Q 417.77777777777777 236.44444444444446 419.55555555555554 256 Q 417.77777777777777 275.55555555555554 398.22222222222223 277.3333333333333 L 199.11111111111111 277.3333333333333 L 199.11111111111111 277.3333333333333 Q 179.55555555555554 275.55555555555554 177.77777777777777 256 L 177.77777777777777 256 Z M 177.77777777777777 341.3333333333333 Q 179.55555555555554 321.77777777777777 199.11111111111111 320 L 398.22222222222223 320 L 398.22222222222223 320 Q 417.77777777777777 321.77777777777777 419.55555555555554 341.3333333333333 Q 417.77777777777777 360.8888888888889 398.22222222222223 362.6666666666667 L 199.11111111111111 362.6666666666667 L 199.11111111111111 362.6666666666667 Q 179.55555555555554 360.8888888888889 177.77777777777777 341.3333333333333 L 177.77777777777777 341.3333333333333 Z M 113.77777777777777 284.44444444444446 Q 101.33333333333333 284.44444444444446 93.33333333333333 276.44444444444446 L 93.33333333333333 276.44444444444446 L 93.33333333333333 276.44444444444446 Q 85.33333333333333 268.44444444444446 85.33333333333333 256 Q 85.33333333333333 243.55555555555554 93.33333333333333 235.55555555555554 Q 101.33333333333333 227.55555555555554 113.77777777777777 227.55555555555554 Q 126.22222222222223 227.55555555555554 134.22222222222223 235.55555555555554 Q 142.22222222222223 243.55555555555554 142.22222222222223 256 Q 142.22222222222223 268.44444444444446 134.22222222222223 276.44444444444446 Q 126.22222222222223 284.44444444444446 113.77777777777777 284.44444444444446 L 113.77777777777777 284.44444444444446 Z M 85.33333333333333 341.3333333333333 Q 85.33333333333333 328.8888888888889 93.33333333333333 320.8888888888889 L 93.33333333333333 320.8888888888889 L 93.33333333333333 320.8888888888889 Q 101.33333333333333 312.8888888888889 113.77777777777777 312.8888888888889 Q 126.22222222222223 312.8888888888889 134.22222222222223 320.8888888888889 Q 142.22222222222223 328.8888888888889 142.22222222222223 341.3333333333333 Q 142.22222222222223 353.77777777777777 134.22222222222223 361.77777777777777 Q 126.22222222222223 369.77777777777777 113.77777777777777 369.77777777777777 Q 101.33333333333333 369.77777777777777 93.33333333333333 361.77777777777777 Q 85.33333333333333 353.77777777777777 85.33333333333333 341.3333333333333 L 85.33333333333333 341.3333333333333 Z"
                />
                </svg>
            `;

            player.addButton(
                "data:image/svg+xml;base64," + btoa(theaterModeIcon), // Inline SVG as Base64
                $scope.isPanelHidden
                    ? "Hiện danh sách tập"
                    : "Ẩn danh sách tập",
                function () {
                    // Toggle panel visibility
                    $scope.$apply(() => {
                        $scope.isPanelHidden = !$scope.isPanelHidden;
                    });
                },
                "togglePanel", // Unique ID for the button
            );

            // Restore playback position if available
            const lastWatchedList = $scope.getLastWatchedList();
            const movieData = lastWatchedList.find(
                (item) => item.movieSlug === slug,
            );
            const lastPosition =
                movieData?.episodes?.[$scope.currentEpisodeId]?.position || 0;

            player.on("ready", function () {
                if (lastPosition > 0) {
                    console.log(
                        `Resuming playback from position: ${lastPosition}`,
                    );
                    player.seek(lastPosition); // Resume from the last saved position
                }
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

    // Initialize
    $scope.fetchMovieDetails().then(() => {
        $scope.initializeFromUrl(); // Initialize episode from URL
    });
});
