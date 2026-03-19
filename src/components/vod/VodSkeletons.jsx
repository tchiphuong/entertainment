import React from "react";
import Skeleton from "../ui/Skeleton";

export function MovieCardSkeleton() {
    return (
        <div className="space-y-3">
            <Skeleton className="aspect-2/3 w-full rounded-lg" />
            <div className="space-y-2 px-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2 opacity-50" />
            </div>
        </div>
    );
}

export function MovieRowSkeleton({ title = "" }) {
    return (
        <div className="space-y-5">
            <div className="px-4 md:px-12 lg:px-20">
                <Skeleton className="h-8 w-48" />
            </div>
            <div className="flex gap-4 overflow-hidden px-4 md:px-12 lg:px-20">
                {[...Array(6)].map((_, i) => (
                    <div
                        key={i}
                        className="min-w-[170px] md:min-w-[210px] lg:min-w-[250px]"
                    >
                        <MovieCardSkeleton />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function HeroSkeleton() {
    return (
        <div className="relative h-[85vh] w-full overflow-hidden bg-zinc-950 md:h-screen lg:min-h-[850px]">
            <div className="absolute inset-0 z-0">
                <Skeleton className="h-full w-full opacity-20" />
            </div>
            <div className="relative z-10 flex h-full max-w-5xl flex-col justify-center space-y-8 px-4 md:px-12 lg:px-20">
                <div className="space-y-4">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-16 w-3/4 md:h-24" />
                    <Skeleton className="h-6 w-48" />
                </div>
                <Skeleton className="h-20 w-2/3" />
                <div className="flex gap-4">
                    <Skeleton className="h-12 w-40 rounded" />
                    <Skeleton className="h-12 w-40 rounded" />
                </div>
            </div>
        </div>
    );
}

export function MovieGridSkeleton({ count = 12 }) {
    return (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {[...Array(count)].map((_, i) => (
                <MovieCardSkeleton key={i} />
            ))}
        </div>
    );
}

export function PlaySkeleton({ backgrounds }) {
    const getMovieImage = (url) => {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        return `https://image.tmdb.org/t/p/original${url}`;
    };

    return (
        <div className="relative min-h-screen">
            {/* Background Hero Placeholder */}
            <div className="absolute inset-x-0 top-0 z-0 mx-auto h-[85vh] w-full max-w-[1920px] overflow-hidden md:h-screen lg:min-h-[850px]">
                {backgrounds ? (
                    <>
                        <div
                            className="bg-no-state absolute inset-0 bg-cover bg-top opacity-40 blur-[2px] md:hidden"
                            style={{
                                backgroundImage: `url(${backgrounds.poster_url || backgrounds.thumb_url})`,
                            }}
                        ></div>
                        <div
                            className="bg-no-state absolute inset-0 hidden bg-cover bg-center opacity-35 blur-[2px] md:block"
                            style={{
                                backgroundImage: `url(${backgrounds.thumb_url || backgrounds.poster_url})`,
                            }}
                        ></div>
                    </>
                ) : (
                    <div className="absolute inset-0 bg-zinc-900/30 blur-md"></div>
                )}
                <div className="bg-linear-to-b absolute inset-0 from-zinc-950/20 via-zinc-950/60 to-zinc-950"></div>
                <div className="absolute inset-0 border-b border-white/5"></div>
            </div>

            <div className="container relative z-10 mx-auto space-y-8 px-4 py-12">
                {/* Breadcrumb Skeleton */}
                <div className="flex items-center gap-2 border-b border-zinc-900 pb-8">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-48" />
                </div>

                <div className="flex flex-col gap-8">
                    {/* Player Area */}
                    <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-black/50 ring-1 ring-white/5">
                        <Skeleton className="aspect-video w-full" />
                        {/* Control Bar Skeleton */}
                        <div className="border-t border-white/5 bg-zinc-950 p-6">
                            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-1 rounded-full bg-zinc-800"></div>
                                    <div className="space-y-2">
                                        <Skeleton className="h-3 w-16" />
                                        <Skeleton className="h-5 w-32" />
                                    </div>
                                </div>
                                <Skeleton className="h-12 w-40 rounded-xl" />
                            </div>
                        </div>
                    </div>

                    {/* Episode List Area */}
                    <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-zinc-950 ring-1 ring-white/5">
                        <div className="flex h-16 items-center gap-4 border-b border-white/5 bg-zinc-900/50 px-8">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                                {[...Array(20)].map((_, i) => (
                                    <Skeleton
                                        key={i}
                                        className="h-11 rounded-lg"
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Movie Details Info Area */}
                <div className="mt-12 space-y-20">
                    <section className="flex flex-col gap-12 lg:flex-row lg:items-start">
                        <Skeleton className="hidden h-[450px] w-[300px] shrink-0 rounded-2xl lg:block" />
                        <div className="flex-1 space-y-10">
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <Skeleton className="h-16 w-3/4 md:h-24" />
                                    <Skeleton className="h-6 w-1/2" />
                                </div>
                                <div className="flex gap-4">
                                    <Skeleton className="h-5 w-16" />
                                    <Skeleton className="h-5 w-16" />
                                    <Skeleton className="h-5 w-16" />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {[...Array(4)].map((_, i) => (
                                    <Skeleton
                                        key={i}
                                        className="h-10 w-24 rounded-lg"
                                    />
                                ))}
                            </div>
                            <div className="space-y-4">
                                <Skeleton className="h-6 w-40" />
                                <Skeleton className="h-32 w-full" />
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
