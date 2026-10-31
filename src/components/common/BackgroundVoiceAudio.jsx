import { useRef, useEffect } from "react";
import { unlockAudioElement } from "../../utils/watchPartyUtils";

/**
 * Component phát audio ngầm cho luồng thoại WebRTC Voice Call
 */
export const BackgroundVoiceAudio = ({ stream }) => {
    const audioRef = useRef(null);

    useEffect(() => {
        const audioEl = audioRef.current;
        if (!audioEl || !stream) return;
        audioEl.srcObject = stream;
        const playPromise = audioEl.play();
        if (playPromise) {
            playPromise.catch(() => {
                unlockAudioElement(audioEl);
            });
        }
    }, [stream]);

    return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
};

export default BackgroundVoiceAudio;
