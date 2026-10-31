# KẾ HOẠCH HÀNH ĐỘNG (ACTION PLAN): CHUẨN HÓA 100% SEASON QUA TMDB

> **Cam kết:** Loại bỏ vĩnh viễn việc gọi `api/tim-kiem` trong luồng xem phim (Play/Detail). Dùng 100% TMDB làm nguồn chân lý (Source of Truth) cho danh sách Season và Metadata tập phim.

---

## 1. NGUYÊN NHÂN GỐC RỄ (ROOT CAUSE)

- **Tại sao code cũ lại có `api/tim-kiem?keyword=`?**
  Các nguồn phim Việt Nam (như PhimAPI / KKPhim) không có cấu trúc quan hệ Season cha-con cho phim bộ (TV Series). Mỗi mùa bị họ tách ra thành một bộ phim độc lập với slug riêng (ví dụ: `phi-vu-trieu-do-phan-1`, `phi-vu-trieu-do-phan-2`...).
  Người viết code trước đây đã dùng một cách "chữa cháy" (workaround bẩn): Lấy tên phim rồi bắn vào `api/tim-kiem?keyword=phi vu trieu do` để hy vọng mò ra các phần khác trong kết quả tìm kiếm.

- **Tại sao cách làm đó SAI HOÀN TOÀN?**
  1. **Sai chức năng API**: `api/tim-kiem` là endpoint tìm kiếm toàn văn cho thanh Search Bar của người dùng, không phải endpoint Get Detail.
  2. **Dữ liệu không chuẩn**: Kết quả tìm kiếm chỉ trả về danh sách tóm tắt sơ sài, không có cấu trúc Season, không có số tập, không có thumbnail chi tiết.
  3. **Lãng phí & Chậm**: Bắn request search thừa thãi làm nghẽn mạng và lộ endpoint.
  4. **Bỏ quên TMDB**: Dự án đã tích hợp TMDB cực kỳ mạnh mẽ với endpoint `/tv/{id}` và `/tv/{id}/season/{s}` chuẩn quốc tế, có sẵn mọi thông tin Mùa, Tập, Thumbnail mà lại không tận dụng triệt để.

---

## 2. KẾ HOẠCH TRIỂN KHAI CHI TIẾT (5 BƯỚC)

```
[BƯỚC 1: TRIỆT TIÊU SEARCH API]
  Xóa 100% lời gọi searchSourceK / api/tim-kiem trong luồng Play/Detail.
        │
        ▼
[BƯỚC 2: TMDB SOURCE OF TRUTH]
  Lấy danh sách Seasons trực tiếp từ tmdbDetails.seasons (/tv/{id}).
        │
        ▼
[BƯỚC 3: ÁNH XẠ SLUG NGUỒN PHÁT]
  Map Season TMDB sang Slug nguồn phát (vd: phi-vu-trieu-do-phan-{season}).
        │
        ▼
[BƯỚC 4: LOAD STREAM & THUMBNAIL TẬP]
  Nguồn Việt -> Stream Video (m3u8) | TMDB -> Thumbnail (still_path) & Metadata.
        │
        ▼
[BƯỚC 5: KIỂM TRA NETWORK & LINT]
  Xác minh Network Tab không còn request tim-kiem, chạy npm run lint đạt 0 lỗi.
```

---

### BƯỚC 1: Triệt tiêu hoàn toàn `api/tim-kiem` trong luồng Play & Detail
- [x] **`src/hooks/useMovieDetail.js`**:
  - Gỡ bỏ hoàn toàn `fetchRelatedSeasons` gọi `searchSourceK`.
  - Không bắn bất kỳ request tìm kiếm nào khi nạp chi tiết phim.
- [x] **`src/utils/vodPlayHelpers.js`**:
  - Viết lại `fetchRelatedSeasons`: Nếu cần kiểm tra seasons thì gọi trực tiếp TMDB `/tv/{id}`, cấm gọi `searchSourceK`.
  - Gỡ bỏ hàm `findMovieViaPhimApiSearch` trong `tryFindFallbackSeasonMovie`.
- [x] **`src/services/vod/vodService.js`**:
  - Chỉ giữ `searchSourceK` cho trang tìm kiếm của người dùng (`/vod/search`), cấm mọi thành phần player gọi tới.

---

### BƯỚC 2: Chuẩn hóa danh sách Season 100% từ TMDB
- **Nguồn dữ liệu**: Gọi duy nhất `vodService.fetchTMDbData(tmdbId, "tv", lang)` $\rightarrow$ endpoint `/tv/{id}`.
- **Xử lý danh sách mùa**:
  - Lọc bỏ `season_number === 0` (tập đặc biệt/hậu trường).
  - Trích xuất:
    ```javascript
    {
        season: s.season_number,
        name: s.name || `Mùa ${s.season_number}`,
        episodeCount: s.episode_count,
        posterPath: s.poster_path,
        slug: s.season_number === 1 ? cleanSlug : `${cleanSlug}-phan-${s.season_number}`,
        tmdbId: foundTmdbId,
    }
    ```
- **Không còn thuật toán so sánh gom phần thừa thãi**: Dùng thẳng mảng Season chuẩn này từ TMDB đưa vào `setSeasons`.

---

### BƯỚC 3: Cơ chế ánh xạ (Mapping) giữa TMDB Season và Slug nguồn phát
- Nguồn phát Việt Nam đặt tên slug theo quy tắc chuẩn:
  - Mùa 1: `{cleanSlug}` hoặc `{cleanSlug}-phan-1` (ví dụ: `phi-vu-trieu-do-phan-1`).
  - Mùa 2: `{cleanSlug}-phan-2`...
  - Mùa $N$: `{cleanSlug}-phan-${N}`.
- Khi người dùng click chọn Mùa $N$, hệ thống chỉ cần lấy slug tương ứng để gọi API Get Detail của nguồn phát (`/phim/{slug}`) lấy danh sách link m3u8.

---

### BƯỚC 4: Cơ chế tải tập và hiển thị Thumbnail mượt mà
Tại component `VodPlayEpisodesSection.jsx`:
1. **Tách biệt 2 trạng thái**:
   - `playingSeason`: Mùa của video đang phát trên Player.
   - `viewingSeason`: Mùa đang mở xem danh sách tập bên dưới (khán giả duyệt mùa khác mà video đang xem không bị ngắt).
2. **Khi chuyển tab mùa**:
   - Lấy link m3u8 stream từ nguồn phát qua slug của mùa đó.
   - Lấy ảnh thumbnail `still_path` từ TMDB Season API (`/tv/{tmdbId}/season/{seasonNumber}`).
   - Lưu vào `seasonCache[seasonNumber]` để chuyển qua lại tức thì (0ms).
3. **Khi click chọn tập**:
   - Cập nhật URL bằng `window.history.replaceState` (không reload trang).
   - Nạp stream video mới vào Player.

---

### BƯỚC 5: Kiểm tra xác minh thực tế (Testing & Quality Assurance)
1. Mở DevTools Network Tab kiểm tra URL:
   `http://localhost:5173/entertainment/vod/play/phi-vu-trieu-do-phan-1?source=source_k&id=71446&type=tv&season=1&episode=1&server=long-tieng`
   $\rightarrow$ **Kết quả yêu cầu**: Không có bất kỳ request nào gọi tới `api/tim-kiem`.
2. Chuyển đổi giữa các tab Mùa 1, Mùa 2, Mùa 3:
   $\rightarrow$ Danh sách tập nạp mượt mà, thumbnail lấy đúng từ TMDB.
3. Chạy `npm run lint`:
   $\rightarrow$ 0 error, 0 warning, SonarQube cognitive complexity `<= 15`.
