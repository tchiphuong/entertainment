import { useMemo } from "react";
import {
    DatePicker,
    DateInput,
    DateSegment,
    Calendar,
    CalendarGrid,
    CalendarHeaderCell,
    CalendarCell,
    CalendarGridHeader,
    CalendarGridBody,
    Heading,
    Button,
    Popover,
    Dialog,
    Group,
    TextField,
    Input,
    Label,
} from "react-aria-components";
import { parseDate } from "@internationalized/date";
import moment from "moment";
import { useTranslation } from "react-i18next";

export default function ScheduleFilterBar({
    selectedDate,
    onDateChange,
    searchQuery,
    onSearchChange,
    onRefresh,
    loading,
}) {
    const { t } = useTranslation();

    // Chuyển đổi selectedDate sang định dạng CalendarDate (@internationalized/date) cho HeroUI DatePicker
    const heroDateValue = useMemo(() => {
        const dateStr = selectedDate ? moment(selectedDate).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");
        try {
            return parseDate(dateStr);
        } catch {
            return parseDate(moment().format("YYYY-MM-DD"));
        }
    }, [selectedDate]);

    // Xử lý khi người dùng chọn ngày mới trên HeroUI DatePicker
    const handleDateChange = (val) => {
        if (!val) return;
        const newJsDate = new Date(val.year, val.month - 1, val.day);
        onDateChange(newJsDate);
    };

    return (
        <div className="sticky top-20 z-40 mb-8 transition-all">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/95 p-3.5 shadow-2xl backdrop-blur-md md:flex-row">
                {/* HeroUI DatePicker Component */}
                <div className="group relative w-full md:w-64">
                    <DatePicker
                        value={heroDateValue}
                        onChange={handleDateChange}
                        aria-label={t("schedule.selectDate") || "Chọn ngày thi đấu"}
                        className="w-full"
                    >
                        <Label className="absolute -top-2 left-3 z-10 rounded bg-zinc-900 px-1 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                            {t("schedule.selectDate") || "Chọn ngày"}
                        </Label>
                        <Group className="relative flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-bold text-white transition-colors focus-within:border-red-600 hover:border-zinc-700">
                            <DateInput className="flex flex-1 items-center gap-0.5 text-sm font-semibold text-zinc-100 outline-none">
                                {(segment) => (
                                    <DateSegment
                                        segment={segment}
                                        className="rounded px-0.5 text-zinc-200 outline-none focus:bg-red-600 focus:text-white"
                                    />
                                )}
                            </DateInput>
                            <Button
                                aria-label="Mở lịch chọn ngày"
                                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white outline-none cursor-pointer"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                </svg>
                            </Button>
                        </Group>

                        <Popover
                            placement="bottom start"
                            className="z-50 min-w-[280px] rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                        >
                            <Dialog className="outline-none">
                                <Calendar aria-label="Lịch thi đấu thể thao" className="w-full bg-transparent text-white">
                                    <header className="mb-3 flex items-center justify-between">
                                        <Heading className="text-sm font-bold text-white" />
                                        <div className="flex items-center gap-1">
                                            <Button
                                                slot="previous"
                                                aria-label="Tháng trước"
                                                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white outline-none cursor-pointer"
                                            >
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                                </svg>
                                            </Button>
                                            <Button
                                                slot="next"
                                                aria-label="Tháng sau"
                                                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white outline-none cursor-pointer"
                                            >
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </Button>
                                        </div>
                                    </header>
                                    <CalendarGrid className="w-full border-collapse">
                                        <CalendarGridHeader>
                                            {(day) => (
                                                <CalendarHeaderCell className="pb-2 text-center text-[11px] font-semibold text-zinc-400">
                                                    {day}
                                                </CalendarHeaderCell>
                                            )}
                                        </CalendarGridHeader>
                                        <CalendarGridBody>
                                            {(date) => (
                                                <CalendarCell
                                                    date={date}
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 data-[selected=true]:bg-red-600 data-[selected=true]:font-bold data-[selected=true]:text-white data-[today=true]:border data-[today=true]:border-red-600/50 data-[disabled=true]:opacity-30 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                                                />
                                            )}
                                        </CalendarGridBody>
                                    </CalendarGrid>
                                </Calendar>
                            </Dialog>
                        </Popover>
                    </DatePicker>
                </div>

                {/* HeroUI TextField Component */}
                <TextField
                    value={searchQuery}
                    onChange={onSearchChange}
                    aria-label={t("common.search") || "Tìm kiếm"}
                    className="relative w-full flex-1"
                >
                    <Label className="absolute -top-2 left-3 z-10 rounded bg-zinc-900 px-1 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                        {t("common.search") || "Tìm kiếm"}
                    </Label>
                    <div className="relative">
                        <Input
                            placeholder={t("schedule.searchPlaceholder") || "Tìm giải đấu, câu lạc bộ..."}
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 pl-10 text-sm font-medium text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-red-600"
                        />
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        {searchQuery && (
                            <Button
                                onPress={() => onSearchChange("")}
                                aria-label="Xóa tìm kiếm"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white outline-none cursor-pointer"
                            >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </Button>
                        )}
                    </div>
                </TextField>

                {/* HeroUI Button Component */}
                <Button
                    onPress={onRefresh}
                    isDisabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all hover:bg-red-500 active:scale-95 disabled:opacity-50 md:w-auto cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                    {t("schedule.refresh") || "Làm mới"}
                </Button>
            </div>
        </div>
    );
}
