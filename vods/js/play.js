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
