/**
 * Chuyển đổi nội dung phụ đề từ định dạng SRT sang VTT
 * Phù hợp để nạp vào Shaka Player vì VTT được hỗ trợ tốt hơn
 * @param {string} srt Nội dung của file .srt
 * @returns {string} Nội dung đã định dạng .vtt
 */
export const convertSrtToVtt = (srt) => {
    // 1. Thêm header WEBVTT
    // 2. Thay thế dấu phẩy (,) sang dấu chấm (.) cho miliseconds
    // 3. Loại bỏ các số thứ tự dòng (numbers) đứng đầu mỗi block
    return (
        "WEBVTT\n\n" +
        srt
            .replace(/\r+/g, "")
            .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
            .replace(/^\d+\n/gm, "")
    );
};
