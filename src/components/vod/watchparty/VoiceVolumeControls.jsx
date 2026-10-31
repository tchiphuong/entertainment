import { useState, useRef, useEffect } from "react";
import {
    SpeakerWaveIcon,
    SpeakerXMarkIcon,
    MicrophoneIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";

const IconMicOff = ({ className = "h-4 w-4" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3zM3 3l18 18" />
    </svg>
);

export const VolumeSliderRow = ({
    label,
    icon: Icon,
    offIcon: OffIcon,
    value,
    onChange,
    min = 0,
    max = 100,
    step = 5,
    unit = "%",
}) => {
    const isMuted = value === 0;
    const [prevValue, setPrevValue] = useState(100);

    const toggleMute = () => {
        if (isMuted) {
            onChange(prevValue || 100);
        } else {
            setPrevValue(value);
            onChange(0);
        }
    };

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
                <button
                    type="button"
                    onClick={toggleMute}
                    className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors"
                    title={isMuted ? "Bật âm thanh" : "Tắt tiếng"}
                >
                    {isMuted && OffIcon ? (
                        <OffIcon className="h-4 w-4 text-red-400 stroke-2" />
                    ) : (
                        <Icon className="h-4 w-4 text-emerald-400 stroke-2" />
                    )}
                    <span className="font-semibold">{label}</span>
                </button>
                <span className="font-mono text-[11px] font-bold text-zinc-400">
                    {value}{unit}
                </span>
            </div>

            <div className="flex items-center gap-2">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    aria-label={label}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-emerald-500 focus:outline-none"
                />
            </div>
        </div>
    );
};

export const VoiceVolumePopover = ({
    micVolume,
    onMicVolumeChange,
    speakerVolume,
    onSpeakerVolumeChange,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleOutsideClick = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [isOpen]);

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    isOpen ? "bg-zinc-700 text-white" : "bg-zinc-800 text-zinc-300 hover:text-white"
                }`}
                title="Chỉnh âm lượng Micro & Loa Voice"
            >
                <SpeakerWaveIcon className="h-4 w-4 stroke-2 text-emerald-400" />
                <span className="hidden sm:inline">Âm lượng</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 bottom-full mb-2 z-50 w-72 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl text-white">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
                        <div className="flex items-center gap-1.5">
                            <SpeakerWaveIcon className="h-4 w-4 text-emerald-400 stroke-2" />
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                                Âm lượng Voice Chat
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                        >
                            <XMarkIcon className="h-4 w-4 stroke-2" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <VolumeSliderRow
                            label="Âm lượng Micro (Bạn nói)"
                            icon={MicrophoneIcon}
                            offIcon={IconMicOff}
                            value={micVolume}
                            onChange={onMicVolumeChange}
                        />

                        <VolumeSliderRow
                            label="Âm lượng Loa Voice (Bạn bè)"
                            icon={SpeakerWaveIcon}
                            offIcon={SpeakerXMarkIcon}
                            value={speakerVolume}
                            onChange={onSpeakerVolumeChange}
                        />

                        <p className="text-[10px] text-zinc-400 leading-relaxed border-t border-zinc-800/80 pt-2">
                            Điều chỉnh âm lượng giọng nói mà không làm ảnh hưởng đến âm thanh của video phim đang phát.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export const VoiceVolumeSettingsBlock = ({
    micVolume,
    onMicVolumeChange,
    speakerVolume,
    onSpeakerVolumeChange,
}) => (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
        <div className="flex items-center gap-2 font-bold text-white">
            <SpeakerWaveIcon className="h-4 w-4 text-emerald-400 stroke-2" />
            <span>Cài đặt Âm lượng Voice Chat</span>
        </div>
        <p className="text-[11px] text-zinc-400">
            Tùy chỉnh âm lượng micro của bạn và âm lượng tiếng nói của bạn bè trong phòng xem chung.
        </p>
        <div className="space-y-3 pt-1">
            <VolumeSliderRow
                label="Âm lượng Micro của bạn"
                icon={MicrophoneIcon}
                offIcon={IconMicOff}
                value={micVolume}
                onChange={onMicVolumeChange}
            />
            <VolumeSliderRow
                label="Âm lượng Loa tiếng bạn bè"
                icon={SpeakerWaveIcon}
                offIcon={SpeakerXMarkIcon}
                value={speakerVolume}
                onChange={onSpeakerVolumeChange}
            />
        </div>
    </div>
);
