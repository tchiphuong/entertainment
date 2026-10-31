import { useRef, useEffect } from "react";
import { unlockAudioElement } from "../../utils/watchPartyUtils";

/**
 * Component phát audio ngầm cho luồng thoại WebRTC Voice Call
 */
export const BackgroundVoiceAudio = ({ stream, volume = 100 }) => {
    const audioRef = useRef(null);

    useEffect(() => {
        const audioEl = audioRef.current;
        if (!audioEl || !stream) return;
        audioEl.srcObject = stream;
        audioEl.volume = Math.max(0, Math.min(1, volume / 100));
        const playPromise = audioEl.play();
        if (playPromise) {
            playPromise.catch(() => {
                unlockAudioElement(audioEl);
            });
        }
    }, [stream]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
        }
    }, [volume]);

    return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
};

export default BackgroundVoiceAudio;
