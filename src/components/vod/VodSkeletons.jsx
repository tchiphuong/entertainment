import Skeleton from "../ui/Skeleton";
import { PAGINATION, GRID_CONFIG } from "../../constants";

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

export function MovieRowSkeleton({ count = PAGINATION.ROW_PAGE_SIZE }) {
    return (
        <div className="space-y-5">
            <div className="px-4 md:px-12 lg:px-20">
                <Skeleton className="h-8 w-48" />
            </div>
            <div className="flex gap-4 overflow-hidden px-4 md:px-12 lg:px-20">
                {Array.from({ length: count }, (_, i) => (
                    <div
                        key={`mrs-item-${i}`}
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

export function MovieGridSkeleton({ count = PAGINATION.LISTING_PAGE_SIZE }) {
    return (
        <div className={GRID_CONFIG.LISTING_GRID_CLASSES}>
            {Array.from({ length: count }, (_, i) => (
                <MovieCardSkeleton key={`mgs-item-${i}`} />
            ))}
        </div>
    );
}

export function PlaySkeleton() {
    return (
        <div className="relative min-h-screen">
            <div className="container relative z-10 mx-auto flex flex-col gap-8 px-4 pb-12 pt-20">
                <div className="flex flex-col gap-8">
                    {/* Player Container Skeleton */}
                    <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/5">
                        <div className="relative aspect-video w-full overflow-hidden bg-zinc-950 md:max-h-[80vh]">
                            <Skeleton className="h-full w-full opacity-30" />
                        </div>

                        {/* Player Control Bar Skeleton */}
                        <div className="border-t border-white/5 bg-zinc-950 p-4 md:p-6">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-1 shrink-0 rounded-full bg-red-600/50" />
                                    <div className="space-y-1.5">
                                        <Skeleton className="h-5 w-48 md:w-64" />
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-4 w-16 rounded" />
                                            <Skeleton className="h-3 w-28" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-8 w-20 rounded-lg" />
                                    <Skeleton className="h-8 w-20 rounded-lg" />
                                    <Skeleton className="h-8 w-14 rounded-lg" />
                                </div>
                            </div>
                        </div>

                        {/* Player Settings Bar Skeleton */}
                        <div className="border-t border-white/5 bg-zinc-900/40 p-4 md:px-6">
                            <div className="flex flex-wrap items-center justify-end gap-4 md:gap-6">
                                <Skeleton className="h-6 w-36 rounded" />
                                <Skeleton className="h-6 w-48 rounded" />
                                <Skeleton className="h-6 w-28 rounded" />
                            </div>
                        </div>
                    </div>

                    {/* Episodes Section Skeleton */}
                    <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl ring-1 ring-white/5">
                        {/* Server Tabs Header */}
                        <div className="flex items-center justify-between border-b border-white/5 bg-zinc-900/30 p-4 md:px-6">
                            <Skeleton className="h-5 w-32 rounded" />
                            <div className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/80 p-1">
                                <Skeleton className="h-6 w-24 rounded-full" />
                                <Skeleton className="h-6 w-20 rounded-full" />
                            </div>
                        </div>
                        {/* Episode Grid */}
                        <div className="p-4 md:p-6">
                            <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
                                {Array.from({ length: 24 }, (_, i) => (
                                    <Skeleton key={`eps-skel-${i}`} className="h-10 rounded-lg" />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Media Details Section Skeleton */}
                <div className="mt-8 space-y-16">
                    <section className="flex flex-col gap-6 md:gap-8 lg:gap-12 items-start lg:flex-row">
                        {/* Poster / Backdrop */}
                        <div className="w-full lg:w-auto lg:shrink-0">
                            <Skeleton className="aspect-video w-full rounded-2xl lg:hidden" />
                            <Skeleton className="hidden aspect-2/3 rounded-2xl lg:block lg:w-72 xl:w-80" />
                        </div>
                        {/* Info details */}
                        <div className="flex-1 space-y-6 w-full">
                            <div className="space-y-3">
                                <Skeleton className="h-16 sm:h-20 w-48 sm:w-72 rounded-xl" />
                                <div className="flex flex-wrap gap-2">
                                    <Skeleton className="h-6 w-14 rounded" />
                                    <Skeleton className="h-6 w-16 rounded" />
                                    <Skeleton className="h-6 w-12 rounded" />
                                    <Skeleton className="h-6 w-20 rounded" />
                                </div>
                            </div>
                            <div className="space-y-2.5">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-5/6" />
                                <Skeleton className="h-4 w-2/3" />
                            </div>
                        </div>
                    </section>

                    {/* Cast Skeleton */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-5 w-36" />
                            <div className="flex gap-2">
                                <Skeleton className="h-8 w-8 rounded-lg" />
                                <Skeleton className="h-8 w-8 rounded-lg" />
                            </div>
                        </div>
                        <div className="flex gap-6 overflow-hidden py-4 px-1">
                            {Array.from({ length: 8 }, (_, i) => (
                                <div key={`cast-skel-${i}`} className="flex shrink-0 w-24 md:w-28 flex-col items-center space-y-4">
                                    <Skeleton className="h-24 w-24 rounded-full md:h-28 md:w-28" />
                                    <div className="space-y-1.5 w-full flex flex-col items-center">
                                        <Skeleton className="h-3.5 w-16" />
                                        <Skeleton className="h-2.5 w-12 opacity-50" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Unified Media Gallery Skeleton */}
                    <section className="space-y-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-3">
                                <Skeleton className="h-5 w-36" />
                                <div className="flex gap-1 rounded-full border border-zinc-800 bg-zinc-900/80 p-1">
                                    <Skeleton className="h-6 w-32 rounded-full" />
                                    <Skeleton className="h-6 w-24 rounded-full" />
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Skeleton className="h-8 w-8 rounded-lg" />
                                <Skeleton className="h-8 w-8 rounded-lg" />
                            </div>
                        </div>
                        <div className="flex gap-4 overflow-hidden py-2 md:gap-6">
                            {Array.from({ length: 4 }, (_, i) => (
                                <div key={`media-skel-${i}`} className="w-64 md:w-80 shrink-0 space-y-3">
                                    <Skeleton className="aspect-video w-full rounded-xl" />
                                    <Skeleton className="h-4 w-3/4" />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Recommendations Skeleton */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-5 w-36" />
                            <div className="flex gap-2">
                                <Skeleton className="h-8 w-8 rounded-lg" />
                                <Skeleton className="h-8 w-8 rounded-lg" />
                            </div>
                        </div>
                        <div className="flex gap-4 overflow-hidden py-2">
                            {Array.from({ length: 6 }, (_, i) => (
                                <div key={`rec-skel-${i}`} className="w-36 sm:w-44 md:w-52 shrink-0">
                                    <MovieCardSkeleton />
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
