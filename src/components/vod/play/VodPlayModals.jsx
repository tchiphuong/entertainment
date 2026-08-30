import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    CheckIcon,
    ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { Modal, Button, Input } from "../../ui";

export const ImageModal = ({
    showImageModal,
    setShowImageModal,
    modalImages,
    currentImageIndex,
    setCurrentImageIndex,
}) => {
    const { t } = useTranslation();
    if (!modalImages || modalImages.length === 0) return null;

    const handlePrev = () => {
        setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : modalImages.length - 1));
    };

    const handleNext = () => {
        setCurrentImageIndex((prev) => (prev < modalImages.length - 1 ? prev + 1 : 0));
    };

    return (
        <Modal.Backdrop isOpen={showImageModal} onOpenChange={setShowImageModal}>
            <Modal.Container size="cover">
                <Modal.Dialog aria-label={t("vodPlay.photoGallery") || "Bộ sưu tập ảnh"}>
                    <Modal.CloseTrigger />
                    <Modal.Body>
                        <div className="flex h-[70vh] w-full items-center justify-center overflow-hidden">
                            <img
                                loading="lazy"
                                src={`https://image.tmdb.org/t/p/original${modalImages[currentImageIndex]?.file_path}`}
                                alt={`Gallery item ${currentImageIndex + 1}`}
                                className="max-h-full max-w-full object-contain"
                            />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <div className="flex w-full items-center justify-between">
                            <Button
                                onPress={handlePrev}
                                variant="secondary"
                                isIconOnly
                                aria-label="Previous image"
                            >
                                <ChevronLeftIcon className="h-5 w-5 stroke-2" />
                            </Button>
                            <div className="flex flex-col items-center">
                                <span className="text-base font-black text-white">{currentImageIndex + 1}</span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                    {t("vodPlay.of") || "của"} {modalImages.length}
                                </span>
                            </div>
                            <Button
                                onPress={handleNext}
                                variant="secondary"
                                isIconOnly
                                aria-label="Next image"
                            >
                                <ChevronRightIcon className="h-5 w-5 stroke-2" />
                            </Button>
                        </div>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};

export const ShareModal = ({
    showShareModal,
    setShowShareModal,
    movie,
    shareMessage,
    copyToClipboard,
}) => {
    const { t } = useTranslation();
    if (!movie) return null;

    const currentUrl = typeof window !== "undefined" ? window.location.href : "";

    return (
        <Modal.Backdrop isOpen={showShareModal} onOpenChange={setShowShareModal}>
            <Modal.Container size="sm">
                <Modal.Dialog>
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>
                            {t("vodPlay.shareMovie") || "Chia sẻ phim"}
                        </Modal.Heading>
                    </Modal.Header>
                    <Modal.Body>
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="aspect-2/3 h-20 overflow-hidden rounded-lg">
                                    <img
                                        loading="lazy"
                                        src={movie.poster_url}
                                        alt={movie.name}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-base font-black truncate text-white">
                                        {movie.name}
                                    </h4>
                                    <p className="text-xs font-bold uppercase tracking-widest truncate text-zinc-500">
                                        {movie.origin_name}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                    {t("vodPlay.movieLink") || "Đường dẫn phim"}
                                </p>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <Input
                                            type="text"
                                            readOnly
                                            value={currentUrl}
                                            size="sm"
                                            aria-label="URL"
                                        />
                                    </div>
                                    <Button
                                        onPress={() => copyToClipboard(currentUrl)}
                                        variant="primary"
                                        size="sm"
                                    >
                                        {t("common.copy") || "Sao chép"}
                                    </Button>
                                </div>
                                {shareMessage && (
                                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-green-500">
                                        <CheckIcon className="h-3.5 w-3.5 stroke-3" />
                                        {shareMessage}
                                    </p>
                                )}
                            </div>
                        </div>
                    </Modal.Body>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};

export const NotFoundState = () => {
    const { t } = useTranslation();
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 px-4 text-center">
            <div className="rounded-full bg-zinc-900 p-8 ring-1 ring-white/10">
                <ExclamationTriangleIcon className="h-16 w-16 text-zinc-600 stroke-[1.5]" />
            </div>
            <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tighter text-white">
                    {t("vodPlay.contentNotFound") || "Không tìm thấy nội dung"}
                </h2>
                <p className="mx-auto max-w-md text-zinc-500">
                    {t("vodPlay.contentNotFoundDesc") || "Dữ liệu phim không khả dụng hoặc đã bị gỡ bỏ. Vui lòng thử lại sau hoặc chọn phim khác."}
                </p>
            </div>
            <Link to="/vod">
                <Button variant="primary" size="md">
                    {t("vodPlay.backToList") || "Quay lại danh sách"}
                </Button>
            </Link>
        </div>
    );
};
