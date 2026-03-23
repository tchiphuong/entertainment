import React from "react";
import Skeleton from "../ui/Skeleton";
import { TMDB_IMAGE_BASE_URL } from "../../constants/vodConstants";

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
                {[...Array(12)].map((_, i) => (
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

    return (
        <div className="relative min-h-screen">
            {/* Background Hero Placeholder */}
            <div className="absolute inset-x-0 top-0 z-0 mx-auto h-[85vh] w-full max-w-[1920px] overflow-hidden md:h-screen lg:min-h-[850px]">
                {backgrounds ? (
                    <>
                        <div
                            className="bg-no-state absolute inset-0 bg-cover bg-top opacity-40 blur-[2px] md:hidden"
                            style={{
                                backgroundImage: `url(${backgrounds.poster_url && !backgrounds.poster_url.startsWith('http') ? TMDB_IMAGE_BASE_URL + '/original' + backgrounds.poster_url : backgrounds.poster_url || backgrounds.thumb_url})`,
                            }}
                        ></div>
                        <div
                            className="bg-no-state absolute inset-0 hidden bg-cover bg-center opacity-35 blur-[2px] md:block"
                            style={{
                                backgroundImage: `url(${backgrounds.thumb_url && !backgrounds.thumb_url.startsWith('http') ? TMDB_IMAGE_BASE_URL + '/original' + backgrounds.thumb_url : backgrounds.thumb_url || backgrounds.poster_url})`,
                            }}
                        ></div>
                    </>
                ) : (
                    <div className="absolute inset-0 bg-zinc-900/30 blur-md"></div>
                )}
                <div className="bg-linear-to-b absolute inset-0 from-zinc-950/20 via-zinc-950/60 to-zinc-950"></div>
                <div className="absolute inset-0 border-b border-white/5"></div>
            </div>

            <div className="container relative z-10 mx-auto flex flex-col gap-8 px-4 pb-12 pt-20">
                {/* Breadcrumb & Actions Skeleton */}
                <div className="mb-2 flex flex-col gap-6 border-b border-zinc-900 py-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2 pb-2 md:pb-0">
                        <Skeleton className="h-4 w-12" />
                        <span className="text-zinc-800">/</span>
                        <Skeleton className="h-4 w-32" />
                    </div>
                    {/* Actions Skeleton */}
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-28 rounded-full" />
                        <Skeleton className="h-10 w-28 rounded-full" />
                    </div>
                </div>

                <div className="flex flex-col gap-8">
                    {/* Player Area */}
                    <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-black/50 shadow-2xl ring-1 ring-white/5">
                        <Skeleton
                            className="w-full"
                            style={{ aspectRatio: "16/9" }}
                        />
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
                                <Skeleton className="h-12 w-44 rounded-xl" />
                            </div>
                        </div>
                    </div>

                    {/* Episode List Area */}
                    <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl ring-1 ring-white/5">
                        <div className="flex h-16 items-center gap-4 border-b border-white/5 bg-zinc-900/50 px-8">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-5 w-32" />
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
                                {[...Array(24)].map((_, i) => (
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
                        <Skeleton className="hidden h-[450px] w-[300px] shrink-0 rounded-2xl ring-1 ring-white/5 lg:block" />
                        <div className="flex-1 space-y-10">
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <Skeleton className="h-16 w-3/4 md:h-24" />
                                    <Skeleton className="h-6 w-1/2" />
                                </div>
                                <div className="flex gap-4">
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                    <Skeleton className="h-6 w-24 rounded-full" />
                                </div>
                            </div>
                            <div className="flex gap-3">
                                {[...Array(6)].map((_, i) => (
                                    <Skeleton
                                        key={i}
                                        className="h-10 w-24 rounded-full"
                                    />
                                ))}
                            </div>
                            <div className="space-y-4">
                                <Skeleton className="h-6 w-40" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-3/4" />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Cast Skeleton */}
                    <section className="space-y-8">
                        <Skeleton className="h-8 w-48" />
                        <div className="flex gap-6 overflow-hidden">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="flex flex-col items-center space-y-4">
                                    <Skeleton className="h-24 w-24 rounded-full md:h-28 md:w-28" />
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-3 w-16 opacity-50" />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Gallery Skeleton */}
                    <section className="space-y-8 pb-12">
                        <Skeleton className="h-8 w-56" />
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                            {[...Array(12)].map((_, i) => (
                                <Skeleton key={i} className="aspect-video rounded-xl" />
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
