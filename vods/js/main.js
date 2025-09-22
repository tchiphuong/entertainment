const app = angular.module("iptvApp", []);

app.constant("CONFIG", {
    APP_DOMAIN_FRONTEND: "https://phimapi.com",
    APP_DOMAIN_CDN_IMAGE: "https://phimimg.com",
    API_ENDPOINT: "https://phimapi.com/v1/api/quoc-gia",
});

app.controller("MainController", function ($scope, $http, $document, CONFIG) {
    $scope.movies = [];
    $scope.currentPage = 1;
    $scope.totalPages = 1;
    $scope.isLoading = false;
    $scope.searchKeyword = "";
    $scope.country = "viet-nam";
    $scope.isHistoryOpen = false;
    $scope.history = JSON.parse(localStorage.getItem("viewHistory")) || [];
    $scope.countries = [];

    // Reusable function to fetch data from API
    $scope.fetchData = function (url, params) {
        $scope.isLoading = true; // Show loading overlay
        const queryString = Object.keys(params)
            .map((key) => `${key}=${encodeURIComponent(params[key])}`)
            .join("&");

        $http.get(`${url}?${queryString}`).then(
            function (response) {
                if (!response.data || !response.data.data) {
                    $scope.isLoading = false; // Hide loading overlay
                    $scope.movies = []; // Clear movies if no data is returned
                    $scope.totalPages = 1; // Reset total pages
                    return;
                }

                // Update history with the current movie list
                $scope.movies = response.data.data.items || [];
                $scope.totalPages =
                    response.data.data.params.pagination.totalPages || 1;
                $scope.isLoading = false; // Hide loading overlay
            },
            function (error) {
                console.error("Error fetching data:", error);
                $scope.isLoading = false; // Hide loading overlay
            },
        );
    };

    // Fetch movies from API
    $scope.fetchMovies = function () {
        const params = {
            country: $scope.country,
            page: $scope.currentPage,
            limit: 12,
            sort_field: "year",
            sort_type: "desc",
        };
        $scope.fetchData(`${CONFIG.API_ENDPOINT}/${params.country}`, params);
    };

    // Search movies by keyword
    $scope.searchMovies = function (event) {
        if (event.key === "Enter") {
            $scope.currentPage = 1; // Reset to the first page when searching
            if ($scope.searchKeyword.trim() !== "") {
                const params = {
                    country: $scope.country,
                    page: $scope.currentPage,
                    limit: 12,
                    sort_field: "year",
                    sort_type: "desc",
                    keyword: $scope.searchKeyword,
                };
                $scope.fetchData(
                    `${CONFIG.APP_DOMAIN_FRONTEND}/v1/api/tim-kiem`,
                    params,
                );
            } else {
                $scope.fetchMovies(); // Reload default movie list when search is cleared
            }
            $scope.updateUrlParams(); // Update URL parameters
        }
    };

    $scope.getMovieImage = function (imagePath) {
        return imagePath
            ? `${CONFIG.APP_DOMAIN_CDN_IMAGE}/${imagePath}`
            : `https://picsum.photos/2000/3000?random=${new Date().getTime()}`;
    };

    $scope.toggleHistory = function (event) {
        if (event) {
            event.stopPropagation();
        }
        // Refresh history from localStorage mỗi khi mở modal
        $scope.history = JSON.parse(localStorage.getItem("viewHistory")) || [];
        $scope.isHistoryOpen = !$scope.isHistoryOpen;

        // Sort history by timestamp (most recent first)
        if ($scope.isHistoryOpen) {
            $scope.history.sort(
                (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
            );
        }
    };

    $scope.closeHistory = function () {
        $scope.isHistoryOpen = false;
    };

    $scope.deleteHistoryItem = function (slug, event) {
        if (event) {
            event.stopPropagation();
        }
        const newHistory = $scope.history.filter((item) => item.slug !== slug);
        localStorage.setItem("viewHistory", JSON.stringify(newHistory));
        $scope.history = newHistory;
    };

    $scope.clearHistory = function () {
        $scope.history = [];
        localStorage.setItem("viewHistory", JSON.stringify([]));
    };

    $scope.openMovie = function (slug) {
        const movie = $scope.movies.find((m) => m.slug === slug);
        if (movie) {
            window.location.href = `./play.html?slug=${slug}`;
        }
    };

    // Navigate to the next page
    $scope.nextPage = function () {
        if ($scope.currentPage < $scope.totalPages) {
            $scope.goToPage($scope.currentPage + 1);
        }
    };

    // Navigate to the previous page
    $scope.prevPage = function () {
        if ($scope.currentPage > 1) {
            $scope.goToPage($scope.currentPage - 1);
        }
    };

    // Generate a range of pages from 1 to totalPages
    $scope.generatePages = function (totalPages) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    };

    // Generate visible pages with ellipses
    $scope.generateVisiblePages = function (totalPages, currentPage) {
        const visiblePages = [];
        const range = 1; // Show two pages before and after the current page

        for (let i = currentPage - range; i <= currentPage + range; i++) {
            if (i >= 1 && i <= totalPages) {
                visiblePages.push(i);
            }
        }

        return visiblePages;
    };

    $scope.updateUrlParams = function () {
        const params = new URLSearchParams();
        params.set("page", $scope.currentPage);
        if ($scope.searchKeyword.trim() !== "") {
            params.set("keyword", $scope.searchKeyword);
        }
        if ($scope.country.trim() !== "") {
            params.set("country", $scope.country);
        }
        window.history.replaceState({}, "", `?${params.toString()}`);
    };

    $scope.goToPage = function (page) {
        if (page >= 1 && page <= $scope.totalPages) {
            $scope.currentPage = page;

            const params = {
                country: $scope.country,
                page: $scope.currentPage,
                limit: 12,
                sort_field: "year",
                sort_type: "desc",
            };

            if ($scope.searchKeyword.trim() !== "") {
                params.keyword = $scope.searchKeyword;
                $scope.fetchData(
                    `${CONFIG.APP_DOMAIN_FRONTEND}/v1/api/tim-kiem`,
                    params,
                );
            } else {
                $scope.fetchMovies();
            }

            $scope.updateUrlParams(); // Update URL parameters
        }
    };

    // Initialize
    $scope.initializeFromUrl = function () {
        const params = new URLSearchParams(window.location.search);
        $scope.currentPage = parseInt(params.get("page")) || 1;
        $scope.searchKeyword = params.get("keyword") || "";
        $scope.country = params.get("country") || "viet-nam";
        if ($scope.searchKeyword.trim() !== "") {
            $scope.searchMovies({ key: "Enter" });
        } else {
            $scope.fetchMovies(); // Load default movie list if no keyword is present
        }
    };

    $scope.initializeFromUrl(); // Initialize state from URL

    // Keyboard navigation for pagination
    window.addEventListener("keydown", function (event) {
        if (event.key === "ArrowRight") {
            $scope.nextPage();
            $scope.$apply();
        } else if (event.key === "ArrowLeft") {
            $scope.prevPage();
            $scope.$apply();
        }
    });

    // Close modal when clicking outside
    $document.on("click", function () {
        $scope.$apply(function () {
            $scope.closeHistory();
        });
    });

    // Fetch countries for the dropdown
    $scope.fetchCountries = function () {
        $http.get(`${CONFIG.APP_DOMAIN_FRONTEND}/quoc-gia`).then(
            function (response) {
                $scope.countries = response.data || [];
                const countryOptions = $scope.countries
                    .map((country) => ({
                        id: country.slug,
                        text: country.name,
                    }))
                    .sort((a, b) => a.text.localeCompare(b.text, "vi")); // Sort by name using Vietnamese locale

                // Initialize select2
                $("#countrySelector")
                    .select2({
                        placeholder: "Chọn quốc gia",
                        data: countryOptions,
                        allowClear: true,
                    })
                    .val($scope.country) // Pre-select the country from the URL parameter
                    .trigger("change") // Trigger the change event to ensure the dropdown reflects the selection
                    .on("change", function () {
                        const selectedCountry = $(this).val();
                        $scope.country = selectedCountry || "viet-nam"; // Update the country in the scope
                        $scope.updateUrlParams(); // Update the URL with the selected country
                        $scope.filterByCountry($scope.country);
                    });
            },
            function (error) {
                console.error("Error fetching countries:", error);
            },
        );
    };

    // Filter movies by selected country
    $scope.filterByCountry = function (countrySlug) {
        if (countrySlug) {
            $scope.country = countrySlug; // Update the country in the scope
            $scope.currentPage = 1; // Reset to the first page
            $scope.updateUrlParams(); // Update the URL with the selected country
            $scope.fetchMovies(); // Reuse fetchMovies to load movies for the selected country
        }
    };

    // Initialize
    $scope.fetchCountries();
});
