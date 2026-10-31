import {
    collection,
    doc,
    addDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
    query,
    where,
} from "firebase/firestore";
import { db } from "../firebase";

const ROOMS_COLLECTION = "watch_party_rooms";
const SIGNALS_SUB_COLLECTION = "signals";

const PeerConnection = typeof window !== "undefined" ? (window.RTCPeerConnection || window.webkitRTCPeerConnection) : null;
const SessionDescription = typeof window !== "undefined" ? window.RTCSessionDescription : null;
const IceCandidate = typeof window !== "undefined" ? window.RTCIceCandidate : null;
const StreamMedia = typeof window !== "undefined" ? window.MediaStream : null;

const RTC_CONFIG = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
    ],
};

/**
 * Trình quản lý kết nối P2P WebRTC Voice Mesh chuẩn Perfect Negotiation
 */
export class WatchPartyWebRTC {
    constructor({ roomId, currentUserId, onRemoteStreamChange, onConnectionStateChange, onPeerDisconnected }) {
        this.roomId = roomId;
        this.currentUserId = currentUserId;
        this.onRemoteStreamChange = onRemoteStreamChange;
        this.onConnectionStateChange = onConnectionStateChange;
        this.onPeerDisconnected = onPeerDisconnected;

        this.peers = new Map(); // targetPeerId -> RTCPeerConnection
        this.remoteStreams = new Map(); // targetPeerId -> MediaStream
        this.candidateQueues = new Map(); // targetPeerId -> [candidates]
        this.makingOffer = new Map(); // targetPeerId -> boolean
        this.pendingCandidates = new Map(); // targetPeerId -> [candidate] gom batch
        this.candidateBatchTimers = new Map(); // targetPeerId -> timerId
        this.localStream = null;
        this.unsubscribeSignals = null;
        this.isDestroyed = false;
    }

    /**
     * Khởi tạo lắng nghe signaling từ Firestore
     */
    init() {
        if (!this.roomId || !this.currentUserId) return;

        const signalsRef = collection(db, ROOMS_COLLECTION, this.roomId, SIGNALS_SUB_COLLECTION);
        const q = query(signalsRef, where("to", "==", this.currentUserId));

        this.unsubscribeSignals = onSnapshot(
            q,
            (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        const signal = { id: change.doc.id, ...change.doc.data() };
                        this.handleIncomingSignal(signal);
                        // Dọn dẹp signal đã xử lý
                        deleteDoc(doc(db, ROOMS_COLLECTION, this.roomId, SIGNALS_SUB_COLLECTION, signal.id)).catch(() => {});
                    }
                });
            },
            (error) => {
                console.warn("[WebRTC] Lỗi lắng nghe signals (Kiểm tra Firestore Rules):", error?.message || error);
            }
        );
    }

    /**
     * Đồng bộ danh sách thành viên trong phòng
     */
    syncParticipants(participants = {}) {
        if (this.isDestroyed) return;

        const activePeerIds = Object.keys(participants).filter((uid) => uid !== this.currentUserId);

        // Đóng kết nối các peer đã rời phòng
        this.peers.forEach((_pc, peerId) => {
            if (!activePeerIds.includes(peerId)) {
                this.closePeerConnection(peerId);
            }
        });

        // Tạo kết nối tới các peer mới
        activePeerIds.forEach((peerId) => {
            if (!this.peers.has(peerId)) {
                const pc = this.getOrCreatePeerConnection(peerId);
                // Peer có UID nhỏ hơn sẽ khởi xướng offer ban đầu
                if (this.currentUserId < peerId && pc) {
                    this.initiateOffer(peerId, pc);
                }
            }
        });
    }

    /**
     * Cập nhật local stream và truyền vào tất cả các peer connection
     */
    updateLocalStream(newLocalStream) {
        this.localStream = newLocalStream;

        this.peers.forEach((pc, _peerId) => {
            if (!pc) return;
            const senders = pc.getSenders();

            if (newLocalStream) {
                newLocalStream.getTracks().forEach((track) => {
                    const existingSender = senders.find((s) => s.track?.kind === track.kind);
                    if (existingSender) {
                        existingSender.replaceTrack(track).catch(() => {});
                    } else {
                        try {
                            pc.addTrack(track, newLocalStream);
                        } catch (err) {
                            console.warn("[WebRTC] Lỗi addTrack:", err);
                        }
                    }
                });
            } else {
                // Tắt tất cả senders
                senders.forEach((sender) => {
                    if (sender.track) {
                        sender.replaceTrack(null).catch(() => {});
                    }
                });
            }
        });
    }

    /**
     * Khởi tạo hoặc lấy kết nối RTCPeerConnection với một peer cụ thể
     */
    getOrCreatePeerConnection(peerId) {
        if (this.peers.has(peerId)) {
            return this.peers.get(peerId);
        }

        if (!PeerConnection) {
            console.warn("[WebRTC] Trình duyệt không hỗ trợ WebRTC RTCPeerConnection");
            return null;
        }

        const pc = new PeerConnection(RTC_CONFIG);
        this.candidateQueues.set(peerId, []);
        this.makingOffer.set(peerId, false);

        // Gắn local track nếu đã có
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
                try {
                    pc.addTrack(track, this.localStream);
                } catch {
                    // Tránh lỗi addTrack trùng lặp
                }
            });
        }

        // Lắng nghe ICE candidate và gom nhóm theo batch (tiết kiệm quota Firestore)
        pc.onicecandidate = (event) => {
            this.queueIceCandidate(peerId, event.candidate);
        };

        // Lắng nghe stream âm thanh/video từ xa (Remote Stream)
        pc.ontrack = (event) => {
            const stream = event.streams?.[0] || (StreamMedia ? new StreamMedia([event.track]) : null);
            if (stream) {
                this.remoteStreams.set(peerId, stream);
                if (this.onRemoteStreamChange) {
                    this.onRemoteStreamChange(new Map(this.remoteStreams));
                }
            }
        };

        // Xử lý khi cần renegotiation
        pc.onnegotiationneeded = async () => {
            await this.initiateOffer(peerId, pc);
        };

        // Trạng thái kết nối P2P
        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            if (state === "disconnected" || state === "failed" || state === "closed") {
                this.onPeerDisconnected?.(peerId);
                if (state !== "disconnected") {
                    this.closePeerConnection(peerId);
                }
            }
            this.onConnectionStateChange?.(peerId, state);
        };

        pc.oniceconnectionstatechange = () => {
            const iceState = pc.iceConnectionState;
            if (iceState === "disconnected" || iceState === "failed" || iceState === "closed") {
                this.onPeerDisconnected?.(peerId);
            }
        };

        this.peers.set(peerId, pc);
        return pc;
    }

    /**
     * Gom nhóm các ICE Candidates phát sinh dồn dập để gửi theo batch lên Firestore (tiết kiệm quota)
     */
    queueIceCandidate(peerId, candidate) {
        if (!peerId || this.isDestroyed) return;

        if (candidate) {
            const list = this.pendingCandidates.get(peerId) || [];
            list.push(candidate);
            this.pendingCandidates.set(peerId, list);

            if (!this.candidateBatchTimers.has(peerId)) {
                const timer = setTimeout(() => {
                    this.flushCandidateBatch(peerId);
                }, 250);
                this.candidateBatchTimers.set(peerId, timer);
            }
        } else {
            // candidate === null tức là WebRTC ICE Gathering đã hoàn tất, flush ngay
            this.flushCandidateBatch(peerId);
        }
    }

    /**
     * Gửi toàn bộ candidate đang chờ trong hàng đợi theo batch 1 document duy nhất
     */
    flushCandidateBatch(peerId) {
        const timer = this.candidateBatchTimers.get(peerId);
        if (timer) {
            clearTimeout(timer);
            this.candidateBatchTimers.delete(peerId);
        }

        const candidates = this.pendingCandidates.get(peerId);
        if (!candidates || candidates.length === 0) return;

        this.pendingCandidates.delete(peerId);

        this.sendSignal({
            to: peerId,
            type: "candidates_batch",
            payload: JSON.stringify(candidates),
        });
    }

    /**
     * Chủ động tạo Offer gửi cho peer
     */
    async initiateOffer(peerId, pc) {
        if (this.makingOffer.get(peerId) || pc.signalingState !== "stable") return;
        try {
            this.makingOffer.set(peerId, true);
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
            });
            if (pc.signalingState !== "stable") return;
            await pc.setLocalDescription(offer);

            await this.sendSignal({
                to: peerId,
                type: "offer",
                payload: JSON.stringify(offer),
            });
        } catch (err) {
            console.warn(`[WebRTC] Lỗi tạo offer tới ${peerId}:`, err);
        } finally {
            this.makingOffer.set(peerId, false);
        }
    }

    /**
     * Xử lý tín hiệu đến (Offer, Answer, Candidate)
     */
    async handleIncomingSignal(signal) {
        const { from, type, payload } = signal;
        if (!from || !payload || from === this.currentUserId) return;

        try {
            const data = JSON.parse(payload);
            const pc = this.getOrCreatePeerConnection(from);
            if (!pc) return;

            if (type === "offer") {
                await this.handleOfferSignal(from, data, pc);
            } else if (type === "answer") {
                await this.handleAnswerSignal(from, data, pc);
            } else if (type === "candidates_batch") {
                await this.handleCandidatesBatchSignal(from, data, pc);
            } else if (type === "candidate") {
                await this.handleCandidateSignal(from, data, pc);
            }
        } catch (err) {
            console.warn(`[WebRTC] Lỗi xử lý signal ${type} từ ${from}:`, err);
        }
    }

    async handleOfferSignal(from, data, pc) {
        if (!SessionDescription) return;

        const isOfferCollision = pc.signalingState !== "stable" || this.makingOffer.get(from);
        const isPolite = this.currentUserId > from;

        if (isOfferCollision && !isPolite) {
            return;
        }

        try {
            if (isOfferCollision) {
                // W3C Perfect Negotiation: peer polite rollback state để tránh InvalidStateError
                await Promise.all([
                    pc.setLocalDescription({ type: "rollback" }),
                    pc.setRemoteDescription(new SessionDescription(data)),
                ]);
            } else {
                await pc.setRemoteDescription(new SessionDescription(data));
            }

            await this.drainCandidateQueue(from, pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await this.sendSignal({
                to: from,
                type: "answer",
                payload: JSON.stringify(answer),
            });
        } catch (err) {
            console.warn(`[WebRTC] Lỗi xử lý offer từ ${from}:`, err);
        }
    }

    async handleAnswerSignal(from, data, pc) {
        if (!SessionDescription) return;
        try {
            if (pc.signalingState === "have-local-offer") {
                await pc.setRemoteDescription(new SessionDescription(data));
                await this.drainCandidateQueue(from, pc);
            }
        } catch (err) {
            console.warn(`[WebRTC] Lỗi xử lý answer từ ${from}:`, err);
        }
    }

    async handleCandidateSignal(from, data, pc) {
        if (!IceCandidate || !data) return;

        if (pc.remoteDescription?.type) {
            await pc.addIceCandidate(new IceCandidate(data)).catch(() => {});
        } else {
            const queue = this.candidateQueues.get(from) || [];
            queue.push(data);
            this.candidateQueues.set(from, queue);
        }
    }

    /**
     * Xử lý tín hiệu gom nhóm nhiều ICE Candidates cùng lúc
     */
    async handleCandidatesBatchSignal(from, candidatesList, pc) {
        if (!Array.isArray(candidatesList) || candidatesList.length === 0) return;
        for (const candidateData of candidatesList) {
            await this.handleCandidateSignal(from, candidateData, pc);
        }
    }

    /**
     * Xử lý giải phóng hàng đợi candidate sau khi setRemoteDescription
     */
    async drainCandidateQueue(peerId, pc) {
        const queue = this.candidateQueues.get(peerId) || [];
        this.candidateQueues.set(peerId, []);

        for (const candidateData of queue) {
            try {
                if (IceCandidate) {
                    await pc.addIceCandidate(new IceCandidate(candidateData));
                }
            } catch {
                // Bỏ qua lỗi candidate cũ
            }
        }
    }

    /**
     * Gửi tín hiệu lên Firestore
     */
    async sendSignal({ to, type, payload }) {
        if (!this.roomId || this.isDestroyed) return;
        try {
            const signalsRef = collection(db, ROOMS_COLLECTION, this.roomId, SIGNALS_SUB_COLLECTION);
            await addDoc(signalsRef, {
                from: this.currentUserId,
                to,
                type,
                payload,
                createdAt: serverTimestamp(),
            });
        } catch (err) {
            console.error("[WebRTC] Lỗi gửi signal (Vui lòng kiểm tra Firestore Rules):", err?.message || err);
        }
    }

    /**
     * Đóng kết nối của một peer
     */
    closePeerConnection(peerId) {
        const timer = this.candidateBatchTimers.get(peerId);
        if (timer) {
            clearTimeout(timer);
            this.candidateBatchTimers.delete(peerId);
        }
        this.pendingCandidates.delete(peerId);

        const pc = this.peers.get(peerId);
        if (pc) {
            pc.close();
            this.peers.delete(peerId);
        }
        this.candidateQueues.delete(peerId);
        this.makingOffer.delete(peerId);

        if (this.remoteStreams.has(peerId)) {
            this.remoteStreams.delete(peerId);
            if (this.onRemoteStreamChange) {
                this.onRemoteStreamChange(new Map(this.remoteStreams));
            }
        }
    }

    /**
     * Dọn dẹp toàn bộ kết nối WebRTC khi rời phòng
     */
    destroy() {
        this.isDestroyed = true;
        if (this.unsubscribeSignals) {
            this.unsubscribeSignals();
            this.unsubscribeSignals = null;
        }

        this.candidateBatchTimers.forEach((timer) => clearTimeout(timer));
        this.candidateBatchTimers.clear();
        this.pendingCandidates.clear();

        this.peers.forEach((pc) => pc.close());
        this.peers.clear();
        this.candidateQueues.clear();
        this.makingOffer.clear();
        this.remoteStreams.clear();
        if (this.onRemoteStreamChange) {
            this.onRemoteStreamChange(new Map());
        }
    }
}
